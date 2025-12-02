import React, { useCallback } from 'react';

export function FileTransfer({ mode, onFileSelect, fileQueue, onRemoveFile, onStartTransfer, currentTransfer, stats, receivedFiles, sentFiles }) {
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFileSelect(Array.from(e.dataTransfer.files));
        }
    }, [onFileSelect]);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatTime = (seconds) => {
        if (!seconds || !isFinite(seconds)) return '--';
        if (seconds < 60) return `${Math.round(seconds)}s`;
        return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    };

    const getFileIcon = (fileName) => {
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            pdf: '📄',
            doc: '📝', docx: '📝',
            xls: '📊', xlsx: '📊',
            ppt: '📊', pptx: '📊',
            zip: '🗜️', rar: '🗜️',
            jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
            mp4: '🎥', mov: '🎥', avi: '🎥',
            mp3: '🎵', wav: '🎵',
        };
        return iconMap[ext] || '📄';
    };

    if (mode === 'receiver') {
        return (
            <div className="bg-white rounded-2xl shadow-xl p-6 slide-up space-y-6">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <span className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">📥</span>
                    Receiving Files
                </h2>

                {currentTransfer ? (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100 scale-in">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="text-3xl">{getFileIcon(currentTransfer.name)}</span>
                                    <div>
                                        <p className="font-semibold text-gray-900 line-clamp-1">{currentTransfer.name}</p>
                                        <p className="text-sm text-gray-600">{formatBytes(currentTransfer.size)}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-green-600">{stats.progress}%</div>
                                <div className="text-xs text-gray-500">complete</div>
                            </div>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-4 shadow-inner">
                            <div
                                className="h-full bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 transition-all duration-300 relative overflow-hidden"
                                style={{ width: `${stats.progress}%` }}
                            >
                                <div className="absolute inset-0 shimmer"></div>
                            </div>
                        </div>

                        <div className="flex justify-between text-sm">
                            <div className="flex items-center gap-2 text-gray-700">
                                <span className="font-semibold">⚡ {formatBytes(stats.speed)}/s</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-700">
                                <span className="font-semibold">⏱️ {formatTime(stats.eta)}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border-2 border-dashed border-gray-300">
                        <div className="text-5xl mb-4 animate-pulse">📡</div>
                        <p className="text-gray-600 font-medium">Waiting for sender...</p>
                        <p className="text-sm text-gray-400 mt-2">Files will appear here automatically</p>
                    </div>
                )}

                {receivedFiles.length > 0 && (
                    <div className="fade-in">
                        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span>📦</span>
                            Received Files ({receivedFiles.length})
                        </h3>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                            {receivedFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200 scale-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <span className="text-2xl flex-shrink-0">{getFileIcon(file.name)}</span>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-sm text-gray-900 truncate">{file.name}</p>
                                            <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                                        </div>
                                    </div>
                                    <a
                                        href={file.url}
                                        download={file.name}
                                        className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors shadow-md hover:shadow-lg flex-shrink-0"
                                    >
                                        Download
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-xl p-6 slide-up space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">📁</span>
                Upload Files
            </h2>

            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-3 border-dashed border-gray-300 rounded-2xl p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 transition-all group relative overflow-hidden"
                onClick={() => document.getElementById('fileInput').click()}
            >
                <div className="relative z-10">
                    <div className="text-5xl mb-3 group-hover:scale-125 transition-transform duration-300">
                        📎
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">Drop files here</h3>
                    <p className="text-sm text-gray-500">or click to browse</p>
                </div>
                <input
                    type="file"
                    id="fileInput"
                    multiple
                    className="hidden"
                    onChange={(e) => onFileSelect(Array.from(e.target.files))}
                />
            </div>

            {fileQueue.length > 0 && (
                <div className="space-y-4 fade-in">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <span>📋</span>
                            Transfer Queue ({fileQueue.length})
                        </h3>
                        <button
                            onClick={onStartTransfer}
                            disabled={!!currentTransfer}
                            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 transition-all shadow-lg hover:shadow-xl disabled:shadow-none"
                        >
                            {currentTransfer ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Sending...
                                </span>
                            ) : 'Send Files'}
                        </button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {fileQueue.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200 group scale-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="text-2xl flex-shrink-0">{getFileIcon(file.name)}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-sm text-gray-900 truncate">{file.name}</p>
                                        <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onRemoveFile(idx)}
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                                    disabled={!!currentTransfer}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {currentTransfer && (
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100 bounce-in">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-3xl">{getFileIcon(currentTransfer.name)}</span>
                                <div>
                                    <p className="font-semibold text-gray-900 line-clamp-1">{currentTransfer.name}</p>
                                    <p className="text-sm text-gray-600">{formatBytes(currentTransfer.size)}</p>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-blue-600">{stats.progress}%</div>
                            <div className="text-xs text-gray-500">complete</div>
                        </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-4 shadow-inner">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-300 relative overflow-hidden"
                            style={{ width: `${stats.progress}%` }}
                        >
                            <div className="absolute inset-0 shimmer"></div>
                        </div>
                    </div>

                    <div className="flex justify-between text-sm">
                        <div className="flex items-center gap-2 text-gray-700">
                            <span className="font-semibold">⚡ {formatBytes(stats.speed)}/s</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-700">
                            <span className="font-semibold">⏱️ {formatTime(stats.eta)}</span>
                        </div>
                    </div>
                </div>
            )}

            {sentFiles && sentFiles.length > 0 && (
                <div className="fade-in">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <span>✅</span>
                        Sent Files ({sentFiles.length})
                    </h3>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                        {sentFiles.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors border border-gray-200 scale-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <span className="text-2xl flex-shrink-0">{getFileIcon(file.name)}</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-sm text-gray-900 truncate">{file.name}</p>
                                        <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-green-600 text-sm font-medium flex-shrink-0">
                                    <span>✓</span>
                                    <span>Sent</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
