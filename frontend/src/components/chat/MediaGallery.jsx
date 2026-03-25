import { useEffect, useState } from 'react';
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
  maxWidth: '600px',
  padding: '1.5rem',
  maxHeight: '80vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
};

const tabsStyle = {
  display: 'flex',
  gap: '0.5rem',
  marginBottom: '1rem',
};

const tabStyle = (active) => ({
  padding: '0.4rem 0.8rem',
  borderRadius: '8px',
  border: '1px solid ' + (active ? 'var(--accent-border)' : 'var(--border-color)'),
  background: active ? 'var(--accent-glow)' : 'transparent',
  color: active ? 'var(--accent-light)' : 'var(--text-muted)',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
});

const gridStyle = {
  flex: 1,
  overflowY: 'auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: '0.5rem',
};

const mediaItemStyle = {
  borderRadius: '10px',
  overflow: 'hidden',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  cursor: 'pointer',
  transition: 'transform 0.15s',
  aspectRatio: '1',
};

const imgStyle = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

const fileItemStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
  textAlign: 'center',
  height: '100%',
};

const emptyStyle = {
  color: 'var(--text-muted)',
  textAlign: 'center',
  padding: '2rem',
  gridColumn: '1 / -1',
};

export default function MediaGallery({ roomId, onClose }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const { data } = await api.get(`/api/rooms/${roomId}/media`);
        setMedia(data);
      } catch {}
      setLoading(false);
    };
    fetchMedia();
  }, [roomId]);

  const filtered = media.filter(m => {
    if (tab === 'images') return m.messageType === 'image';
    if (tab === 'files') return m.messageType === 'file';
    if (tab === 'voice') return m.messageType === 'voice';
    return true;
  });

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{fontSize:'1rem', fontWeight:700, color:'var(--text-primary)'}}>
            🖼️ Media Gallery
          </span>
          <button
            style={{background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.1rem'}}
            onClick={onClose}
          >✕</button>
        </div>

        <div style={tabsStyle}>
          {['all', 'images', 'files', 'voice'].map(t => (
            <button key={t} style={tabStyle(tab === t)} onClick={() => setTab(t)}>
              {t === 'all' ? 'All' : t === 'images' ? '🖼️ Images' : t === 'files' ? '📄 Files' : '🎤 Voice'}
            </button>
          ))}
        </div>

        <div style={gridStyle}>
          {loading && <div style={emptyStyle}>Loading…</div>}
          {!loading && filtered.length === 0 && <div style={emptyStyle}>No media found</div>}
          {filtered.map(m => (
            <div key={m.id} style={mediaItemStyle}>
              {m.messageType === 'image' ? (
                <a href={m.fileUrl} target="_blank" rel="noopener noreferrer">
                  <img src={m.fileUrl} alt={m.fileName} style={imgStyle} />
                </a>
              ) : (
                <div style={fileItemStyle}>
                  <span style={{fontSize:'2rem',marginBottom:'0.5rem'}}>
                    {m.messageType === 'voice' ? '🎤' : '📄'}
                  </span>
                  <span style={{fontSize:'0.72rem', color:'var(--text-secondary)', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%'}}>
                    {m.fileName || 'File'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
