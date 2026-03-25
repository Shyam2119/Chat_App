import { useState, useRef, useMemo, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useChat } from '../../context/ChatContext';
import { useAuth } from '../../context/AuthContext';
import styles from './MessageBubble.module.css';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const URL_REGEX = /(https?:\/\/[^\s<]+)/g;
const IMAGE_REGEX = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;

/* ---------- Message formatting ---------- */
function formatContent(text) {
  if (!text) return text;

  // Code blocks (``` ... ```)
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const parts = [];
  let lastIdx = 0;
  let match;

  const tempText = text;
  while ((match = codeBlockRegex.exec(tempText)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'text', content: tempText.slice(lastIdx, match.index) });
    }
    parts.push({ type: 'codeblock', content: match[1].trim() });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < tempText.length) {
    parts.push({ type: 'text', content: tempText.slice(lastIdx) });
  }

  return parts.map((part, i) => {
    if (part.type === 'codeblock') {
      return <pre key={i} className={styles.codeBlock}>{part.content}</pre>;
    }
    return <span key={i}>{formatInline(part.content)}</span>;
  });
}

function formatInline(text) {
  if (!text) return text;
  // Split by URLs, then process inline formatting
  const urlParts = text.split(URL_REGEX);
  return urlParts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={styles.link}>
          {part.length > 50 ? part.slice(0, 47) + '…' : part}
        </a>
      );
    }
    return <span key={i}>{applyInlineFormatting(part)}</span>;
  });
}

function applyInlineFormatting(text) {
  if (!text) return text;
  // Process inline code first, then bold, italic, strikethrough, mentions
  const result = [];
  // Simple regex-based inline formatting
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|@\w+)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }
    const m = match[0];
    if (m.startsWith('`') && m.endsWith('`')) {
      result.push(<code key={match.index} className={styles.code}>{m.slice(1, -1)}</code>);
    } else if (m.startsWith('**') && m.endsWith('**')) {
      result.push(<strong key={match.index}>{m.slice(2, -2)}</strong>);
    } else if (m.startsWith('*') && m.endsWith('*')) {
      result.push(<em key={match.index}>{m.slice(1, -1)}</em>);
    } else if (m.startsWith('~~') && m.endsWith('~~')) {
      result.push(<del key={match.index}>{m.slice(2, -2)}</del>);
    } else if (m.startsWith('@')) {
      result.push(<span key={match.index} className={styles.mention}>{m}</span>);
    }
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }
  return result.length > 0 ? result : text;
}

function getImageUrls(text) {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  return matches.filter(url => IMAGE_REGEX.test(url));
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

export default function MessageBubble({ msg, isMine, showAvatar, onReply, onEdit, onForward }) {
  const { user } = useAuth();
  const {
    editMessage, deleteMessage, markRead,
    addReaction, removeReaction,
    pinMessage, unpinMessage,
    starMessage, unstarMessage,
  } = useChat();
  const [showActions, setShowActions] = useState(false);
  const [isEditing, setIsEditing]     = useState(false);
  const [editVal, setEditVal]         = useState(msg.content);
  const [showReactions, setShowReactions] = useState(false);
  const [copied, setCopied]           = useState(false);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const audioRef = useRef(null);

  const handleEdit = () => {
    if (!editVal.trim() || editVal === msg.content) { setIsEditing(false); return; }
    editMessage(msg.id, editVal.trim());
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (window.confirm('Delete this message?')) deleteMessage(msg.id);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleReaction = (emoji) => {
    const reactions = msg.reactions || {};
    const userReacted = (reactions[emoji] || []).includes(user.id);
    if (userReacted) {
      removeReaction(msg.id, emoji);
    } else {
      addReaction(msg.id, emoji);
    }
    setShowReactions(false);
  };

  const handleStar = () => {
    if (msg.isStarred) {
      unstarMessage(msg.id);
    } else {
      starMessage(msg.id);
    }
  };

  const handlePin = () => {
    if (msg.isPinned) {
      unpinMessage(msg.id);
    } else {
      pinMessage(msg.id);
    }
  };

  const playVoice = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(msg.fileUrl);
      audioRef.current.onended = () => setVoicePlaying(false);
    }
    if (voicePlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setVoicePlaying(false);
    } else {
      audioRef.current.play();
      setVoicePlaying(true);
    }
  };

  const timeStr = msg.createdAt
    ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })
    : '';

  const readCount = (msg.readBy || []).filter(id => id !== user.id).length;
  const reactions = msg.reactions || {};
  const hasReactions = Object.keys(reactions).length > 0;
  const imageUrls = useMemo(() => getImageUrls(msg.isDeleted ? '' : msg.content), [msg.content, msg.isDeleted]);
  const isVoice = msg.messageType === 'voice';
  const isImage = msg.messageType === 'image';
  const isFile = msg.messageType === 'file';
  const isForwarded = msg.messageType === 'forwarded';

  return (
    <div
      className={`${styles.wrap} ${isMine ? styles.mine : styles.theirs}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}
    >
      {/* Avatar (only for others) */}
      {!isMine && showAvatar && (
        <img
          src={msg.sender?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${msg.sender?.username}`}
          alt={msg.sender?.username}
          className={styles.avatar}
        />
      )}
      {!isMine && !showAvatar && <div className={styles.avatarSpacer} />}

      <div className={styles.bubble}>
        {/* Sender name */}
        {!isMine && showAvatar && (
          <div className={styles.senderName}>{msg.sender?.username}</div>
        )}

        {/* Forwarded badge */}
        {isForwarded && (
          <div className={styles.forwardedBadge}>
            ↗ Forwarded{msg.forwardedFrom?.sender ? ` from ${msg.forwardedFrom.sender.username}` : ''}
          </div>
        )}

        {/* Reply quote */}
        {msg.replyTo && (
          <div className={styles.replyQuote}>
            <span className={styles.replyQuoteName}>{msg.replyTo.sender?.username}</span>
            <span className={styles.replyQuoteText}>{msg.replyTo.content?.slice(0, 80)}</span>
          </div>
        )}

        {/* Content */}
        {isEditing ? (
          <div className={styles.editWrap}>
            <textarea
              className={styles.editInput}
              value={editVal}
              onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEdit(); }
                if (e.key === 'Escape') setIsEditing(false);
              }}
              autoFocus
            />
            <div className={styles.editActions}>
              <button onClick={() => setIsEditing(false)} className={styles.editCancel}>Cancel</button>
              <button onClick={handleEdit} className={styles.editSave}>Save</button>
            </div>
          </div>
        ) : (
          <>
            {/* Voice message */}
            {isVoice ? (
              <div className={styles.voicePlayer}>
                <button className={styles.voicePlayBtn} onClick={playVoice}>
                  {voicePlaying ? '⏸' : '▶'}
                </button>
                <div className={styles.voiceWaveform}>
                  {Array.from({length: 20}, (_, i) => (
                    <span key={i} style={{height: `${Math.random() * 100}%`}} />
                  ))}
                </div>
                <span className={styles.voiceDuration}>
                  {formatFileSize(msg.fileSize)}
                </span>
              </div>
            ) : isImage && msg.fileUrl ? (
              /* Image attachment */
              <div className={styles.imageAttachment}>
                <img src={msg.fileUrl} alt={msg.fileName || 'Image'} loading="lazy" />
              </div>
            ) : isFile && msg.fileUrl ? (
              /* File attachment */
              <a href={msg.fileUrl} download={msg.fileName} className={styles.fileAttachment}>
                <span className={styles.fileIcon}>📄</span>
                <div className={styles.fileInfo}>
                  <span className={styles.fileName}>{msg.fileName || 'File'}</span>
                  <span className={styles.fileSize}>{formatFileSize(msg.fileSize)}</span>
                </div>
              </a>
            ) : (
              /* Text content */
              <>
                <div className={`${styles.content} ${msg.isDeleted ? styles.deleted : ''}`}>
                  {msg.isDeleted ? '[Message deleted]' : formatContent(msg.content)}
                </div>
                {/* Inline image preview */}
                {imageUrls.length > 0 && (
                  <div className={styles.imagePreview}>
                    {imageUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt="Shared" className={styles.previewImg} loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Reactions */}
        {hasReactions && (
          <div className={styles.reactionsBar}>
            {Object.entries(reactions).map(([emoji, userIds]) => {
              const myReaction = userIds.includes(user.id);
              return (
                <button
                  key={emoji}
                  className={`${styles.reactionChip} ${myReaction ? styles.myReaction : ''}`}
                  onClick={() => handleReaction(emoji)}
                  title={`${userIds.length} reaction${userIds.length > 1 ? 's' : ''}`}
                >
                  <span>{emoji}</span>
                  <span className={styles.reactionCount}>{userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.time}>{timeStr}</span>
          {msg.isEdited && !msg.isDeleted && <span className={styles.edited}>edited</span>}
          {msg.isStarred && <span className={styles.starBadge}>★</span>}
          {msg.isPinned && <span className={styles.pinBadge}>📌</span>}
          {isMine && !msg.isDeleted && (
            <span className={styles.readReceipt} title={`Read by ${readCount}`}>
              {readCount > 0 ? (
                <svg width="14" height="10" viewBox="0 0 16 10" fill="none">
                  <path d="M1 5l4 4L15 1" stroke="#818cf8" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M6 5l4 4" stroke="#818cf8" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                  <path d="M1 5l4 4L11 1" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {showActions && !msg.isDeleted && (
        <div className={`${styles.actions} ${isMine ? styles.actionsLeft : styles.actionsRight}`}>
          <button className={styles.actionBtn} onClick={() => onReply(msg)} title="Reply">↩</button>
          <button className={styles.actionBtn} onClick={() => setShowReactions(!showReactions)} title="React">😊</button>
          <button className={styles.actionBtn} onClick={handleCopy} title={copied ? 'Copied!' : 'Copy'}>
            {copied ? '✓' : '📋'}
          </button>
          <button className={styles.actionBtn} onClick={handleStar} title={msg.isStarred ? 'Unstar' : 'Star'}>
            {msg.isStarred ? '★' : '☆'}
          </button>
          <button className={styles.actionBtn} onClick={handlePin} title={msg.isPinned ? 'Unpin' : 'Pin'}>
            📌
          </button>
          <button className={styles.actionBtn} onClick={() => onForward(msg)} title="Forward">
            ↗
          </button>
          {isMine && (
            <>
              <button className={styles.actionBtn} onClick={() => { setIsEditing(true); setEditVal(msg.content); }} title="Edit">✎</button>
              <button className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={handleDelete} title="Delete">🗑</button>
            </>
          )}
        </div>
      )}

      {/* Quick reaction picker */}
      {showReactions && (
        <div className={`${styles.quickReactions} ${isMine ? styles.quickLeft : styles.quickRight}`}>
          {QUICK_REACTIONS.map(emoji => (
            <button
              key={emoji}
              className={styles.quickReactionBtn}
              onClick={() => handleReaction(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
