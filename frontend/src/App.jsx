import React, { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useVideoCall } from './hooks/useVideoCall';
import { ConnectionManager } from './components/ConnectionManager';
import { Chat } from './components/Chat';
import { VideoCall } from './components/VideoCall';

function App() {
  const {
    status,
    sessionId,
    messages,
    currentTransfer,
    transferStats,
    receivedFiles,
    sentFiles,
    userId,
    connect,
    sendMessage,
    sendSignal,
    setVideoSignalHandler,
    setSessionId,
    sendFilesDirectly
  } = useWebSocket();

  const videoCall = useVideoCall(sendSignal, userId);

  const [showChat, setShowChat] = useState(false);

  // Connect video signal handler
  useEffect(() => {
    setVideoSignalHandler(videoCall.handleSignal);
  }, [setVideoSignalHandler, videoCall.handleSignal]);

  // Auto-open chat when connected
  useEffect(() => {
    if (status === 'connected') {
      setShowChat(true);
    } else {
      setShowChat(false);
    }
  }, [status]);

  // Handle file selection - send files immediately
  const handleFileSelect = (files) => {
    sendFilesDirectly(files);
  };

  return (
    <div className="min-h-screen">
      {/* Show connection manager only when not connected */}
      {status !== 'connected' && (
        <div className="min-h-screen flex items-center justify-center p-4 relative">
          {/* Floating particles effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute w-72 h-72 bg-white/10 rounded-full blur-3xl top-20 -left-20 animate-pulse"></div>
            <div className="absolute w-96 h-96 bg-purple-300/20 rounded-full blur-3xl bottom-20 -right-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
            <div className="absolute w-80 h-80 bg-blue-300/20 rounded-full blur-3xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" style={{ animationDelay: '2s' }}></div>
          </div>
          <div className="w-full max-w-md relative z-10">
            {/* Header with enhanced glassmorphism */}
            <div className="text-center mb-8 slide-up">
              <div className="inline-block w-20 h-20 bg-white/20 backdrop-blur-xl border border-white/30 rounded-3xl flex items-center justify-center shadow-2xl mb-6 hover:scale-110 transition-transform duration-300">
                <span className="text-white text-4xl font-bold drop-shadow-lg">⚡</span>
              </div>
              <h1 className="text-4xl font-bold text-white mb-3 drop-shadow-lg">ShareIt Pro</h1>
              <p className="text-white/90 text-lg drop-shadow">Peer-to-Peer File Transfer</p>
            </div>

            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">

              <ConnectionManager
                sessionId={sessionId}
                setSessionId={setSessionId}
                onConnect={() => connect(sessionId)}
                status={status}
              />
            </div>

            {/* Status indicator with enhanced styling */}
            <div className="mt-6 text-center scale-in">
              <div className="inline-flex items-center text-sm bg-white/20 backdrop-blur-xl px-6 py-3 rounded-full border border-white/30 shadow-lg">
                <span className={`w-3 h-3 rounded-full mr-3 ${status === 'connected' ? 'bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.8)] animate-pulse' :
                  status === 'connecting' ? 'bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)] animate-pulse' : 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]'
                  }`}></span>
                <span className="text-white font-semibold capitalize drop-shadow">{status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat - Fullscreen when connected */}
      <Chat
        messages={messages}
        onSendMessage={sendMessage}
        userId={userId}
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        onFileSelect={handleFileSelect}
        currentTransfer={currentTransfer}
        stats={transferStats}
        receivedFiles={receivedFiles}
        sentFiles={sentFiles}
        onStartVideoCall={videoCall.startCall}
      />

      {/* Video Call */}
      <VideoCall
        callState={videoCall.callState}
        localStream={videoCall.localStream}
        remoteStream={videoCall.remoteStream}
        isAudioMuted={videoCall.isAudioMuted}
        isVideoOff={videoCall.isVideoOff}
        incomingCall={videoCall.incomingCall}
        onAccept={videoCall.acceptCall}
        onReject={videoCall.rejectCall}
        onEndCall={videoCall.endCall}
        onToggleMute={videoCall.toggleMute}
        onToggleVideo={videoCall.toggleVideo}
      />
    </div>
  );
}

export default App;
