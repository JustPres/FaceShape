// Detect.js - Updated Version
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const ovalGuide = document.querySelector(".oval-guide");
const feedback = document.getElementById("feedback");
const result = document.getElementById("result");
let model;
let isProcessing = false;

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
      
      model = await faceLandmarksDetection.load(
        faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
        { 
          maxFaces: 1,
          runtime: 'mediapipe',
          solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh'
        }
      );
    } catch (error) {
      console.error("Model loading failed:", error);
      feedback.textContent = "Error: Failed to initialize face detection";
    }
  }
// Real-time detection loop
async function detectionLoop() {
  if (!model || isProcessing) return;

  isProcessing = true;
  try {
    ctx.save();
    ctx.scale(-1, 1); // Mirror video feed
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    const predictions = await model.estimateFaces({
      input: canvas,
      predictIrises: false,
      flipHorizontal: false
    });

    if (predictions.length > 0) {
      const landmarks = predictions[0].scaledMesh;
      updateAlignmentFeedback(landmarks);
      updateFaceShape(landmarks);
    } else {
      ovalGuide.classList.remove("detected");
      result.textContent = "Face Shape: No face detected";
      feedback.textContent = "Please position your face within the frame";
    }
  } catch (error) {
    console.error("Detection error:", error);
  }
  isProcessing = false;
  requestAnimationFrame(detectionLoop);
}

// Update alignment feedback
function updateAlignmentFeedback(landmarks) {
  const noseTip = landmarks[4];
  const faceCenterX = canvas.width / 2;
  const faceCenterY = canvas.height / 2;
  
  // Calculate distance from center
  const xOffset = Math.abs(noseTip[0] - faceCenterX);
  const yOffset = Math.abs(noseTip[1] - faceCenterY);
  
  if (xOffset < 50 && yOffset < 75) {
    ovalGuide.classList.add("detected");
    feedback.textContent = "Face aligned! Analyzing...";
  } else {
    ovalGuide.classList.remove("detected");
    feedback.textContent = "Center your face in the oval";
  }
}

// Face shape calculation
function updateFaceShape(landmarks) {
  const JAWLINE_INDICES = [234, 93, 132, 58, 172, 136, 149, 148, 152, 377, 400, 378, 379, 365, 397, 288];
  const jawPoints = JAWLINE_INDICES.map(i => landmarks[i]);
  
  // Calculate face metrics
  const faceWidth = Math.max(...jawPoints.map(p => p[0])) - Math.min(...jawPoints.map(p => p[0]));
  const faceHeight = distance(landmarks[10], landmarks[152]);
  const jawWidth = distance(jawPoints[0], jawPoints[jawPoints.length - 1]);
  const foreheadWidth = distance(landmarks[234], landmarks[454]);

  // Determine shape
  let shape = "Oval";
  const ratio = faceHeight / faceWidth;
  
  if (ratio < 1.1 && jawWidth/foreheadWidth > 0.9) {
    shape = "Round";
  } else if (jawWidth/foreheadWidth > 0.95) {
    shape = "Square";
  } else if (foreheadWidth/jawWidth > 1.15) {
    shape = "Heart";
  } else if (ratio > 1.4) {
    shape = "Oblong";
  }
  
  result.textContent = `Face Shape: ${shape}`;
}

function distance(p1, p2) {
  return Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
}

// Initialize app
(async function main() {
  try {
    await setupCamera();
    await loadModel();
    video.play();
    detectionLoop(); // Start real-time detection
  } catch (error) {
    console.error("Initialization failed:", error);
  }
})();