import { useState, useRef, useCallback, useEffect } from "react";

interface DemoState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  error: string | null;
}

export const useDemoConsultation = () => {
  const [state, setState] = useState<DemoState>({
    localStream: null,
    remoteStream: null,
    isConnected: false,
    isConnecting: false,
    isMuted: false,
    isVideoOff: false,
    error: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const cleanup = useCallback(() => {
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }
    if (state.remoteStream) {
      state.remoteStream.getTracks().forEach(track => track.stop());
    }
  }, [state.localStream, state.remoteStream]);

  // Create a simulated "remote" stream by mirroring local with effects
  const createSimulatedRemote = useCallback((localStream: MediaStream): MediaStream => {
    // Create a canvas to apply effects to simulate remote
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    canvasRef.current = canvas;
    
    const ctx = canvas.getContext("2d");
    const video = document.createElement("video");
    video.srcObject = localStream;
    video.muted = true;
    video.play();
    videoRef.current = video;

    // Apply a slight filter to differentiate from local
    const drawFrame = () => {
      if (ctx && video.readyState >= 2) {
        // Draw mirrored (simulating other person)
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
        ctx.restore();
        
        // Add a subtle blue tint to differentiate
        ctx.fillStyle = "rgba(0, 100, 200, 0.05)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      requestAnimationFrame(drawFrame);
    };
    drawFrame();

    // Create stream from canvas
    const remoteStream = canvas.captureStream(30);
    
    // Copy audio track if exists
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      remoteStream.addTrack(audioTrack.clone());
    }

    return remoteStream;
  }, []);

  const startCall = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      setState(prev => ({ ...prev, localStream }));

      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Create simulated remote stream
      const remoteStream = createSimulatedRemote(localStream);

      setState(prev => ({
        ...prev,
        remoteStream,
        isConnected: true,
        isConnecting: false,
      }));

    } catch (error: any) {
      console.error("Failed to start demo call:", error);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || "Failed to access camera/microphone",
      }));
    }
  }, [createSimulatedRemote]);

  const endCall = useCallback(async () => {
    cleanup();
    setState({
      localStream: null,
      remoteStream: null,
      isConnected: false,
      isConnecting: false,
      isMuted: false,
      isVideoOff: false,
      error: null,
    });
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (state.localStream) {
      const audioTrack = state.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setState(prev => ({ ...prev, isMuted: !audioTrack.enabled }));
      }
    }
  }, [state.localStream]);

  const toggleVideo = useCallback(() => {
    if (state.localStream) {
      const videoTrack = state.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setState(prev => ({ ...prev, isVideoOff: !videoTrack.enabled }));
      }
    }
  }, [state.localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    ...state,
    startCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
};
