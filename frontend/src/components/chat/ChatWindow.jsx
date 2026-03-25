import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { useTyping } from '../../hooks/useTyping';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import MessageBubble from './MessageBubble';
import EmojiPicker from './EmojiPicker';
import SearchOverlay from './SearchOverlay';
import RoomInfoDrawer from './RoomInfoDrawer';
import PinnedPanel from './PinnedPanel';
import ForwardModal from './ForwardModal';
import MediaGallery from './MediaGallery';
import styles from './ChatWindow.module.css';
import api from '../../utils/api';

function formatDateSeparator(date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export default function ChatWindow() {
  const { user } = useAuth();
  const { connected } = useSocket();
  const {
    activeRoom, messages, loadingMsgs, fetchMessages,
    sendMessage, onlineUsers, typingUsers,
    muteRoom, unmuteRoom, mutedRooms,
  } = useChat();

  const [input, setInput]             = useState('');
  const [replyTo, setReplyTo]         = useState(null);
  const [editMsg, setEditMsg]         = useState(null);
  const [hasMore, setHasMore]         = useState(false);
  const [page, setPage]               = useState(1);
  const [showEmoji, setShowEmoji]     = useState(false);
  const [showSearch, setShowSearch]   = useState(false);
  const [showRoomInfo, setShowRoomInfo] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showPins, setShowPins]       = useState(false);
  const [showForward, setShowForward] = useState(null); // message to forward
  const [showGallery, setShowGallery] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [isDragging, setIsDragging]   = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionResults, setMentionResults] = useState([]);
  const [mentionIdx, setMentionIdx]   = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const messagesRef = useRef(null);
  const fileInputRef = useRef(null);
  const { onKeyPress, stopTyping } = useTyping(activeRoom?.id);

  const roomMessages = activeRoom ? (messages[activeRoom.id] || []) : [];

  /* Auto-scroll on new messages */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomMessages.length]);

  /* Fetch on room change */
  useEffect(() => {
    if (!activeRoom) return;
    setPage(1);
    setHasMore(false);
    setShowSearch(false);
    setShowRoomInfo(false);
    setShowPins(false);
    setShowGallery(false);
    fetchMessages(activeRoom.id, 1).then(d => {
      if (d) setHasMore(d.pages > 1);
    });
    inputRef.current?.focus();
  }, [activeRoom?.id]); // eslint-disable-line

  /* Track scroll position for scroll-to-bottom button */
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    const onScroll = () => {
      const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(fromBottom > 200);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [activeRoom?.id]);

  /* Keyboard shortcuts */
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (activeRoom) setShowSearch(s => !s);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activeRoom]);

  const loadMore = async () => {
    const next = page + 1;
    const d = await fetchMessages(activeRoom.id, next);
    if (d) { setPage(next); setHasMore(next < d.pages); }
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  /* ---------- @Mention Detection ---------- */
  const checkMention = useCallback((text, cursorPos) => {
    const beforeCursor = text.slice(0, cursorPos);
    const match = beforeCursor.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionIdx(0);
      // Search from room members
      const q = match[1].toLowerCase();
      const members = (activeRoom?.members || []).filter(
        m => m.id !== user.id && m.username.toLowerCase().includes(q)
      );
      setMentionResults(members.slice(0, 8));
    } else {
      setMentionQuery(null);
      setMentionResults([]);
    }
  }, [activeRoom, user]);

  const insertMention = (memberUsername) => {
    const textarea = inputRef.current;
    if (!textarea) return;
    const pos = textarea.selectionStart;
    const before = input.slice(0, pos);
    const after = input.slice(pos);
    const mentionStart = before.lastIndexOf('@');
    const newText = before.slice(0, mentionStart) + `@${memberUsername} ` + after;
    setInput(newText);
    setMentionQuery(null);
    setMentionResults([]);
    setTimeout(() => {
      const newPos = mentionStart + memberUsername.length + 2;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    }, 0);
  };

  /* Auto-resize textarea */
  const handleInputChange = (e) => {
    setInput(e.target.value);
    onKeyPress();
    // Auto resize
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
    // Check for @mention
    checkMention(e.target.value, e.target.selectionStart);
  };

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || !activeRoom) return;
    if (editMsg) {
      stopTyping();
      setEditMsg(null);
      setInput('');
      return;
    }
    sendMessage(activeRoom.id, text, replyTo?.id || null);
    setInput('');
    setReplyTo(null);
    stopTyping();
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }, [input, activeRoom, editMsg, replyTo, sendMessage, stopTyping]);

  const handleKeyDown = (e) => {
    // Mention navigation
    if (mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIdx(i => Math.min(i + 1, mentionResults.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        insertMention(mentionResults[mentionIdx].username);
        return;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        setMentionResults([]);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji) => {
    setInput(prev => prev + emoji);
    inputRef.current?.focus();
  };

  /* ---------- File Upload ---------- */
  const handleFileSelect = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingFile({
        data: reader.result,
        name: file.name,
        size: file.size,
        type: file.type,
        isImage: file.type.startsWith('image/'),
      });
    };
    reader.readAsDataURL(file);
  };

  const sendFile = async () => {
    if (!pendingFile || !activeRoom) return;
    const msgType = pendingFile.isImage ? 'image' : 'file';
    try {
      const { data } = await api.post('/api/messages/upload', {
        roomId: activeRoom.id,
        fileData: pendingFile.data,
        fileName: pendingFile.name,
        fileSize: pendingFile.size,
        messageType: msgType,
      });
      // The new_message socket event will pick it up
    } catch {}
    setPendingFile(null);
  };

  /* ---------- Drag & Drop ---------- */
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  /* ---------- Voice Recording ---------- */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            await api.post('/api/messages/upload', {
              roomId: activeRoom.id,
              fileData: reader.result,
              fileName: 'voice_message.webm',
              fileSize: blob.size,
              messageType: 'voice',
            });
          } catch {}
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      // Mic not available
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const typingList = activeRoom
    ? Object.values(typingUsers[activeRoom.id] || {})
    : [];

  const otherUser = activeRoom?.isPrivate ? activeRoom.otherUser : null;
  const isOtherOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
  const isMuted = activeRoom ? mutedRooms.has(activeRoom.id) : false;

  if (!activeRoom) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyInner}>
          <span className={styles.emptyIcon}>⚡</span>
          <h2>Select a conversation</h2>
          <p>Pick a room from the sidebar or start a new chat</p>
          <div className={styles.emptyHint}>
            <kbd>Ctrl</kbd> + <kbd>K</kbd> to search &nbsp;•&nbsp; <kbd>?</kbd> for shortcuts
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={styles.window}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop zone overlay */}
      {isDragging && (
        <div className={styles.dropZone}>
          <div className={styles.dropZoneInner}>
            <span>📎</span>
            <p>Drop file to upload</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <img
            src={activeRoom.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${activeRoom.name}`}
            alt={activeRoom.name}
            className={styles.headerAvatar}
          />
          <div>
            <div className={styles.headerName}>{activeRoom.name}</div>
            <div className={styles.headerSub}>
              {activeRoom.isPrivate
                ? (isOtherOnline ? '🟢 Online' : '⚫ Offline')
                : `${activeRoom.memberCount} members`}
            </div>
          </div>
        </div>
        <div className={styles.headerRight}>
          {!connected && <span className={styles.offlineBanner}>Reconnecting…</span>}
          <button
            className={styles.iconBtn}
            onClick={() => isMuted ? unmuteRoom(activeRoom.id) : muteRoom(activeRoom.id)}
            title={isMuted ? 'Unmute' : 'Mute notifications'}
          >
            {isMuted ? '🔇' : '🔔'}
          </button>
          <button
            className={`${styles.iconBtn} ${styles.pinBadge}`}
            onClick={() => setShowPins(s => !s)}
            title="Pinned messages"
          >
            📌
            {(activeRoom.pinnedCount > 0) && (
              <span className={styles.pinCount}>{activeRoom.pinnedCount}</span>
            )}
          </button>
          <button
            className={styles.iconBtn}
            onClick={() => setShowGallery(true)}
            title="Media gallery"
          >
            🖼️
          </button>
          <button
            className={styles.iconBtn}
            onClick={() => setShowSearch(s => !s)}
            title="Search messages (Ctrl+K)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <button
            className={styles.iconBtn}
            onClick={() => setShowRoomInfo(true)}
            title="Room info"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Pinned panel */}
      {showPins && (
        <PinnedPanel roomId={activeRoom.id} onClose={() => setShowPins(false)} />
      )}

      {/* Search overlay */}
      {showSearch && (
        <SearchOverlay
          roomId={activeRoom.id}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Messages */}
      <div className={styles.messages} ref={messagesRef}>
        {hasMore && (
          <button className={styles.loadMore} onClick={loadMore} disabled={loadingMsgs}>
            {loadingMsgs ? 'Loading…' : '↑ Load earlier messages'}
          </button>
        )}

        {roomMessages.length === 0 && !loadingMsgs && (
          <div className={styles.startMsg}>
            This is the beginning of your conversation with{' '}
            <strong>{activeRoom.name}</strong>. Say hi! 👋
          </div>
        )}

        {roomMessages.map((msg, idx) => {
          const prev = roomMessages[idx - 1];
          const showAvatar = !prev || prev.senderId !== msg.senderId;
          const msgDate = msg.createdAt ? new Date(msg.createdAt) : null;
          const prevDate = prev?.createdAt ? new Date(prev.createdAt) : null;
          const showDateSep = msgDate && (!prevDate || !isSameDay(msgDate, prevDate));

          return (
            <div key={msg.id}>
              {showDateSep && (
                <div className={styles.dateSeparator}>
                  <span>{formatDateSeparator(msgDate)}</span>
                </div>
              )}
              <MessageBubble
                msg={msg}
                isMine={msg.senderId === user.id}
                showAvatar={showAvatar}
                onReply={setReplyTo}
                onEdit={setEditMsg}
                onForward={setShowForward}
              />
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingList.length > 0 && (
          <div className={styles.typing}>
            <div className={styles.typingDots}>
              <span /><span /><span />
            </div>
            <span>
              {typingList.slice(0, 2).join(', ')}
              {typingList.length > 2 ? ` +${typingList.length - 2}` : ''}
              {' '}
              {typingList.length === 1 ? 'is' : 'are'} typing…
            </span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button className={styles.scrollBtn} onClick={scrollToBottom}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      )}

      {/* Reply banner */}
      {replyTo && (
        <div className={styles.replyBanner}>
          <div className={styles.replyContent}>
            <span className={styles.replyLabel}>Replying to {replyTo.sender?.username}</span>
            <span className={styles.replyText}>{replyTo.content?.slice(0, 80)}</span>
          </div>
          <button className={styles.replyClose} onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      {/* File preview */}
      {pendingFile && (
        <div className={styles.filePreview}>
          {pendingFile.isImage && (
            <img src={pendingFile.data} alt="" className={styles.filePreviewImg} />
          )}
          <div className={styles.filePreviewInfo}>
            <span className={styles.filePreviewName}>{pendingFile.name}</span>
            <span className={styles.filePreviewSize}>{formatFileSize(pendingFile.size)}</span>
          </div>
          <button className={styles.sendBtn} onClick={sendFile} style={{width:32,height:32,borderRadius:8,fontSize:'0.8rem'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
          <button className={styles.filePreviewClose} onClick={() => setPendingFile(null)}>✕</button>
        </div>
      )}

      {/* Input */}
      <div className={styles.inputRow} style={{position:'relative'}}>
        <div className={styles.inputActions}>
          <div className={styles.emojiWrap}>
            <button
              className={styles.emojiBtn}
              onClick={() => setShowEmoji(!showEmoji)}
              title="Emoji"
            >
              😊
            </button>
            {showEmoji && (
              <EmojiPicker
                onSelect={insertEmoji}
                onClose={() => setShowEmoji(false)}
              />
            )}
          </div>
          <button
            className={styles.attachBtn}
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className={styles.attachInput}
            onChange={e => handleFileSelect(e.target.files[0])}
          />
        </div>

        {/* @Mention dropdown */}
        {mentionResults.length > 0 && (
          <div className={styles.mentionDropdown}>
            {mentionResults.map((m, i) => (
              <button
                key={m.id}
                className={`${styles.mentionItem} ${i === mentionIdx ? styles.mentionActive : ''}`}
                onClick={() => insertMention(m.username)}
              >
                <img
                  src={m.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${m.username}`}
                  alt={m.username}
                  className={styles.mentionAvatar}
                />
                <span className={styles.mentionName}>@{m.username}</span>
              </button>
            ))}
          </div>
        )}

        <textarea
          ref={inputRef}
          className={styles.input}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${activeRoom.name}… (use @to mention)`}
          rows={1}
        />

        {/* Voice recording button */}
        <button
          className={`${styles.voiceBtn} ${isRecording ? styles.recording : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? 'Stop recording' : 'Record voice message'}
        >
          {isRecording ? '⏹️' : '🎤'}
        </button>

        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!input.trim() || !connected}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
      </div>

      {/* Room Info Drawer */}
      {showRoomInfo && (
        <RoomInfoDrawer
          room={activeRoom}
          onClose={() => setShowRoomInfo(false)}
        />
      )}

      {/* Forward Modal */}
      {showForward && (
        <ForwardModal
          message={showForward}
          onClose={() => setShowForward(null)}
        />
      )}

      {/* Media Gallery */}
      {showGallery && (
        <MediaGallery
          roomId={activeRoom.id}
          onClose={() => setShowGallery(false)}
        />
      )}
    </div>
  );
}
