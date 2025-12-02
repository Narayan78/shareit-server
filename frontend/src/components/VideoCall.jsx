import React, { useEffect, useRef } from 'react';

export function VideoCall({
    callState,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoOff,
    incomingCall,
    onAccept,
    onReject,
    onEndCall,
    onToggleMute,
    onToggleVideo
}) {
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    // Update local video stream
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    // Update remote video stream
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // Don't render anything if idle
    if (callState === 'idle') return null;

    return (
        <>
            {/* Incoming Call Modal */}
            {incomingCall && callState === 'ringing' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>

                    {/* Modal */}
                    <div className="relative z-10 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl max-w-md w-full scale-in">
                        <div className="text-center">
                            {/* Icon */}
                            <div className="mx-auto w-20 h-20 bg-green-500/20 backdrop-blur-xl border border-green-400/30 rounded-full flex items-center justify-center mb-6 animate-pulse">
                                <span className="text-4xl">📹</span>
                            </div>

                            {/* Title */}
                            <h3 className="text-2xl font-bold text-white mb-2">Incoming Video Call</h3>
                            <p className="text-white/80 mb-8">Someone wants to start a video call with you</p>

                            {/* Buttons */}
                            <div className="flex gap-4">
                                <button
                                    onClick={onReject}
                                    className="flex-1 bg-red-500/20 hover:bg-red-500/30 backdrop-blur-xl border border-red-400/30 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-300 hover:scale-105"
                                >
                                    Decline
                                </button>
                                <button
                                    onClick={onAccept}
                                    className="flex-1 bg-green-500/20 hover:bg-green-500/30 backdrop-blur-xl border border-green-400/30 text-white font-semibold py-3 px-6 rounded-2xl transition-all duration-300 hover:scale-105"
                                >
                                    Accept
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Video Call Screen */}
            {(callState === 'calling' || callState === 'active' || callState === 'ended') && (
                <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
                    {/* Remote Video (Fullscreen) */}
                    <div className="absolute inset-0">
                        {remoteStream ? (
                            <video
                                ref={remoteVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="text-center">
                                    <div className="w-32 h-32 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="text-6xl">👤</span>
                                    </div>
                                    <p className="text-white/80 text-lg">
                                        {callState === 'calling' ? 'Calling...' : callState === 'ended' ? 'Call Ended' : 'Connecting...'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Local Video (Picture-in-Picture) */}
                    {localStream && callState !== 'ended' && (
                        <div className="absolute top-6 right-6 w-64 h-48 rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover scale-x-[-1]" // Mirror effect
                            />
                        </div>
                    )}

                    {/* Controls */}
                    {callState === 'active' && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
                            {/* Mute Button */}
                            <button
                                onClick={onToggleMute}
                                className={`w-16 h-16 rounded-full backdrop-blur-xl border border-white/30 shadow-xl transition-all duration-300 hover:scale-110 ${isAudioMuted
                                        ? 'bg-red-500/40 hover:bg-red-500/50'
                                        : 'bg-white/10 hover:bg-white/20'
                                    }`}
                                title={isAudioMuted ? 'Unmute' : 'Mute'}
                            >
                                <span className="text-2xl">
                                    {isAudioMuted ? '🔇' : '🎤'}
                                </span>
                            </button>

                            {/* End Call Button */}
                            <button
                                onClick={onEndCall}
                                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 border border-red-400 shadow-xl transition-all duration-300 hover:scale-110"
                                title="End Call"
                            >
                                <span className="text-2xl">📞</span>
                            </button>

                            {/* Video Toggle Button */}
                            <button
                                onClick={onToggleVideo}
                                className={`w-16 h-16 rounded-full backdrop-blur-xl border border-white/30 shadow-xl transition-all duration-300 hover:scale-110 ${isVideoOff
                                        ? 'bg-red-500/40 hover:bg-red-500/50'
                                        : 'bg-white/10 hover:bg-white/20'
                                    }`}
                                title={isVideoOff ? 'Turn On Video' : 'Turn Off Video'}
                            >
                                <span className="text-2xl">
                                    {isVideoOff ? '📷' : '📹'}
                                </span>
                            </button>
                        </div>
                    )}

                    {/* Calling State */}
                    {callState === 'calling' && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
                            <button
                                onClick={onEndCall}
                                className="bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-8 rounded-2xl shadow-xl transition-all duration-300 hover:scale-105"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Ended State */}
                    {callState === 'ended' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <div className="text-center">
                                <div className="w-24 h-24 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <span className="text-5xl">✓</span>
                                </div>
                                <p className="text-white text-xl font-semibold">Call Ended</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
