import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, RotateCcw, Check, X, Loader2, AlertCircle } from "lucide-react";

interface SelfieCaptureProps {
  onCapture: (imageData: string) => void;
  onSkip?: () => void;
  existingPhoto?: string | null;
  required?: boolean;
  title?: string;
  description?: string;
}

export const SelfieCapture = ({
  onCapture,
  onSkip,
  existingPhoto,
  required = true,
  title = "Take a Selfie",
  description = "This photo will be used to verify your identity during consultations."
}: SelfieCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(existingPhoto || null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  // Start camera stream
  const startCamera = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === "NotAllowedError") {
        setError("Camera access denied. Please allow camera access in your browser settings.");
      } else if (err.name === "NotFoundError") {
        setError("No camera found. Please connect a camera and try again.");
      } else {
        setError("Failed to access camera. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [facingMode]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // Capture photo from video stream
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas (mirror for selfie)
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image as data URL (JPEG for smaller size)
    const imageData = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(imageData);
    stopCamera();
  }, [stopCamera]);

  // Retake photo
  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  // Confirm and submit photo
  const confirmPhoto = useCallback(() => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  }, [capturedImage, onCapture]);

  // Toggle camera (front/back)
  const toggleCamera = useCallback(() => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  }, []);

  // Restart camera when facing mode changes
  useEffect(() => {
    if (isStreaming) {
      startCamera();
    }
  }, [facingMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6 space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
            <Camera className="w-5 h-5" />
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {description}
          </p>
        </div>

        {/* Camera/Preview Area */}
        <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
          {/* Error State */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
              <AlertCircle className="w-10 h-10 text-destructive mb-2" />
              <p className="text-sm text-destructive">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={startCamera}
                className="mt-4"
              >
                Try Again
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Captured Image Preview */}
          {capturedImage && !isStreaming && (
            <img 
              src={capturedImage} 
              alt="Captured selfie" 
              className="w-full h-full object-cover"
            />
          )}

          {/* Video Stream */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isStreaming ? 'block' : 'hidden'}`}
            style={{ transform: 'scaleX(-1)' }} // Mirror for selfie
          />

          {/* Canvas for capturing (hidden) */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Initial State - No camera, no image */}
          {!isStreaming && !capturedImage && !error && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-24 h-24 rounded-full bg-muted-foreground/10 flex items-center justify-center mb-4">
                <Camera className="w-12 h-12 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Click below to start camera</p>
            </div>
          )}

          {/* Camera Controls Overlay */}
          {isStreaming && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={toggleCamera}
                className="bg-background/80 backdrop-blur-sm"
                title="Switch camera"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                size="lg"
                onClick={capturePhoto}
                className="rounded-full w-16 h-16 bg-white border-4 border-primary hover:bg-gray-100"
              >
                <div className="w-12 h-12 rounded-full bg-primary" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={stopCamera}
                className="bg-background/80 backdrop-blur-sm"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isStreaming && !capturedImage && (
            <>
              <Button onClick={startCamera} className="flex-1" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 mr-2" />
                )}
                Open Camera
              </Button>
              {!required && onSkip && (
                <Button variant="outline" onClick={onSkip}>
                  Skip for Now
                </Button>
              )}
            </>
          )}

          {capturedImage && !isStreaming && (
            <>
              <Button variant="outline" onClick={retakePhoto} className="flex-1">
                <RotateCcw className="w-4 h-4 mr-2" />
                Retake
              </Button>
              <Button onClick={confirmPhoto} className="flex-1">
                <Check className="w-4 h-4 mr-2" />
                Use This Photo
              </Button>
            </>
          )}
        </div>

        {required && (
          <p className="text-xs text-center text-muted-foreground">
            📸 A clear photo of your face is required for identity verification
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SelfieCapture;
