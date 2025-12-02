import React, { useState } from 'react';

export function ConnectionManager({ sessionId, setSessionId, onConnect, status }) {
    const [copied, setCopied] = useState(false);

    const generateSessionId = () => {
        const id = Math.random().toString(36).substring(2, 10).toUpperCase();
        setSessionId(id);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(sessionId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isConnecting = status === 'connecting';
    const isConnected = status === 'connected';

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6 scale-in">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        {isConnected ? '✓' : '🔗'}
                    </span>
                    {isConnected ? 'Connected' : 'Session Setup'}
                </h2>
                {!isConnected && (
                    <button
                        onClick={generateSessionId}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm font-medium hover:from-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all"
                    >
                        Generate ID
                    </button>
                )}
            </div>

            {!isConnected ? (
                <div className="space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            value={sessionId}
                            onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                            placeholder="Enter or generate session ID"
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none font-mono text-lg tracking-wider transition-all"
                            maxLength={8}
                        />
                        {sessionId && (
                            <button
                                onClick={copyToClipboard}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-100 rounded-lg transition-colors group"
                            >
                                {copied ? (
                                    <span className="text-green-500  text-sm font-medium flex items-center gap-1">
                                        ✓ Copied
                                    </span>
                                ) : (
                                    <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                )}
                            </button>
                        )}
                    </div>

                    <button
                        onClick={onConnect}
                        disabled={!sessionId || isConnecting}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                        {isConnecting ? (
                            <>
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Connecting...
                            </>
                        ) : (
                            <>
                                Connect
                                <span>→</span>
                            </>
                        )}
                    </button>

                    <p className="text-sm text-gray-500 text-center">
                        Share this session ID with your peer to establish a connection
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                            <span className="text-white text-xl">✓</span>
                        </div>
                        <div className="flex-1">
                            <p className="font-semibold text-green-800">Connection Established</p>
                            <p className="text-sm text-green-600">Session ID: <span className="font-mono font-bold">{sessionId}</span></p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
