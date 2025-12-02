import React, { useState, useEffect, useRef, useMemo } from 'react';

// File Confirmation Dialog Component
function FileConfirmationDialog({ files, onConfirm, onCancel }) {
    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    const getFileIcon = (fileName) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const iconMap = {
            pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
            zip: '🗜️', rar: '🗜️',
            jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
            mp4: '🎥', mov: '🎥', avi: '🎥', webm: '🎥',
            mp3: '🎵', wav: '🎵', ogg: '🎵',
        };
        return iconMap[ext] || '📄';
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4 scale-in">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm File Transfer</h3>
                <p className="text-gray-600 mb-4">You're about to send {files.length} file{files.length > 1 ? 's' : ''}:</p>

                <div className="max-h-60 overflow-y-auto mb-4 space-y-2">
                    {files.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                            <span className="text-2xl">{getFileIcon(file.name)}</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-gray-900 truncate">{file.name}</p>
                                <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                    <p className="text-sm font-semibold text-blue-900">
                        Total: {formatBytes(totalSize)}
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-colors shadow-md"
                    >
                        Send Files
                    </button>
                </div>
            </div>
        </div>
    );
}

export function Chat({
    messages,
    onSendMessage,
    userId,
    isOpen,
    onClose,
    // File transfer props
    onFileSelect,
    currentTransfer,
    stats,
    receivedFiles,
    sentFiles
}) {
    const [input, setInput] = useState('');
    const [pendingFiles, setPendingFiles] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
        }
    }, [messages, isOpen, receivedFiles, sentFiles, currentTransfer]);

    // Merge all items into a single chronological timeline
    const timelineItems = useMemo(() => {
        const items = [];

        // Add text messages
        messages.forEach((msg) => {
            items.push({
                type: 'message',
                data: msg,
                timestamp: new Date(msg.timestamp).getTime(),
                sender: msg.sender
            });
        });

        // Add current transfer (if any)
        if (currentTransfer) {
            items.push({
                type: 'transfer',
                data: currentTransfer,
                timestamp: Date.now(),
                sender: userId
            });
        }

        // Add received files
        receivedFiles.forEach((file) => {
            items.push({
                type: 'received_file',
                data: file,
                timestamp: new Date(file.timestamp).getTime(),
                sender: 'other'
            });
        });

        // Add sent files
        sentFiles.forEach((file) => {
            items.push({
                type: 'sent_file',
                data: file,
                timestamp: new Date(file.timestamp).getTime(),
                sender: userId
            });
        });

        // Sort by timestamp
        items.sort((a, b) => a.timestamp - b.timestamp);

        return items;
    }, [messages, currentTransfer, receivedFiles, sentFiles, userId]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (input.trim()) {
            onSendMessage(input);
            setInput('');
        }
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            // Show confirmation dialog
            setPendingFiles(files);
            setShowConfirmation(true);
        }
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleConfirmSend = () => {
        if (pendingFiles && onFileSelect) {
            onFileSelect(pendingFiles);
        }
        setShowConfirmation(false);
        setPendingFiles(null);
    };

    const handleCancelSend = () => {
        setShowConfirmation(false);
        setPendingFiles(null);
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

    const formatTimestamp = (timestamp) => {
        try {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '';
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (error) {
            console.error('Error formatting timestamp:', error);
            return '';
        }
    };

    const getFileIcon = (fileName) => {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const iconMap = {
            pdf: '📄',
            doc: '📝', docx: '📝',
            xls: '📊', xlsx: '📊',
            ppt: '📊', pptx: '📊',
            zip: '🗜️', rar: '🗜️',
            jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
            mp4: '🎥', mov: '🎥', avi: '🎥', webm: '🎥',
            mp3: '🎵', wav: '🎵', ogg: '🎵',
        };
        return iconMap[ext] || '📄';
    };

    const handleFileDownload = (file) => {
        const link = document.createElement('a');
        link.href = file.url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const renderTimelineItem = (item, index) => {
        const isOwn = item.sender === userId;

        // TEXT MESSAGE
        if (item.type === 'message') {
            return (
                <div key={`msg-${index}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-2xl shadow-sm ${isOwn
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-none'
                        : 'bg-white text-gray-800 rounded-tl-none'
                        }`}>
                        <p className="text-sm break-words leading-relaxed">{item.data.content}</p>
                        <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-400'}`}>
                            {formatTimestamp(item.data.timestamp)}
                        </p>
                    </div>
                </div>
            );
        }

        // FILE TRANSFER IN PROGRESS
        if (item.type === 'transfer') {
            return (
                <div key={`transfer-${index}`} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[70%] w-80 rounded-2xl shadow-lg overflow-hidden border-2 border-blue-300">
                        <div className="relative">
                            <div
                                className="absolute inset-0 bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                                style={{ width: `${stats.progress}%` }}
                            />
                            <div
                                className="absolute inset-0 bg-gradient-to-r from-blue-200 to-blue-300"
                                style={{ left: `${stats.progress}%` }}
                            />

                            <div className="relative px-3 py-2 text-white">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-2xl">{getFileIcon(item.data.name)}</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-xs truncate">{item.data.name}</p>
                                        <p className="text-xs opacity-90">{formatBytes(item.data.size)}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold">{stats.progress}%</div>
                                    </div>
                                </div>

                                <div className="flex justify-between text-xs opacity-90">
                                    <span>⚡ {formatBytes(stats.speed)}/s</span>
                                    <span>⏱️ {formatTime(stats.eta)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        // RECEIVED FILE
        if (item.type === 'received_file') {
            const hasError = item.data.error || !item.data.url;

            return (
                <div key={`recv-${index}`} className="flex justify-start">
                    <div
                        onClick={() => !hasError && handleFileDownload(item.data)}
                        className={`max-w-[70%] bg-white rounded-2xl shadow-sm px-3 py-2 rounded-tl-none border ${hasError
                            ? 'border-red-200 cursor-not-allowed'
                            : 'border-gray-200 cursor-pointer hover:shadow-md hover:border-green-400'
                            } transition-all group`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl flex-shrink-0">{getFileIcon(item.data.name)}</span>
                            <div className="flex-1 min-w-0">
                                <p className={`font-medium text-xs truncate transition-colors ${hasError
                                    ? 'text-red-600'
                                    : 'text-gray-900 group-hover:text-green-600'
                                    }`}>{item.data.name}</p>
                                <p className="text-xs text-gray-500">{formatBytes(item.data.size)}</p>
                            </div>
                            {!hasError && (
                                <div className="text-green-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                            {hasError && (
                                <div className="text-red-500">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">
                                {formatTimestamp(item.data.timestamp)}
                            </p>
                            {!hasError && (
                                <p className="text-xs text-green-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                    Click to download
                                </p>
                            )}
                            {hasError && (
                                <p className="text-xs text-red-600 font-medium">
                                    Download failed (file too large)
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        // SENT FILE
        if (item.type === 'sent_file') {
            return (
                <div key={`sent-${index}`} className="flex justify-end">
                    <div className="max-w-[70%] bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl shadow-sm px-3 py-2 rounded-tr-none text-white">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl flex-shrink-0">{getFileIcon(item.data.name)}</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-xs truncate">{item.data.name}</p>
                                <p className="text-xs opacity-90">{formatBytes(item.data.size)}</p>
                            </div>
                            <div className="flex items-center gap-1 text-sm font-medium flex-shrink-0">
                                <span>✓</span>
                            </div>
                        </div>
                        <p className="text-xs opacity-75">
                            {formatTimestamp(item.data.timestamp)}
                        </p>
                    </div>
                </div>
            );
        }

        return null;
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-white flex flex-col z-50">
                {/* Header */}
                <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white flex justify-between items-center shadow-md">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">💬</span>
                        <div>
                            <h3 className="font-semibold text-base">Chat & File Transfer</h3>
                            <p className="text-xs text-blue-100">Peer-to-Peer</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Messages & Files Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-br from-gray-50 to-gray-100">
                    <div className="max-w-4xl mx-auto space-y-2">
                        {timelineItems.length === 0 && (
                            <div className="text-center text-gray-400 mt-20">
                                <div className="text-6xl mb-4">💬</div>
                                <p className="text-lg font-medium">No messages yet</p>
                                <p className="text-sm">Start chatting or share files!</p>
                            </div>
                        )}

                        {/* Render all timeline items in chronological order */}
                        {timelineItems.map((item, index) => renderTimelineItem(item, index))}

                        <div ref={messagesEndRef} />
                    </div>
                </div>

                {/* Input Area */}
                <div className="border-t bg-white px-4 py-3 shadow-lg">
                    <div className="max-w-4xl mx-auto">
                        <form onSubmit={handleSubmit} className="flex gap-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                                title="Attach file"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className="flex-1 px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:outline-none text-sm"
                                placeholder="Type a message..."
                            />
                            <button
                                type="submit"
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-colors shadow-md font-medium text-sm"
                            >
                                Send
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* File Confirmation Dialog */}
            {showConfirmation && pendingFiles && (
                <FileConfirmationDialog
                    files={pendingFiles}
                    onConfirm={handleConfirmSend}
                    onCancel={handleCancelSend}
                />
            )}
        </>
    );
}
