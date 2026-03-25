import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef
} from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import api from '../utils/api';

const ChatContext = createContext(null);

// Notification sound (short beep encoded as base64 data URI)
function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Audio not available
  }
}

function sendBrowserNotif(title, body) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '⚡',
      tag: 'nexus-chat',
    });
  }
}

export function ChatProvider({ children }) {
  const { user }  = useAuth();
  const { socket } = useSocket();

  const [rooms, setRooms]           = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [messages, setMessages]     = useState({});   // roomId → Message[]
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingUsers, setTypingUsers] = useState({});  // roomId → { userId: username }
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingMsgs,  setLoadingMsgs]  = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({}); // roomId → count
  const [totalUnread, setTotalUnread]   = useState(0);
  const [mutedRooms, setMutedRooms]     = useState(new Set());
  const [roomsError, setRoomsError]     = useState(null); // surface fetch errors
  const typingTimers = useRef({});
  const activeRoomRef = useRef(null);

  // Keep activeRoomRef in sync
  useEffect(() => { activeRoomRef.current = activeRoom; }, [activeRoom]);

  // Request notification permission
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Update document title with unread count
  useEffect(() => {
    document.title = totalUnread > 0
      ? `(${totalUnread}) Nexus Chat`
      : 'Nexus Chat';
  }, [totalUnread]);

  /* ---------- load rooms ---------- */
  const fetchRooms = useCallback(async () => {
    if (!user) return;
    setLoadingRooms(true);
    setRoomsError(null);
    try {
      const { data } = await api.get('/api/rooms/');
      setRooms(data);
      // seed online from is_online flag
      const online = new Set();
      data.forEach(r => r.members?.forEach(m => { if (m.isOnline) online.add(m.id); }));
      setOnlineUsers(online);
      // seed unread counts
      const counts = {};
      let total = 0;
      const muted = new Set();
      data.forEach(r => {
        counts[r.id] = r.unreadCount || 0;
        total += (r.unreadCount || 0);
        if (r.isMuted) muted.add(r.id);
      });
      setUnreadCounts(counts);
      setTotalUnread(total);
      setMutedRooms(muted);
    } catch (err) {
      console.error('[fetchRooms] failed:', err?.response?.data || err.message);
      setRoomsError(err?.response?.data?.error || 'Failed to load rooms');
    } finally {
      setLoadingRooms(false);
    }
  }, [user]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  /* ---------- load messages for a room ---------- */
  const fetchMessages = useCallback(async (roomId, page = 1) => {
    setLoadingMsgs(true);
    try {
      const { data } = await api.get(`/api/messages/room/${roomId}?page=${page}&perPage=50`);
      setMessages(prev => ({
        ...prev,
        [roomId]: page === 1 ? data.messages : [...data.messages, ...(prev[roomId] || [])],
      }));
      return data;
    } catch (err) {
      console.error('[fetchMessages] failed:', err?.response?.data || err.message);
      return null;
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  const selectRoom = useCallback((room) => {
    setActiveRoom(room);
    if (room && !messages[room.id]) fetchMessages(room.id);
    if (room && socket) socket.emit('join_room', { roomId: room.id });
    // Clear unread for selected room
    if (room) {
      setUnreadCounts(prev => {
        const newCounts = { ...prev, [room.id]: 0 };
        const total = Object.values(newCounts).reduce((a, b) => a + b, 0);
        setTotalUnread(total);
        return newCounts;
      });
    }
  }, [messages, fetchMessages, socket]);

  /* ---------- socket events ---------- */
  useEffect(() => {
    if (!socket) return;

    const onNewMessage = (msg) => {
      setMessages(prev => ({
        ...prev,
        [msg.roomId]: [...(prev[msg.roomId] || []), msg],
      }));
      // bump room to top
      setRooms(prev => {
        const idx = prev.findIndex(r => r.id === msg.roomId);
        if (idx === -1) return prev;
        const updated = [...prev];
        const [room] = updated.splice(idx, 1);
        return [{ ...room, lastMessage: msg }, ...updated];
      });
      // Unread count (if not the active room or not from self)
      if (msg.senderId !== user?.id) {
        const isActive = activeRoomRef.current?.id === msg.roomId;
        const isMuted = mutedRooms.has(msg.roomId);
        if (!isActive) {
          setUnreadCounts(prev => {
            const newCounts = { ...prev, [msg.roomId]: (prev[msg.roomId] || 0) + 1 };
            setTotalUnread(Object.values(newCounts).reduce((a, b) => a + b, 0));
            return newCounts;
          });
        }
        // Play sound + browser notification (unless muted)
        if (!isMuted) {
          playNotifSound();
          const senderName = msg.sender?.username || 'Someone';
          sendBrowserNotif(senderName, msg.content?.slice(0, 100) || 'New message');
        }
      }
    };

    const onMessageUpdated = (msg) => {
      setMessages(prev => ({
        ...prev,
        [msg.roomId]: (prev[msg.roomId] || []).map(m => m.id === msg.id ? msg : m),
      }));
    };

    const onReactionUpdated = (msg) => {
      setMessages(prev => ({
        ...prev,
        [msg.roomId]: (prev[msg.roomId] || []).map(m => m.id === msg.id ? { ...m, reactions: msg.reactions } : m),
      }));
    };

    const onUserOnline = ({ userId }) => setOnlineUsers(prev => new Set([...prev, userId]));
    const onUserOffline = ({ userId }) => setOnlineUsers(prev => { const s = new Set(prev); s.delete(userId); return s; });

    const onUserStatusUpdated = ({ userId, statusText, statusEmoji }) => {
      // Update status in all room member lists
      setRooms(prev => prev.map(room => ({
        ...room,
        members: room.members?.map(m =>
          m.id === userId ? { ...m, statusText, statusEmoji } : m
        ),
      })));
    };

    const onUserTyping = ({ userId, username, roomId }) => {
      setTypingUsers(prev => ({
        ...prev,
        [roomId]: { ...(prev[roomId] || {}), [userId]: username },
      }));
      // auto-clear after 3s
      if (typingTimers.current[`${roomId}-${userId}`])
        clearTimeout(typingTimers.current[`${roomId}-${userId}`]);
      typingTimers.current[`${roomId}-${userId}`] = setTimeout(() => {
        setTypingUsers(prev => {
          const room = { ...(prev[roomId] || {}) };
          delete room[userId];
          return { ...prev, [roomId]: room };
        });
      }, 3000);
    };

    const onUserStoppedTyping = ({ userId, roomId }) => {
      setTypingUsers(prev => {
        const room = { ...(prev[roomId] || {}) };
        delete room[userId];
        return { ...prev, [roomId]: room };
      });
    };

    const onReadReceipt = ({ messageId, userId, roomId }) => {
      setMessages(prev => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map(m =>
          m.id === messageId
            ? { ...m, readBy: [...new Set([...(m.readBy || []), userId])] }
            : m
        ),
      }));
    };

    const onMessagePinned = ({ messageId, roomId }) => {
      setMessages(prev => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map(m =>
          m.id === messageId ? { ...m, isPinned: true } : m
        ),
      }));
    };

    const onMessageUnpinned = ({ messageId, roomId }) => {
      setMessages(prev => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map(m =>
          m.id === messageId ? { ...m, isPinned: false } : m
        ),
      }));
    };

    socket.on('new_message',         onNewMessage);
    socket.on('message_updated',     onMessageUpdated);
    socket.on('reaction_updated',    onReactionUpdated);
    socket.on('user_online',         onUserOnline);
    socket.on('user_offline',        onUserOffline);
    socket.on('user_typing',         onUserTyping);
    socket.on('user_stopped_typing', onUserStoppedTyping);
    socket.on('read_receipt',        onReadReceipt);
    socket.on('message_pinned',      onMessagePinned);
    socket.on('message_unpinned',    onMessageUnpinned);
    socket.on('user_status_updated', onUserStatusUpdated);

    return () => {
      socket.off('new_message',         onNewMessage);
      socket.off('message_updated',     onMessageUpdated);
      socket.off('reaction_updated',    onReactionUpdated);
      socket.off('user_online',         onUserOnline);
      socket.off('user_offline',        onUserOffline);
      socket.off('user_typing',         onUserTyping);
      socket.off('user_stopped_typing', onUserStoppedTyping);
      socket.off('read_receipt',        onReadReceipt);
      socket.off('message_pinned',      onMessagePinned);
      socket.off('message_unpinned',    onMessageUnpinned);
      socket.off('user_status_updated', onUserStatusUpdated);
    };
  }, [socket, user?.id, mutedRooms]);

  /* ---------- send message ---------- */
  const sendMessage = useCallback((roomId, content, replyToId = null, extra = {}) => {
    if (!socket) return;
    socket.emit('send_message', { roomId, content, replyToId, messageType: 'text', ...extra });
  }, [socket]);

  const editMessage = useCallback((messageId, content) => {
    if (!socket) return;
    socket.emit('edit_message', { messageId, content });
  }, [socket]);

  const deleteMessage = useCallback((messageId) => {
    if (!socket) return;
    socket.emit('delete_message', { messageId });
  }, [socket]);

  const markRead = useCallback((messageId) => {
    if (!socket) return;
    socket.emit('mark_read', { messageId });
  }, [socket]);

  const sendTyping = useCallback((roomId, isTyping) => {
    if (!socket) return;
    socket.emit(isTyping ? 'typing_start' : 'typing_stop', { roomId });
  }, [socket]);

  const addReaction = useCallback((messageId, emoji) => {
    if (!socket) return;
    socket.emit('add_reaction', { messageId, emoji });
  }, [socket]);

  const removeReaction = useCallback((messageId, emoji) => {
    if (!socket) return;
    socket.emit('remove_reaction', { messageId, emoji });
  }, [socket]);

  const createRoom = useCallback(async (payload) => {
    const { data } = await api.post('/api/rooms/', payload);
    setRooms(prev => {
      if (prev.find(r => r.id === data.id)) return prev;
      return [data, ...prev];
    });
    return data;
  }, []);

  /* ---------- Pin / Unpin ---------- */
  const pinMessage = useCallback((messageId) => {
    if (!socket) return;
    socket.emit('pin_message', { messageId });
  }, [socket]);

  const unpinMessage = useCallback((messageId) => {
    if (!socket) return;
    socket.emit('unpin_message', { messageId });
  }, [socket]);

  /* ---------- Star / Unstar ---------- */
  const starMessage = useCallback(async (messageId) => {
    await api.post(`/api/messages/${messageId}/star`);
    setMessages(prev => {
      const updated = {};
      for (const [rid, msgs] of Object.entries(prev)) {
        updated[rid] = msgs.map(m => m.id === messageId ? { ...m, isStarred: true } : m);
      }
      return updated;
    });
  }, []);

  const unstarMessage = useCallback(async (messageId) => {
    await api.post(`/api/messages/${messageId}/unstar`);
    setMessages(prev => {
      const updated = {};
      for (const [rid, msgs] of Object.entries(prev)) {
        updated[rid] = msgs.map(m => m.id === messageId ? { ...m, isStarred: false } : m);
      }
      return updated;
    });
  }, []);

  /* ---------- Forward ---------- */
  const forwardMessage = useCallback((messageId, targetRoomId) => {
    if (!socket) return;
    socket.emit('forward_message', { messageId, roomId: targetRoomId });
  }, [socket]);

  /* ---------- Mute / Unmute ---------- */
  const muteRoom = useCallback(async (roomId) => {
    await api.post(`/api/rooms/${roomId}/mute`);
    setMutedRooms(prev => new Set([...prev, roomId]));
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, isMuted: true } : r));
  }, []);

  const unmuteRoom = useCallback(async (roomId) => {
    await api.post(`/api/rooms/${roomId}/unmute`);
    setMutedRooms(prev => { const s = new Set(prev); s.delete(roomId); return s; });
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, isMuted: false } : r));
  }, []);

  /* ---------- Kick Member ---------- */
  const kickMember = useCallback(async (roomId, userId) => {
    const { data } = await api.post(`/api/rooms/${roomId}/kick`, { userId });
    setRooms(prev => prev.map(r => r.id === roomId ? data : r));
    if (activeRoom?.id === roomId) setActiveRoom(data);
    return data;
  }, [activeRoom]);

  /* ---------- Leave Room ---------- */
  const leaveRoom = useCallback(async (roomId) => {
    await api.post(`/api/rooms/${roomId}/leave`);
    setRooms(prev => prev.filter(r => r.id !== roomId));
    if (activeRoom?.id === roomId) setActiveRoom(null);
    if (socket) socket.emit('leave_room', { roomId });
  }, [activeRoom, socket]);

  /* ---------- Add Member ---------- */
  const addMember = useCallback(async (roomId, userId) => {
    const { data } = await api.post(`/api/rooms/${roomId}/members`, { userId });
    setRooms(prev => prev.map(r => r.id === roomId ? data : r));
    if (activeRoom?.id === roomId) setActiveRoom(data);
    return data;
  }, [activeRoom]);

  /* ---------- Update Profile ---------- */
  const updateProfile = useCallback(async (payload) => {
    const { data } = await api.patch('/api/users/me', payload);
    return data;
  }, []);

  return (
    <ChatContext.Provider value={{
      rooms, fetchRooms, loadingRooms, roomsError,
      activeRoom, selectRoom,
      messages, fetchMessages, loadingMsgs,
      onlineUsers,
      typingUsers,
      unreadCounts, totalUnread,
      mutedRooms, muteRoom, unmuteRoom,
      sendMessage, editMessage, deleteMessage,
      markRead, sendTyping,
      addReaction, removeReaction,
      createRoom, leaveRoom, addMember,
      pinMessage, unpinMessage,
      starMessage, unstarMessage,
      forwardMessage,
      kickMember,
      updateProfile,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChat = () => useContext(ChatContext);
