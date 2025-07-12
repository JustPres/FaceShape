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
    // Defensive check: Ensure model is loaded before trying to use it.
    if (!model) {
      console.error("detectionLoop: Attempted to run detection, but model is not loaded!");
      feedback.textContent = "Error: Face detection model not available. Please refresh.";
      isProcessing = false;
      requestAnimationFrame(detectionLoop);
      return;
    }

    ctx.save();
    ctx.scale(-1, 1); // Mirror video feed
    ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
    ctx.restore();

    // The new API uses estimateFaces on the detector object
    const predictions = await model.estimateFaces(video, {
      flipHorizontal: false
    });

    if (predictions.length > 0) {
      // The structure of the prediction is different, it has a `keypoints` property
      const landmarks = predictions[0].keypoints;
      if (!landmarks) {
        console.error("Prediction object does not contain keypoints:", predictions[0]);
        return;
      }
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
  // The keypoints from the new API have x, y, z properties.
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
function updateFaceShape(landmarks) {
  const JAWLINE_INDICES = [234, 93, 132, 58, 172, 136, 149, 148, 152, 377, 400, 378, 379, 365, 397, 288];
  const jawPoints = JAWLINE_INDICES.map(i => landmarks[i]);

  // Calculate face metrics using .x and .y properties
  const faceWidth = Math.max(...jawPoints.map(p => p.x)) - Math.min(...jawPoints.map(p => p.x));
  const faceHeight = distance(landmarks[10], landmarks[152]);
  const jawWidth = distance(jawPoints[0], jawPoints[jawPoints.length - 1]);
  const foreheadWidth = distance(landmarks[234], landmarks[454]);

  // Determine shape
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

  result.textContent = `Face Shape: ${shape}`;
}

function distance(p1, p2) {
  // The points now have .x and .y properties
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
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
    // Display a more user-friendly and specific message on the page
    if (error.message.toLowerCase().includes("camera access denied")) {
      feedback.textContent = "Camera access was denied. Please enable camera permissions in your browser settings and refresh.";
    } else if (error.message.toLowerCase().includes("model loading failed") || error.message.toLowerCase().includes("initialize face detection")) {
      // The specific error from loadModel is already set to feedback.textContent, 
      // but we can add a general prefix or ensure it's not overwritten by a generic one.
      feedback.textContent = "Error initializing application: " + feedback.textContent; // Keep existing specific model error
    } else {
      feedback.textContent = "Application failed to start. Error: " + error.message + ". Please try again or check console.";
    }
    // Optionally, hide loading indicators or show an error state in the UI
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      loadingScreen.style.visibility = "hidden";
    }
  }
})();