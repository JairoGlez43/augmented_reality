// Function to handle camera access
export const startCamera = async ():Promise<MediaStream | null> => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: false});
    console.log("Camera stream:", stream);
    return stream;
  } catch (error) {
    console.error("Error accessing camera:", error);
    return null;
  }
};

export const stopCamera = (stream: MediaStream | null) => {
  if (stream) {
    console.log(stream.getTracks());
    stream.getTracks().forEach(track => track.stop());
  }
};



