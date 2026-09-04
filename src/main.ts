import { startCamera, stopCamera } from "./camera";

let cameraStream: MediaStream | null = null;
console.log("Camera stream:", cameraStream);
const turnOnCameraButton = document.getElementById("turnOnCameraButton");
if (turnOnCameraButton && cameraStream === null) {
  turnOnCameraButton.addEventListener("click", async () => {
    cameraStream = await startCamera();
  });
}
const turnOffCameraButton = document.getElementById("turnOffCameraButton");
if (turnOffCameraButton) {
  turnOffCameraButton.addEventListener("click", () => {
    stopCamera(cameraStream)
    cameraStream = null;
  });
}