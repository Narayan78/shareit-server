import asyncio
import json
import time
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ...services.session_manager import session_manager, TransferSession
from ...core.logging import logger
from ...core.config import settings

router = APIRouter()

@router.websocket("/ws/{session_id}/{mode}/{user_id}")
async def ws_transfer(websocket: WebSocket, session_id: str, mode: str, user_id: str):
    await websocket.accept()
    logger.info(f"Connection: User={user_id}, Mode={mode}, Session={session_id}")

    # Rate limiting check (simplified for now, can be expanded)
    if session_manager.connection_counts.get(user_id, 0) >= 5:
        await websocket.send_json({"status": "error", "message": "Too many connections"})
        await websocket.close()
        return

    session_manager.connection_counts[user_id] = session_manager.connection_counts.get(user_id, 0) + 1

    # Session capacity check
    if len(session_manager.sessions) >= settings.MAX_SESSIONS and session_id not in session_manager.sessions:
        await websocket.send_json({"status": "error", "message": "Server at capacity"})
        await websocket.close()
        session_manager.connection_counts[user_id] -= 1
        return

    # Create or get session
    session = session_manager.create_session(session_id)
    session.update_activity()

    try:
        if mode == "sender":
            await handle_sender(websocket, session, user_id, session_id)
        elif mode == "receiver":
            await handle_receiver(websocket, session, user_id, session_id)
        elif mode == "peer":
            await handle_peer(websocket, session, user_id, session_id)
        else:
            await websocket.send_json({"status": "error", "message": f"Invalid mode: {mode}"})
            await websocket.close()

    except Exception as e:
        logger.error(f"Error in session {session_id}: {e}", exc_info=True)
        try:
            await websocket.send_json({"status": "error", "message": str(e)})
        except:
            pass
    finally:
        session_manager.connection_counts[user_id] -= 1
        try:
            await websocket.close()
        except:
            pass

async def handle_sender(websocket: WebSocket, session: TransferSession, user_id: str, session_id: str):
    session.sender = websocket
    await websocket.send_json({
        "status": "waiting",
        "message": "Waiting for receiver...",
        "session_id": session_id,
        "timestamp": datetime.now().isoformat()
    })

    # Wait for receiver with timeout
    timeout = 300  # 5 minutes
    start = time.time()
    while not session.receiver and (time.time() - start) < timeout:
        await asyncio.sleep(1)
        session.update_activity()

    if not session.receiver:
        await websocket.send_json({"status": "error", "message": "Receiver timeout"})
        session_manager.remove_session(session_id)
        return

    logger.info(f"Receiver connected for session {session_id}")
    session.is_active = True
    session.start_time = datetime.now()

    await websocket.send_json({
        "status": "ready",
        "message": "Receiver connected. Ready to transfer.",
        "timestamp": datetime.now().isoformat(),
        "chat_history": session.messages
    })

    try:
        last_speed_update = time.time()
        while True:
            data = await websocket.receive()
            
            if "text" in data:
                msg = json.loads(data["text"])
                
                if msg.get("type") == "chat":
                    message_data = session.add_message("sender", msg.get("message", ""))
                    session.update_activity()
                    if session.receiver:
                        await session.receiver.send_json({
                            "type": "chat",
                            "data": message_data
                        })
                    
                elif msg.get("type") == "typing":
                    if session.receiver:
                        await session.receiver.send_json({
                            "type": "typing",
                            "sender": "sender"
                        })
                    
                elif msg.get("type") == "pause":
                    session.paused = True
                    if session.receiver:
                        await session.receiver.send_json({"type": "paused"})
                        
                elif msg.get("type") == "resume":
                    session.paused = False
                    if session.receiver:
                        await session.receiver.send_json({"type": "resumed"})
                        
                elif msg.get("type") == "pong":
                    session.update_activity()
                continue

            if "bytes" in data and not session.paused:
                chunk = data["bytes"]
                session.bytes_transferred += len(chunk)
                session.update_activity()

                if session.receiver:
                    await session.receiver.send_bytes(chunk)

                now = time.time()
                if now - last_speed_update > 1.0:
                    speed = session.calculate_speed()
                    await websocket.send_json({
                        "type": "speed_update",
                        "speed": speed,
                        "bytes_transferred": session.bytes_transferred
                    })
                    last_speed_update = now

    except WebSocketDisconnect:
        logger.info(f"Sender disconnected: {user_id}")
    finally:
        session.is_active = False
        session.end_time = datetime.now()
        if session.receiver:
            try:
                await session.receiver.send_json({"type": "transfer_complete"})
                await session.receiver.close()
            except:
                pass
        session_manager.remove_session(session_id)

async def handle_peer(websocket: WebSocket, session: TransferSession, user_id: str, session_id: str):
    """Handle peer-to-peer connection where both users can send and receive"""
    # Add peer to session
    if not hasattr(session, 'peers'):
        session.peers = []
    
    session.peers.append({'user_id': user_id, 'websocket': websocket})
    peer_count = len(session.peers)
    session.update_activity()

    # Notify this peer they're connected
    await websocket.send_json({
        "status": "connected",
        "message": f"Connected to session. {peer_count} peer(s) in session.",
        "user_id": user_id,
        "timestamp": datetime.now().isoformat(),
        "chat_history": session.messages
    })

    # Notify other peers
    for peer in session.peers:
        if peer['user_id'] != user_id:
            try:
                await peer['websocket'].send_json({
                    "status": "peer_joined",
                    "message": "Another peer joined the session",
                    "timestamp": datetime.now().isoformat()
                })
            except:
                pass

    logger.info(f"Peer {user_id} connected to session {session_id}. Total peers: {peer_count}")
    session.is_active = True
    if peer_count == 1:
        session.start_time = datetime.now()

    try:
        last_speed_update = time.time()
        while True:
            data = await websocket.receive()
            
            if "text" in data:
                msg = json.loads(data["text"])
                
                if msg.get("type") == "chat":
                    message_data = session.add_message(user_id, msg.get("message", ""))
                    session.update_activity()
                    # Broadcast to all other peers
                    for peer in session.peers:
                        if peer['user_id'] != user_id:
                            try:
                                await peer['websocket'].send_json({
                                    "type": "chat",
                                    "data": message_data
                                })
                            except:
                                pass
            if "bytes" in data:
                chunk = data["bytes"]
                session.bytes_transferred += len(chunk)
                session.update_activity()

                # Forward to all other peers
                for peer in session.peers:
                    if peer['user_id'] != user_id:
                        try:
                            await peer['websocket'].send_bytes(chunk)
                        except:
                            pass

                # Send speed updates back to sender
                now = time.time()
                if now - last_speed_update > 1.0:
                    speed = session.calculate_speed()
                    await websocket.send_json({
                        "type": "speed_update",
                        "speed": speed,
                        "bytes_transferred": session.bytes_transferred
                    })
                    last_speed_update = now

    except WebSocketDisconnect:
        logger.info(f"Peer {user_id} disconnected from session {session_id}")
    finally:
        # Remove this peer from the session
        if hasattr(session, 'peers'):
            session.peers = [p for p in session.peers if p['user_id'] != user_id]
            
            # Notify remaining peers
            for peer in session.peers:
                try:
                    await peer['websocket'].send_json({
                        "type": "peer_left",
                        "message": "A peer left the session",
                        "timestamp": datetime.now().isoformat()
                    })
                except:
                    pass
            
            # If no peers left, clean up session
            if len(session.peers) == 0:
                session.is_active = False
                session.end_time = datetime.now()
                session_manager.remove_session(session_id)

async def handle_receiver(websocket: WebSocket, session: TransferSession, user_id: str, session_id: str):
    session.receiver = websocket
    session.update_activity()

    await websocket.send_json({
        "status": "connected",
        "message": "Connected to sender",
        "metadata": session.metadata,
        "timestamp": datetime.now().isoformat(),
        "chat_history": session.messages
    })

    if session.sender:
        try:
            await session.sender.send_json({
                "status": "receiver_connected",
                "message": "Receiver connected",
                "timestamp": datetime.now().isoformat()
            })
        except:
            pass

    try:
        while True:
            data = await websocket.receive()
            
            if "text" in data:
                msg = json.loads(data["text"])
                
                if msg.get("type") == "chat":
                    message_data = session.add_message("receiver", msg.get("message", ""))
                    session.update_activity()
                    if session.sender:
                        await session.sender.send_json({
                            "type": "chat",
                            "data": message_data
                        })
                    
                elif msg.get("type") == "typing":
                    if session.sender:
                        await session.sender.send_json({
                            "type": "typing",
                            "sender": "receiver"
                        })
                    
                elif msg.get("type") == "pong":
                    session.update_activity()
            
            await asyncio.sleep(0.1)
            
    except WebSocketDisconnect:
        logger.info(f"Receiver disconnected: {user_id}")
        session.receiver = None
