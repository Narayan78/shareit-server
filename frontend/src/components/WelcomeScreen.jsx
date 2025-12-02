import React from 'react';

export function WelcomeScreen({ onSelectMode }) {
    return (
        <div className="min-h-screen flex items-center justify-center p-6">
            <div className="w-full max-w-4xl">
                {/* Hero Section */}
                <div className="text-center mb-12 fade-in">
                    <div className="inline-block mb-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-3xl flex items-center justify-center shadow-2xl mx-auto bounce-in relative">
                            <span className="text-4xl">⚡</span>
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-400 rounded-3xl blur-xl opacity-50 pulse-ring"></div>
                        </div>
                    </div>
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
                        File Transfer Pro
                    </h1>
                    <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                        Share files instantly and securely through WebSocket technology
                    </p>
                </div>

                {/* Mode Selection Cards */}
                <div className="grid md:grid-cols-2 gap-6 slide-up" style={{ animationDelay: '0.2s' }}>
                    {/* Send Files Card */}
                    <button
                        onClick={() => onSelectMode('sender')}
                        className="group relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden"
                    >
                        {/* Gradient Background on Hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <div className="relative z-10">
                            {/* Icon */}
                            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform shadow-lg">
                                <span className="text-3xl">📤</span>
                            </div>

                            {/* Content */}
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">
                                Send Files
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Share files with anyone by generating a unique session ID
                            </p>

                            {/* Features */}
                            <ul className="text-sm text-gray-500 space-y-2 text-left">
                                <li className="flex items-center gap-2">
                                    <span className="text-green-500">✓</span>
                                    Unlimited file size
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-green-500">✓</span>
                                    Real-time progress tracking
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-green-500">✓</span>
                                    Built-in chat
                                </li>
                            </ul>

                            {/* Arrow Icon */}
                            <div className="mt-6 flex items-center justify-center gap-2 text-blue-600 font-semibold">
                                Get Started
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </div>
                        </div>
                    </button>

                    {/* Receive Files Card */}
                    <button
                        onClick={() => onSelectMode('receiver')}
                        className="group relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden"
                    >
                        {/* Gradient Background on Hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-teal-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                        <div className="relative z-10">
                            {/* Icon */}
                            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform shadow-lg">
                                <span className="text-3xl">📥</span>
                            </div>

                            {/* Content */}
                            <h2 className="text-2xl font-bold text-gray-900 mb-3">
                                Receive Files
                            </h2>
                            <p className="text-gray-600 mb-6">
                                Connect using a session ID to receive files instantly
                            </p>

                            {/* Features */}
                            <ul className="text-sm text-gray-500 space-y-2 text-left">
                                <li className="flex items-center gap-2">
                                    <span className="text-green-500">✓</span>
                                    Instant downloads
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-green-500">✓</span>
                                    Progress monitoring
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-green-500">✓</span>
                                    Live collaboration
                                </li>
                            </ul>

                            {/* Arrow Icon */}
                            <div className="mt-6 flex items-center justify-center gap-2 text-green-600 font-semibold">
                                Get Started
                                <span className="group-hover:translate-x-1 transition-transform">→</span>
                            </div>
                        </div>
                    </button>
                </div>

                {/* Footer Info */}
                <div className="text-center mt-12 fade-in" style={{ animationDelay: '0.4s' }}>
                    <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-6 py-3 rounded-full shadow-md">
                        <span className="text-green-500">🔒</span>
                        <span className="text-sm text-gray-600 font-medium">
                            Secure peer-to-peer transfer — No files stored on servers
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
