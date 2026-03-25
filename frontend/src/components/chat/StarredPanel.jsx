import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import api from '../../utils/api';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'var(--shadow-modal)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  animation: 'fadeInScale 0.15s ease',
};

const modalStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px',
  width: '100%',
  maxWidth: '500px',
  padding: '1.5rem',
  maxHeight: '80vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const listStyle = {
  flex: 1,
  overflowY: 'auto',
};

const itemStyle = {
  display: 'flex',
  gap: '0.75rem',
  padding: '0.75rem 0',
  borderBottom: '1px solid var(--border-color)',
};

const contentStyle = {
  flex: 1,
  minWidth: 0,
  fontSize: '0.88rem',
  color: 'var(--text-primary)',
  lineHeight: 1.5,
};

const metaStyle = {
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  marginTop: '0.25rem',
};

const unstarBtn = {
  background: 'transparent',
  border: 'none',
  color: '#fbbf24',
  cursor: 'pointer',
  fontSize: '1.1rem',
  flexShrink: 0,
  alignSelf: 'center',
};

export default function StarredPanel({ onClose }) {
  const [starred, setStarred] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStarred = async () => {
      try {
        const { data } = await api.get('/api/messages/starred');
        setStarred(data.messages || []);
      } catch {}
      setLoading(false);
    };
    fetchStarred();
  }, []);

  const handleUnstar = async (messageId) => {
    try {
      await api.post(`/api/messages/${messageId}/unstar`);
      setStarred(prev => prev.filter(s => s.message.id !== messageId));
    } catch {}
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
          <span style={{fontSize:'1rem', fontWeight:700, color:'var(--text-primary)'}}>
            ★ Starred Messages
          </span>
          <button
            style={{background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.1rem'}}
            onClick={onClose}
          >✕</button>
        </div>

        <div style={listStyle}>
          {loading && <div style={{color:'var(--text-muted)', textAlign:'center', padding:'2rem'}}>Loading…</div>}
          {!loading && starred.length === 0 && (
            <div style={{color:'var(--text-muted)', textAlign:'center', padding:'2rem'}}>
              No starred messages yet. Star messages with ☆ to save them.
            </div>
          )}
          {starred.map(s => (
            <div key={s.id} style={itemStyle}>
              <div style={contentStyle}>
                <div style={{display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden'}}>
                  {s.message.content}
                </div>
                <div style={metaStyle}>
                  {s.message.sender?.username} • {formatDistanceToNow(new Date(s.starredAt), { addSuffix: true })}
                </div>
              </div>
              <button style={unstarBtn} onClick={() => handleUnstar(s.message.id)} title="Unstar">
                ★
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
