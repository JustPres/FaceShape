// ========= START: Copy everything below this line =========

// Detect.js - CORRECTED VERSION WITH STABILITY ENHANCEMENT
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const ovalGuide = document.querySelector(".oval-guide");
const feedback = document.getElementById("feedback");
const result = document.getElementById("result");
let model;
let isProcessing = false;
let recentShapes = []; // For stability
const SHAPE_HISTORY_SIZE = 30; // Number of frames to average over

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
    // Wait for TensorFlow.js to be ready
    await tf.ready();

    // Use the modern createDetector API
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
    throw error; // Re-throw the error
  }
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

    const predictions = await model.estimateFaces(video, {
      flipHorizontal: false
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    if (predictions.length > 0) {
      const landmarks = predictions[0].keypoints;
      if (!landmarks) {
        console.error("Prediction object does not contain keypoints:", predictions[0]);
        return;
      }
      updateAlignmentFeedback(landmarks);
      // Pass the whole prediction object to updateFaceShape
      updateFaceShape(predictions);
    } else {
      ovalGuide.classList.remove("detected");
      result.textContent = "Face Shape: No face detected";
      feedback.textContent = "Please position your face within the frame";
      // Clear the history when no face is detected
      recentShapes = [];
    }
  } catch (error) {
    console.error("Detection error:", error);
  }
  isProcessing = false;
  requestAnimationFrame(detectionLoop);
}

function updateDisplayedShape() {
  if (recentShapes.length === 0) {
    return;
  }
  // Count occurrences of each shape
  const shapeCounts = recentShapes.reduce((acc, shape) => {
    acc[shape] = (acc[shape] || 0) + 1;
    return acc;
  }, {});

  // Find the most frequent shape
  const mostFrequentShape = Object.keys(shapeCounts).reduce((a, b) => shapeCounts[a] > shapeCounts[b] ? a : b);

  result.textContent = `Face Shape: ${mostFrequentShape}`;
}

// Update alignment feedback
function updateAlignmentFeedback(landmarks) {
  const noseTip = landmarks[4];
  const faceCenterX = canvas.width / 2;
  const faceCenterY = canvas.height / 2;

  const xOffset = Math.abs(noseTip.x - faceCenterX);
  const yOffset = Math.abs(noseTip.y - faceCenterY);

  if (xOffset < 50 && yOffset < 75) {
    ovalGuide.classList.add("detected");
    feedback.textContent = "Face aligned! Analyzing...";
  } else {
    ovalGuide.classList.remove("detected");
    feedback.textContent = "Center your face in the oval";
  }
}

// Face shape calculation
function updateFaceShape(predictions) {
  const landmarks = predictions[0].keypoints;
  const JAWLINE_INDICES = [234, 93, 132, 58, 172, 136, 149, 148, 152, 377, 400, 378, 379, 365, 397, 288];
  const jawPoints = JAWLINE_INDICES.map(i => landmarks[i]);

  const faceWidth = Math.max(...jawPoints.map(p => p.x)) - Math.min(...jawPoints.map(p => p.x));
  const faceHeight = distance(landmarks[10], landmarks[152]);
  const jawWidth = distance(jawPoints[0], jawPoints[jawPoints.length - 1]);
  const foreheadWidth = distance(landmarks[234], landmarks[454]);

  let shape = "Oval";
  const ratio = faceHeight / faceWidth;

  if (ratio < 1.1 && jawWidth / foreheadWidth > 0.9) {
    shape = "Round";
  } else if (jawWidth / foreheadWidth > 0.95) {
    shape = "Square";
  } else if (foreheadWidth / jawWidth > 1.15) {
    shape = "Heart";
  } else if (ratio > 1.4) {
    shape = "Oblong";
  }

  // Add the detected shape to our history
  recentShapes.push(shape);
  // If the history is too long, remove the oldest entry
  if (recentShapes.length > SHAPE_HISTORY_SIZE) {
    recentShapes.shift();
  }

  // Update the displayed shape based on the history
  updateDisplayedShape();
}

function distance(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// Initialize app
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