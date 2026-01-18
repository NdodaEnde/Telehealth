import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface WebRTCState {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isConnected: boolean;
  isConnecting: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  error: string | null;
}

interface UseWebRTCOptions {
  sessionId: string;
  appointmentId: string;
  isInitiator: boolean;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onRemoteJoined?: () => void;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

export const useWebRTC = ({
  sessionId,
  appointmentId,
  isInitiator,
  onConnected,
  onDisconnected,
  onRemoteJoined,
}: UseWebRTCOptions) => {
  const { user } = useAuth();
  const [state, setState] = useState<WebRTCState>({
    localStream: null,
    remoteStream: null,
    isConnected: false,
    isConnecting: false,
    isMuted: false,
    isVideoOff: false,
    error: null,
  });

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const cleanup = useCallback(() => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop());
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [state.localStream]);

  const initializeMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
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
      setState(prev => ({ ...prev, localStream: stream, error: null }));
      return stream;
    } catch (error: any) {
      console.error("Failed to get user media:", error);
      setState(prev => ({ ...prev, error: "Failed to access camera/microphone" }));
      throw error;
    }
  }, []);

  const createPeerConnection = useCallback((localStream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks
    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    // Handle remote tracks
    pc.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind);
      const remoteStream = new MediaStream();
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
      setState(prev => ({ ...prev, remoteStream }));
      onRemoteJoined?.();
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        console.log("Sending ICE candidate");
        channelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: {
            candidate: event.candidate.toJSON(),
            from: user?.id,
          },
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        setState(prev => ({ ...prev, isConnected: true, isConnecting: false }));
        onConnected?.();
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setState(prev => ({ ...prev, isConnected: false }));
        onDisconnected?.();
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
    };

    return pc;
  }, [user?.id, onConnected, onDisconnected, onRemoteJoined]);

  const setupSignaling = useCallback(async (pc: RTCPeerConnection) => {
    const channel = supabase.channel(`consultation:${sessionId}`, {
      config: { presence: { key: user?.id } },
    });

    channel.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.from === user?.id) return;
      console.log("Received offer");
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
        
        // Add pending ICE candidates
        for (const candidate of pendingCandidates.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidates.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        channel.send({
          type: "broadcast",
          event: "answer",
          payload: { answer: pc.localDescription, from: user?.id },
        });
      } catch (error) {
        console.error("Error handling offer:", error);
      }
    });

    channel.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (payload.from === user?.id) return;
      console.log("Received answer");
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        
        // Add pending ICE candidates
        for (const candidate of pendingCandidates.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
        pendingCandidates.current = [];
      } catch (error) {
        console.error("Error handling answer:", error);
      }
    });

    channel.on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
      if (payload.from === user?.id) return;
      console.log("Received ICE candidate");
      
      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        } else {
          pendingCandidates.current.push(payload.candidate);
        }
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    });

    channel.on("broadcast", { event: "user-joined" }, ({ payload }) => {
      if (payload.from === user?.id) return;
      console.log("User joined, creating offer...");
      
      // If we're the initiator and someone joins, create an offer
      if (isInitiator) {
        createOffer(pc, channel);
      }
    });

    await channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        console.log("Subscribed to signaling channel");
        
        // Announce presence
        channel.send({
          type: "broadcast",
          event: "user-joined",
          payload: { from: user?.id },
        });

        // If initiator, wait a bit for remote to join then create offer
        if (isInitiator) {
          setTimeout(() => createOffer(pc, channel), 1000);
        }
      }
    });

    channelRef.current = channel;
  }, [sessionId, user?.id, isInitiator]);

  const createOffer = async (pc: RTCPeerConnection, channel: ReturnType<typeof supabase.channel>) => {
    try {
      console.log("Creating offer...");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      channel.send({
        type: "broadcast",
        event: "offer",
        payload: { offer: pc.localDescription, from: user?.id },
      });
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };

  const startCall = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      const localStream = await initializeMedia();
      const pc = createPeerConnection(localStream);
      peerConnection.current = pc;
      await setupSignaling(pc);
    } catch (error: any) {
      console.error("Failed to start call:", error);
      setState(prev => ({ 
        ...prev, 
        isConnecting: false, 
        error: error.message || "Failed to start call" 
      }));
    }
  }, [initializeMedia, createPeerConnection, setupSignaling]);

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
    
    // Update session status
    await supabase
      .from("consultation_sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", sessionId);
  }, [cleanup, sessionId]);

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
