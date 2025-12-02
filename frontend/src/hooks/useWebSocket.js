import { useState, useRef, useCallback } from 'react';

const CONFIG = {
    SERVER_URL: 'wss://connect-with-me-0wzq.onrender.com/ws',
    CHUNK_SIZE: 128 * 1024,
    HEADER_MARKER: new Uint8Array([0xFF, 0xFD, 0xFC]),
    MAX_BUFFER: 1024 * 1024,
};

export function useWebSocket() {
    const [status, setStatus] = useState('disconnected');
    const [sessionId, setSessionId] = useState('');
    const [userId, setUserId] = useState(null);
    const [messages, setMessages] = useState([]);

    // File Transfer State
    const [fileQueue, setFileQueue] = useState([]);
    const [currentTransfer, setCurrentTransfer] = useState(null);
    const [transferStats, setTransferStats] = useState({
        speed: 0,
        progress: 0,
        totalBytes: 0,
        transferredBytes: 0,
        startTime: null,
        eta: 0
    });
    const [receivedFiles, setReceivedFiles] = useState([]);
    const [sentFiles, setSentFiles] = useState([]);

    const ws = useRef(null);
    const videoSignalHandler = useRef(null);
    const transferState = useRef({
        isTransferring: false,
        currentFile: null, // For receiver
        startTime: null,
        bytesTransferred: 0
    });

    const createMetadataHeader = (name, size, type) => {
        const metadata = { name, size, type: type || 'application/octet-stream' };
        const jsonStr = JSON.stringify(metadata);
        const encoder = new TextEncoder();
        const jsonBytes = encoder.encode(jsonStr);

        const header = new Uint8Array(4 + 4 + jsonBytes.length);
        header.set(CONFIG.HEADER_MARKER, 0);

        const view = new DataView(header.buffer);
        view.setUint32(4, jsonBytes.length, false);
        header.set(jsonBytes, 8);

        return header.buffer;
    };

    const completeFileReceive = useCallback(() => {
        const fileState = transferState.current.currentFile;

        try {
            // Create blob from chunks
            const blob = new Blob(fileState.chunks, { type: fileState.type });
            const url = URL.createObjectURL(blob);

            const fileInfo = {
                name: fileState.name,
                size: fileState.size,
                type: fileState.type,
                url: url,
                timestamp: new Date().toISOString()
            };

            setReceivedFiles(prev => [fileInfo, ...prev]);

            // Clear chunks from memory after creating blob
            fileState.chunks = [];
        } catch (error) {
            console.error('Error creating blob for received file:', error);

            // Even if blob creation fails, add to received files with a placeholder
            // User can try to download anyway or we show an error
            const fileInfo = {
                name: fileState.name,
                size: fileState.size,
                type: fileState.type,
                url: null, // No URL available
                error: true,
                timestamp: new Date().toISOString()
            };

            setReceivedFiles(prev => [fileInfo, ...prev]);
        }

        transferState.current.currentFile = null;
        setCurrentTransfer(null);
        setTransferStats({ speed: 0, progress: 0, totalBytes: 0, transferredBytes: 0, startTime: null, eta: 0 });
    }, []);

    const receiveChunk = useCallback((bytes) => {
        const fileState = transferState.current.currentFile;
        fileState.chunks.push(bytes);
        fileState.received += bytes.length;

        // Periodically consolidate chunks to save memory for large files
        // If we have more than 1000 chunks, consolidate them
        if (fileState.chunks.length > 1000) {
            try {
                const consolidatedBlob = new Blob(fileState.chunks, { type: fileState.type });
                fileState.chunks = [consolidatedBlob];
            } catch (error) {
                console.warn('Could not consolidate chunks:', error);
                // Continue anyway - will try again during final completion
            }
        }

        const elapsed = (Date.now() - fileState.startTime) / 1000;
        const speed = fileState.received / elapsed;
        const progress = Math.min(100, Math.round((fileState.received / fileState.size) * 100));
        const remainingBytes = fileState.size - fileState.received;
        const eta = speed > 0 ? remainingBytes / speed : 0;

        setTransferStats({
            speed,
            progress,
            totalBytes: fileState.size,
            transferredBytes: fileState.received,
            startTime: fileState.startTime,
            eta
        });

        if (fileState.received >= fileState.size) {
            completeFileReceive();
        }
    }, [completeFileReceive]);

    const startReceivingFile = useCallback((metadata) => {
        transferState.current.currentFile = {
            name: metadata.name,
            size: metadata.size,
            type: metadata.type,
            chunks: [],
            received: 0,
            startTime: Date.now()
        };
        setCurrentTransfer({ name: metadata.name, size: metadata.size });
    }, []);

    const handleBinaryData = useCallback((data) => {
        const bytes = new Uint8Array(data);

        // Check for header
        if (bytes.length > 8 &&
            bytes[0] === CONFIG.HEADER_MARKER[0] &&
            bytes[1] === CONFIG.HEADER_MARKER[1]) {

            const view = new DataView(data);
            const jsonLength = view.getUint32(4, false);
            const jsonBytes = bytes.slice(8, 8 + jsonLength);
            const decoder = new TextDecoder();
            const metadata = JSON.parse(decoder.decode(jsonBytes));

            startReceivingFile(metadata);
            return;
        }

        if (transferState.current.currentFile) {
            receiveChunk(bytes);
        }
    }, [startReceivingFile, receiveChunk]);

    const handleControlMessage = useCallback((msg) => {
        switch (msg.type) {
            case 'session_created':
                setSessionId(msg.session_id);
                setStatus('connected');
                break;

            case 'session_joined':
                setStatus('connected');
                break;

            case 'error':
                alert(msg.message);
                setStatus('disconnected');
                break;

            case 'chat':
                // Backend sends {type: 'chat', data: {sender, message, timestamp}}
                const chatData = msg.data || msg; // Fallback to msg for backwards compatibility
                setMessages(prev => [...prev, {
                    type: 'text',
                    sender: chatData.sender,
                    content: chatData.message,
                    timestamp: chatData.timestamp
                }]);
                break;

            case 'file_transfer_request':
                // Auto-accept for now
                ws.current.send(JSON.stringify({
                    type: 'file_transfer_response',
                    accepted: true,
                    transfer_id: msg.transfer_id
                }));
                break;

            // WebRTC Signaling Messages
            case 'offer':
            case 'answer':
            case 'ice-candidate':
            case 'call-request':
            case 'call-response':
            case 'call-end':
                if (videoSignalHandler.current) {
                    videoSignalHandler.current(msg.type, msg.data, msg.sender);
                }
                break;
        }
    }, []);

    const connect = useCallback((sid) => {
        if (!sid) return;
        setSessionId(sid);
        setStatus('connecting');

        // Generate unique user ID
        const uid = Math.random().toString(36).substring(7);
        setUserId(uid);

        // Connect as peer mode
        ws.current = new WebSocket(`${CONFIG.SERVER_URL}/${sid}/peer/${uid}`);
        ws.current.binaryType = 'arraybuffer';

        ws.current.onopen = () => {
            setStatus('connected');
        };

        ws.current.onclose = () => {
            setStatus('disconnected');
        };

        ws.current.onmessage = (event) => {
            if (typeof event.data === 'string') {
                const msg = JSON.parse(event.data);
                handleControlMessage(msg);
            } else {
                handleBinaryData(event.data);
            }
        };
    }, [handleControlMessage, handleBinaryData]);

    const sendFile = async (file) => {
        // Send Header
        const header = createMetadataHeader(file.name, file.size, file.type);
        ws.current.send(header);

        let offset = 0;
        const startTime = Date.now();
        transferState.current.startTime = startTime;

        while (offset < file.size) {
            // Flow control
            while (ws.current.bufferedAmount > CONFIG.MAX_BUFFER) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            const chunk = file.slice(offset, offset + CONFIG.CHUNK_SIZE);
            const buffer = await chunk.arrayBuffer();
            ws.current.send(buffer);

            offset += chunk.size;

            // Update Stats
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = offset / elapsed; // bytes per second
            const progress = Math.min(100, Math.round((offset / file.size) * 100));
            const remainingBytes = file.size - offset;
            const eta = speed > 0 ? remainingBytes / speed : 0;

            setTransferStats({
                speed,
                progress,
                totalBytes: file.size,
                transferredBytes: offset,
                startTime,
                eta
            });
        }
    };

    const sendFilesDirectly = async (files) => {
        if (transferState.current.isTransferring || !files || files.length === 0) return;

        transferState.current.isTransferring = true;

        // Process files directly without queue
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setCurrentTransfer({ name: file.name, size: file.size });
            await sendFile(file);

            // Add to sent files list
            const sentFileInfo = {
                name: file.name,
                size: file.size,
                type: file.type,
                timestamp: new Date().toISOString()
            };
            setSentFiles(prev => [sentFileInfo, ...prev]);
        }

        transferState.current.isTransferring = false;
        setCurrentTransfer(null);
        setTransferStats({ speed: 0, progress: 0, totalBytes: 0, transferredBytes: 0, startTime: null, eta: 0 });
    };

    const startTransfer = async () => {
        if (transferState.current.isTransferring || fileQueue.length === 0) return;

        transferState.current.isTransferring = true;

        // Process queue
        const queueCopy = [...fileQueue];
        for (let i = 0; i < queueCopy.length; i++) {
            const file = queueCopy[i];
            setCurrentTransfer({ name: file.name, size: file.size });
            await sendFile(file);

            // Add to sent files list
            const sentFileInfo = {
                name: file.name,
                size: file.size,
                type: file.type,
                timestamp: new Date().toISOString()
            };
            setSentFiles(prev => [sentFileInfo, ...prev]);

            setFileQueue(prev => prev.slice(1)); // Remove sent file
        }

        transferState.current.isTransferring = false;
        setCurrentTransfer(null);
        setTransferStats({ speed: 0, progress: 0, totalBytes: 0, transferredBytes: 0, startTime: null, eta: 0 });
    };

    const addToQueue = (files) => {
        setFileQueue(prev => [...prev, ...files]);
    };

    const removeFromQueue = (index) => {
        setFileQueue(prev => prev.filter((_, i) => i !== index));
    };

    const sendMessage = useCallback((message) => {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
            console.error('WebSocket is not connected');
            return;
        }

        ws.current.send(JSON.stringify({
            type: 'chat',
            message: message,
            timestamp: new Date().toISOString()
        }));

        // Add message to local state
        setMessages(prev => [...prev, {
            type: 'text',
            sender: userId,
            content: message,
            timestamp: new Date().toISOString()
        }]);
    }, [userId]);

    const sendSignal = useCallback((type, data) => {
        if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
            console.error('WebSocket is not connected');
            return;
        }

        ws.current.send(JSON.stringify({
            type: type,
            data: data
        }));
    }, []);

    const setVideoSignalHandler = useCallback((handler) => {
        videoSignalHandler.current = handler;
    }, []);

    return {
        status,
        sessionId,
        userId,
        messages,
        fileQueue,
        currentTransfer,
        transferStats,
        receivedFiles,
        sentFiles,
        connect,
        sendMessage,
        sendSignal,
        setVideoSignalHandler,
        setSessionId,
        addToQueue,
        removeFromQueue,
        startTransfer,
        sendFilesDirectly
    };
}
