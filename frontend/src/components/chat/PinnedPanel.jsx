import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useChat } from '../../context/ChatContext';
import api from '../../utils/api';

const panelStyle = {
  background: 'var(--bg-secondary)',
  borderBottom: '1px solid var(--border-color)',
  padding: '0.75rem 1.25rem',
  maxHeight: '250px',
  overflowY: 'auto',
  animation: 'slideUp 0.2s ease',
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '0.5rem',
};

const titleStyle = {
  fontSize: '0.82rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
  display: 'flex',
  alignItems: 'center',
  gap: '0.35rem',
};

const closeStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '0.9rem',
};

const pinItemStyle = {
  display: 'flex',
  gap: '0.5rem',
  padding: '0.5rem 0',
  borderBottom: '1px solid var(--border-color)',
  fontSize: '0.85rem',
};

const pinContentStyle = {
  flex: 1,
  minWidth: 0,
};

const pinText = {
  color: 'var(--text-primary)',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const pinMeta = {
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  marginTop: '0.2rem',
};

const unpinBtn = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-muted)',
  borderRadius: '6px',
  padding: '0.2rem 0.5rem',
  fontSize: '0.72rem',
  cursor: 'pointer',
  flexShrink: 0,
  alignSelf: 'center',
};

const emptyStyle = {
  color: 'var(--text-muted)',
  fontSize: '0.82rem',
  textAlign: 'center',
  padding: '1rem 0',
};

export default function PinnedPanel({ roomId, onClose }) {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(true);
  const { unpinMessage } = useChat();

  useEffect(() => {
    const fetchPins = async () => {
      try {
        const { data } = await api.get(`/api/rooms/${roomId}/pins`);
        setPins(data);
      } catch {}
      setLoading(false);
    };
    fetchPins();
  }, [roomId]);

  const handleUnpin = (messageId) => {
    unpinMessage(messageId);
    setPins(prev => prev.filter(p => p.message.id !== messageId));
  };

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>📌 Pinned Messages ({pins.length})</span>
        <button style={closeStyle} onClick={onClose}>✕</button>
      </div>
      {loading && <div style={emptyStyle}>Loading…</div>}
      {!loading && pins.length === 0 && <div style={emptyStyle}>No pinned messages</div>}
      {pins.map(p => (
        <div key={p.id} style={pinItemStyle}>
          <div style={pinContentStyle}>
            <div style={pinText}>{p.message.content}</div>
            <div style={pinMeta}>
              by {p.pinnedBy?.username || 'unknown'} • {formatDistanceToNow(new Date(p.pinnedAt), { addSuffix: true })}
            </div>
          </div>
          <button style={unpinBtn} onClick={() => handleUnpin(p.message.id)}>
            Unpin
          </button>
        </div>
      ))}
    </div>
  );
}
