import { useState, useRef, useCallback, useEffect } from 'react';

// ICE server configuration with STUN and TURN servers
// STUN servers help discover public IP addresses
// TURN servers relay traffic when direct peer-to-peer connection fails (e.g., across different networks)
const ICE_SERVERS = {
    iceServers: [
        // Google's public STUN servers for public IP discovery
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },

        // OpenRelay TURN servers for NAT traversal (free for testing)
        // These relay traffic when direct connections fail across different networks
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ],
    // Pre-gather ICE candidates for faster connection establishment
    iceCandidatePoolSize: 10
};

export function useVideoCall(sendSignal, userId) {
    const [callState, setCallState] = useState('idle'); // idle, calling, ringing, active, ended
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);

    const peerConnection = useRef(null);
    const pendingCandidates = useRef([]);

    // Cleanup function
    const cleanup = useCallback(() => {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            setLocalStream(null);
        }
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        setRemoteStream(null);
        pendingCandidates.current = [];
    }, [localStream]);

    // Initialize peer connection
    const initializePeerConnection = useCallback(() => {
        if (peerConnection.current) return peerConnection.current;

        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Add local stream tracks
        if (localStream) {
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });
        }

        // Handle remote stream
        pc.ontrack = (event) => {
            setRemoteStream(event.streams[0]);
        };

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && sendSignal) {
                console.log('ICE candidate type:', event.candidate.type, '| Protocol:', event.candidate.protocol);
                sendSignal('ice-candidate', {
                    candidate: event.candidate
                });
            } else if (!event.candidate) {
                console.log('ICE gathering completed');
            }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
            console.log('Connection state:', pc.connectionState);
            if (pc.connectionState === 'connected') {
                setCallState('active');
            } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                endCall();
            }
        };

        // Log ICE connection state for debugging
        pc.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', pc.iceConnectionState);
        };

        // Log ICE gathering state
        pc.onicegatheringstatechange = () => {
            console.log('ICE gathering state:', pc.iceGatheringState);
        };

        peerConnection.current = pc;
        return pc;
    }, [localStream, sendSignal]);

    // Start call (caller side)
    const startCall = useCallback(async () => {
        try {
            setCallState('calling');

            // Get user media
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            setLocalStream(stream);

            // Send call request
            if (sendSignal) {
                sendSignal('call-request', { userId });
            }
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Failed to access camera/microphone. Please grant permissions.');
            setCallState('idle');
        }
    }, [sendSignal, userId]);

    // Accept call (receiver side)
    const acceptCall = useCallback(async () => {
        try {
            // Get user media
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });
            setLocalStream(stream);
            setIncomingCall(null);
            setCallState('active');

            // Send acceptance
            if (sendSignal) {
                sendSignal('call-response', { accepted: true });
            }
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Failed to access camera/microphone. Please grant permissions.');
            rejectCall();
        }
    }, [sendSignal]);

    // Reject call
    const rejectCall = useCallback(() => {
        setIncomingCall(null);
        setCallState('idle');
        if (sendSignal) {
            sendSignal('call-response', { accepted: false });
        }
    }, [sendSignal]);

    // End call
    const endCall = useCallback(() => {
        if (sendSignal && callState !== 'idle') {
            sendSignal('call-end', {});
        }
        cleanup();
        setCallState('ended');
        setTimeout(() => setCallState('idle'), 2000);
    }, [sendSignal, callState, cleanup]);

    // Toggle audio mute
    const toggleMute = useCallback(() => {
        if (localStream) {
            const audioTrack = localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsAudioMuted(!audioTrack.enabled);
            }
        }
    }, [localStream]);

    // Toggle video
    const toggleVideo = useCallback(() => {
        if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    }, [localStream]);

    // Handle incoming signaling messages
    const handleSignal = useCallback(async (type, data, sender) => {
        try {
            switch (type) {
                case 'call-request':
                    setIncomingCall({ from: sender });
                    setCallState('ringing');
                    break;

                case 'call-response':
                    if (data.accepted) {
                        // Call was accepted, create offer
                        const pc = initializePeerConnection();
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        sendSignal('offer', { sdp: offer });
                    } else {
                        // Call was rejected
                        cleanup();
                        setCallState('ended');
                        setTimeout(() => setCallState('idle'), 2000);
                    }
                    break;

                case 'offer':
                    const pc = initializePeerConnection();
                    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

                    // Process any pending ICE candidates
                    for (const candidate of pendingCandidates.current) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    }
                    pendingCandidates.current = [];

                    // Create answer
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    sendSignal('answer', { sdp: answer });
                    break;

                case 'answer':
                    if (peerConnection.current) {
                        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.sdp));

                        // Process any pending ICE candidates
                        for (const candidate of pendingCandidates.current) {
                            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                        }
                        pendingCandidates.current = [];
                    }
                    break;

                case 'ice-candidate':
                    if (peerConnection.current && peerConnection.current.remoteDescription) {
                        await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                    } else {
                        // Queue candidate if remote description not set yet
                        pendingCandidates.current.push(data.candidate);
                    }
                    break;

                case 'call-end':
                    cleanup();
                    setCallState('ended');
                    setTimeout(() => setCallState('idle'), 2000);
                    break;
            }
        } catch (error) {
            console.error('Error handling signal:', error);
        }
    }, [initializePeerConnection, sendSignal, cleanup]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    return {
        callState,
        localStream,
        remoteStream,
        isAudioMuted,
        isVideoOff,
        incomingCall,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        handleSignal
    };
}
