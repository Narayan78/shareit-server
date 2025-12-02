import React, { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { ConnectionManager } from './components/ConnectionManager';
import { Chat } from './components/Chat';

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
    setSessionId,
    sendFilesDirectly
  } = useWebSocket();

  const [showChat, setShowChat] = useState(false);

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
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
          <div className="w-full max-w-md">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-block w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                <span className="text-white text-3xl font-bold">⚡</span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">ShareIt Pro</h1>
              <p className="text-gray-600">Peer-to-Peer File Transfer</p>
            </div>

            <ConnectionManager
              sessionId={sessionId}
              setSessionId={setSessionId}
              onConnect={() => connect(sessionId)}
              status={status}
            />

            {/* Status indicator */}
            <div className="mt-6 text-center">
              <div className="inline-flex items-center text-sm bg-white px-4 py-2 rounded-full border shadow-sm">
                <span className={`w-2.5 h-2.5 rounded-full mr-2 ${status === 'connected' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                  status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                  }`}></span>
                <span className="text-gray-600 font-medium capitalize">{status}</span>
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
      />
    </div>
  );
}

export default App;
