// ========= START: Copy everything below this line =========

// Detect.js - FINAL CORRECTED DRAWING LOGIC
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const feedback = document.getElementById("feedback");
const result = document.getElementById("result");
let model;
let isProcessing = false;
let recentShapes = [];
const SHAPE_HISTORY_SIZE = 30;
let noFaceCounter = 0;
const NO_FACE_THRESHOLD = 150;

// Setup camera
async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" }
    });
    video.srcObject = stream;
    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        resolve(video);
      };
    });
  } catch (error) {
    console.error("Camera access error:", error);
    feedback.textContent = "Camera access denied. Please enable your camera.";
    throw error;
  }
}

// Load the face detection model
async function loadModel() {
  try {
    await tf.ready();
    const modelConfig = {
      runtime: 'mediapipe',
      solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
      maxFaces: 1
    };
    model = await faceLandmarksDetection.createDetector(
      faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
      modelConfig
    );
    if (!model) {
      throw new Error("createDetector returned undefined or null");
    }
  } catch (error) {
    console.error("Model loading failed:", error);
    feedback.textContent = "Error: Failed to initialize face detection. " + error.message;
    throw error;
  }
}

// Function to draw the landmarks
function drawLandmarks(landmarks) {
  ctx.fillStyle = 'rgba(0, 255, 150, 0.7)';
  for (const landmark of landmarks) {
    // Manually mirror the X coordinate for drawing
    const mirroredX = canvas.width - landmark.x;
    ctx.beginPath();
    ctx.arc(mirroredX, landmark.y, 2, 0, 2 * Math.PI);
    ctx.fill();
  }
}

// Function to draw the oval guide
function drawGuide(isFaceDetected) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radiusX = 150;
  const radiusY = 200;
  ctx.strokeStyle = isFaceDetected ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.5)';
  ctx.lineWidth = 5;
  if (isFaceDetected) {
    ctx.shadowColor = 'rgba(0, 255, 0, 0.7)';
    ctx.shadowBlur = 20;
  } else {
    ctx.shadowBlur = 0;
  }
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// Real-time detection loop
async function detectionLoop() {
  if (!model || isProcessing) return;
  isProcessing = true;
  try {
    if (video.paused || video.ended || video.readyState < 3) {
      requestAnimationFrame(detectionLoop);
      return;
    }
    const predictions = await model.estimateFaces(video, { flipHorizontal: false });

    // 1. Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Draw the mirrored video feed
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    const isFaceDetected = predictions.length > 0;

    if (isFaceDetected) {
      noFaceCounter = 0;
      const landmarks = predictions[0].keypoints;
      if (!landmarks) {
        console.error("Prediction object does not contain keypoints:", predictions[0]);
        return;
      }

      // 3. Draw the landmarks on the non-mirrored canvas, but mirror their X coordinates manually
      drawLandmarks(landmarks);

      updateAlignmentFeedback(landmarks);
      updateFaceShape(predictions);
    } else {
      noFaceCounter++;
      result.textContent = "Face Shape: No face detected";
      if (noFaceCounter > NO_FACE_THRESHOLD) {
        feedback.textContent = "Detection difficult. Please find a brighter area.";
      } else {
        feedback.textContent = "Please position your face within the frame";
      }
      recentShapes = [];
    }

    // 4. Draw the guide on top of everything
    drawGuide(isFaceDetected);

  } catch (error) {
    console.error("Detection error:", error);
  }
  isProcessing = false;
  requestAnimationFrame(detectionLoop);
}

function updateDisplayedShape() {
  if (recentShapes.length === 0) return;
  const shapeCounts = recentShapes.reduce((acc, shape) => {
    acc[shape] = (acc[shape] || 0) + 1;
    return acc;
  }, {});
  const mostFrequentShape = Object.keys(shapeCounts).reduce((a, b) => shapeCounts[a] > shapeCounts[b] ? a : b);
  result.textContent = `Face Shape: ${mostFrequentShape}`;
}

function updateAlignmentFeedback(landmarks) {
  const noseTip = landmarks[4];
  // Manually mirror the X coordinate for alignment check
  const mirroredX = canvas.width - noseTip.x;
  const faceCenterX = canvas.width / 2;
  const faceCenterY = canvas.height / 2;
  const xOffset = Math.abs(mirroredX - faceCenterX);
  const yOffset = Math.abs(noseTip.y - faceCenterY);
  if (xOffset < 50 && yOffset < 75) {
    feedback.textContent = "Face aligned! Analyzing...";
  } else {
    feedback.textContent = "Center your face in the oval";
  }
}

function updateFaceShape(predictions) {
  const landmarks = predictions[0].keypoints;
  // Since all measurements are relative distances, mirroring doesn't affect them.
  const JAWLINE_INDICES = [234, 93, 132, 58, 172, 136, 149, 148, 152, 377, 400, 378, 379, 365, 397, 288];
  const CHEEKBONE_L = 116;
  const CHEEKBONE_R = 345;
  const FOREHEAD_L = 234;
  const FOREHEAD_R = 454;
  const FACE_TOP = 10;
  const FACE_BOTTOM = 152;
  const jawPoints = JAWLINE_INDICES.map(i => landmarks[i]);
  const faceHeight = distance(landmarks[FACE_TOP], landmarks[FACE_BOTTOM]);
  const foreheadWidth = distance(landmarks[FOREHEAD_L], landmarks[FOREHEAD_R]);
  const cheekboneWidth = distance(landmarks[CHEEKBONE_L], landmarks[CHEEKBONE_R]);
  const jawWidth = Math.max(...jawPoints.map(p => p.x)) - Math.min(...jawPoints.map(p => p.x));
  let shape = "Oval";
  const faceWidth = Math.max(foreheadWidth, cheekboneWidth, jawWidth);
  const faceHeightToWidthRatio = faceHeight / faceWidth;
  if (faceHeightToWidthRatio > 1.5) {
    shape = "Oblong";
  } else if (Math.abs(cheekboneWidth - jawWidth) < cheekboneWidth * 0.05 && Math.abs(foreheadWidth - jawWidth) < foreheadWidth * 0.05) {
    shape = "Square";
  } else if (foreheadWidth > cheekboneWidth && cheekboneWidth > jawWidth) {
    shape = "Heart";
  } else if (cheekboneWidth > foreheadWidth && cheekboneWidth > jawWidth) {
    shape = "Round";
  } else if (faceHeightToWidthRatio > 1.2) {
    shape = "Oval";
  }
  recentShapes.push(shape);
  if (recentShapes.length > SHAPE_HISTORY_SIZE) {
    recentShapes.shift();
  }
  updateDisplayedShape();
}

function distance(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

(async function main() {
  try {
    await setupCamera();
    await loadModel();
    video.play();
    detectionLoop();
  } catch (error) {
    console.error("Initialization failed:", error);
    feedback.textContent = "Application failed to start. Error: " + error.message + ". Please try again or check console.";
  }
})();