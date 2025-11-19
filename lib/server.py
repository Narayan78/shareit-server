"""
Enhanced File Transfer Mediator Server
Production-ready version with improved error handling and monitoring
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Optional, Dict, Any
import signal
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('mediator.log')
    ]
)
logger = logging.getLogger(__name__)


class TransferSession:
    """Represents a file transfer session"""
    def __init__(self, session_id: str, metadata: Dict[str, Any]):
        self.session_id = session_id
        self.metadata = metadata
        self.sender = None
        self.receiver = None
        self.created_at = datetime.now()
        self.bytes_transferred = 0
        self.is_active = False
        self.completed_at = None


class FileTransferMediator:
    def __init__(self, host='0.0.0.0', port=8888, max_sessions=100):
        self.host = host
        self.port = port
        self.max_sessions = max_sessions
        self.sessions: Dict[str, TransferSession] = {}
        self.active_connections = 0
        self.total_transfers = 0
        self.total_bytes = 0
        self.server = None
        
    async def handle_client(self, reader, writer):
        """Handle individual client connection with comprehensive error handling"""
        addr = writer.get_extra_info('peername')
        self.active_connections += 1
        logger.info(f"[{self.active_connections}] New connection from {addr}")
        
        try:
            # Receive handshake with timeout
            data = await asyncio.wait_for(reader.read(8192), timeout=30)
            if not data:
                logger.warning(f"Empty data from {addr}")
                return
                
            try:
                handshake = json.loads(data.decode('utf-8'))
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON from {addr}: {e}")
                await self.send_error(writer, "Invalid handshake format")
                return
                
            # Validate handshake
            required_fields = ['user_id', 'mode', 'session_id']
            if not all(field in handshake for field in required_fields):
                await self.send_error(writer, "Missing required fields")
                return
                
            user_id = handshake['user_id']
            mode = handshake['mode']
            session_id = handshake['session_id']
            
            logger.info(f"Handshake: User={user_id}, Mode={mode}, Session={session_id}")
            
            # Route to appropriate handler
            if mode == 'sender':
                await self.handle_sender(user_id, session_id, reader, writer, handshake)
            elif mode == 'receiver':
                await self.handle_receiver(user_id, session_id, reader, writer, handshake)
            else:
                await self.send_error(writer, f"Invalid mode: {mode}")
                
        except asyncio.TimeoutError:
            logger.warning(f"Handshake timeout from {addr}")
            await self.send_error(writer, "Handshake timeout")
        except ConnectionResetError:
            logger.warning(f"Connection reset by {addr}")
        except Exception as e:
            logger.error(f"Error handling client {addr}: {e}", exc_info=True)
            await self.send_error(writer, "Internal server error")
        finally:
            self.active_connections -= 1
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass
                
    async def handle_sender(self, user_id: str, session_id: str, 
                          reader, writer, handshake: Dict):
        """Handle sender connection"""
        try:
            # Check session limit
            if len(self.sessions) >= self.max_sessions:
                await self.send_error(writer, "Server at capacity")
                return
                
            # Create or update session
            if session_id not in self.sessions:
                session = TransferSession(session_id, handshake.get('metadata', {}))
                self.sessions[session_id] = session
                logger.info(f"Created session {session_id}")
            else:
                session = self.sessions[session_id]
                
            session.sender = {'id': user_id, 'writer': writer, 'reader': reader}
            
            # Notify sender
            response = {
                'status': 'waiting',
                'message': 'Session created. Waiting for receiver...',
                'session_id': session_id,
                'timestamp': datetime.now().isoformat()
            }
            await self.send_json(writer, response)
            
            # Wait for receiver (5 minutes timeout)
            receiver_connected = await self.wait_for_receiver(session_id, timeout=300)
            
            if not receiver_connected:
                await self.send_error(writer, "Receiver connection timeout")
                del self.sessions[session_id]
                return
                
            # Start transfer
            if session.receiver:
                await self.start_transfer(session)
            else:
                await self.send_error(writer, "Receiver not available")
                
        except Exception as e:
            logger.error(f"Error in handle_sender: {e}", exc_info=True)
            await self.send_error(writer, str(e))
            
    async def handle_receiver(self, user_id: str, session_id: str,
                            reader, writer, handshake: Dict):
        """Handle receiver connection"""
        try:
            # Verify session exists
            if session_id not in self.sessions:
                await self.send_error(writer, f"Session {session_id} not found")
                return
                
            session = self.sessions[session_id]
            
            # Check if sender is ready
            if not session.sender:
                await self.send_error(writer, "Sender not ready")
                return
                
            # Add receiver to session
            session.receiver = {'id': user_id, 'writer': writer, 'reader': reader}
            
            # Send metadata to receiver
            response = {
                'status': 'connected',
                'message': 'Connected to sender',
                'metadata': session.metadata,
                'timestamp': datetime.now().isoformat()
            }
            await self.send_json(writer, response)
            
            logger.info(f"Receiver {user_id} joined session {session_id}")
            
            # Notify sender
            sender_notification = {
                'status': 'receiver_connected',
                'message': 'Receiver connected. Starting transfer...',
                'timestamp': datetime.now().isoformat()
            }
            await self.send_json(session.sender['writer'], sender_notification)
            
            # Transfer will be handled by sender's handler
            
        except Exception as e:
            logger.error(f"Error in handle_receiver: {e}", exc_info=True)
            await self.send_error(writer, str(e))
            
    async def wait_for_receiver(self, session_id: str, timeout: int = 300) -> bool:
        """Wait for receiver to connect with timeout"""
        start_time = datetime.now()
        
        while (datetime.now() - start_time).total_seconds() < timeout:
            if session_id not in self.sessions:
                return False
                
            session = self.sessions[session_id]
            if session.receiver:
                return True
                
            await asyncio.sleep(0.5)
            
        return False
        
    async def start_transfer(self, session: TransferSession):
        """Tunnel encrypted data between sender and receiver"""
        if not session.sender or not session.receiver:
            logger.error(f"Cannot start transfer for session {session.session_id}")
            return
            
        sender_reader = session.sender['reader']
        receiver_writer = session.receiver['writer']
        
        logger.info(f"Starting transfer for session {session.session_id}")
        session.is_active = True
        self.total_transfers += 1
        
        chunk_size = 64 * 1024  # 64KB chunks
        start_time = datetime.now()
        last_log_time = start_time
        
        try:
            while True:
                # Read from sender
                try:
                    chunk = await asyncio.wait_for(
                        sender_reader.read(chunk_size),
                        timeout=30
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"Read timeout for session {session.session_id}")
                    break
                    
                if not chunk:
                    logger.info(f"Transfer complete for session {session.session_id}")
                    break
                    
                # Forward to receiver
                try:
                    receiver_writer.write(chunk)
                    await asyncio.wait_for(
                        receiver_writer.drain(),
                        timeout=30
                    )
                except asyncio.TimeoutError:
                    logger.warning(f"Write timeout for session {session.session_id}")
                    break
                    
                session.bytes_transferred += len(chunk)
                self.total_bytes += len(chunk)
                
                # Log progress every 5 seconds
                current_time = datetime.now()
                if (current_time - last_log_time).total_seconds() >= 5:
                    mb_transferred = session.bytes_transferred / (1024 * 1024)
                    duration = (current_time - start_time).total_seconds()
                    speed = mb_transferred / duration if duration > 0 else 0
                    
                    logger.info(
                        f"Session {session.session_id}: "
                        f"{mb_transferred:.2f} MB @ {speed:.2f} MB/s"
                    )
                    last_log_time = current_time
                    
            # Send completion notification
            duration = (datetime.now() - start_time).total_seconds()
            completion = {
                'status': 'complete',
                'bytes_transferred': session.bytes_transferred,
                'duration_seconds': duration,
                'timestamp': datetime.now().isoformat()
            }
            
            try:
                await self.send_json(receiver_writer, completion)
            except Exception as e:
                logger.warning(f"Could not send completion message: {e}")
                
            session.completed_at = datetime.now()
            session.is_active = False
            
            mb_transferred = session.bytes_transferred / (1024 * 1024)
            logger.info(
                f"Session {session.session_id} completed: "
                f"{mb_transferred:.2f} MB in {duration:.2f}s"
            )
            
        except Exception as e:
            logger.error(f"Error during transfer {session.session_id}: {e}", exc_info=True)
        finally:
            # Cleanup
            session.is_active = False
            if session.session_id in self.sessions:
                del self.sessions[session.session_id]
                
    async def send_json(self, writer, data: Dict):
        """Send JSON data to client"""
        try:
            json_data = json.dumps(data).encode('utf-8')
            writer.write(json_data)
            await writer.drain()
        except Exception as e:
            logger.error(f"Error sending JSON: {e}")
            raise
            
    async def send_error(self, writer, message: str):
        """Send error response to client"""
        try:
            response = {
                'status': 'error',
                'message': message,
                'timestamp': datetime.now().isoformat()
            }
            await self.send_json(writer, response)
        except Exception as e:
            logger.error(f"Error sending error message: {e}")
            
    async def cleanup_stale_sessions(self):
        """Remove old inactive sessions"""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                
                current_time = datetime.now()
                stale_sessions = []
                
                for session_id, session in self.sessions.items():
                    age = (current_time - session.created_at).total_seconds()
                    
                    # Remove sessions older than 10 minutes that aren't active
                    if age > 600 and not session.is_active:
                        stale_sessions.append(session_id)
                        
                for session_id in stale_sessions:
                    logger.info(f"Removing stale session {session_id}")
                    del self.sessions[session_id]
                    
            except Exception as e:
                logger.error(f"Error in cleanup: {e}", exc_info=True)
                
    async def stats_reporter(self):
        """Report server statistics periodically"""
        while True:
            try:
                await asyncio.sleep(300)  # Every 5 minutes
                
                active_sessions = sum(1 for s in self.sessions.values() if s.is_active)
                total_mb = self.total_bytes / (1024 * 1024)
                
                logger.info("=" * 60)
                logger.info("SERVER STATISTICS")
                logger.info(f"Active connections: {self.active_connections}")
                logger.info(f"Total sessions: {len(self.sessions)}")
                logger.info(f"Active transfers: {active_sessions}")
                logger.info(f"Completed transfers: {self.total_transfers}")
                logger.info(f"Total data transferred: {total_mb:.2f} MB")
                logger.info("=" * 60)
                
            except Exception as e:
                logger.error(f"Error in stats reporter: {e}", exc_info=True)
                
    async def start(self):
        """Start the mediator server"""
        logger.info("=" * 60)
        logger.info("File Transfer Mediator Server")
        logger.info("=" * 60)
        
        self.server = await asyncio.start_server(
            self.handle_client,
            self.host,
            self.port
        )
        
        addr = self.server.sockets[0].getsockname()
        logger.info(f"🚀 Server running on {addr[0]}:{addr[1]}")
        logger.info(f"📊 Max sessions: {self.max_sessions}")
        logger.info("Ready to tunnel encrypted file transfers!")
        logger.info("=" * 60)
        
        # Start background tasks
        asyncio.create_task(self.cleanup_stale_sessions())
        asyncio.create_task(self.stats_reporter())
        
        async with self.server:
            await self.server.serve_forever()
            
    async def shutdown(self):
        """Gracefully shutdown the server"""
        logger.info("Shutting down server...")
        
        if self.server:
            self.server.close()
            await self.server.wait_closed()
            
        logger.info("Server shutdown complete")


def main():
    """Main entry point with signal handling"""
    mediator = FileTransferMediator(host='0.0.0.0', port=8888, max_sessions=100)
    
    # Setup signal handlers for graceful shutdown
    def signal_handler(sig, frame):
        logger.info(f"Received signal {sig}")
        asyncio.create_task(mediator.shutdown())
        sys.exit(0)
        
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        asyncio.run(mediator.start())
    except KeyboardInterrupt:
        logger.info("Server interrupted by user")
    except Exception as e:
        logger.error(f"Fatal server error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == '__main__':
    main()