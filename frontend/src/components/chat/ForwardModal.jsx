import { useState } from 'react';
import { useChat } from '../../context/ChatContext';

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
  maxWidth: '400px',
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

const titleStyle = {
  fontSize: '1rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const closeStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '1.1rem',
};

const previewStyle = {
  background: 'var(--bg-surface)',
  borderRadius: '10px',
  padding: '0.75rem',
  marginBottom: '1rem',
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  maxHeight: '80px',
  overflow: 'hidden',
};

const listStyle = {
  flex: 1,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const roomBtnStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.65rem',
  width: '100%',
  padding: '0.6rem 0.75rem',
  background: 'transparent',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  fontSize: '0.88rem',
  textAlign: 'left',
  transition: 'background 0.15s',
};

const avatarStyle = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  objectFit: 'cover',
  background: 'var(--avatar-bg)',
};

export default function ForwardModal({ message, onClose }) {
  const { rooms, forwardMessage, activeRoom } = useChat();
  const [sent, setSent] = useState(false);

  const targetRooms = rooms.filter(r => r.id !== activeRoom?.id);

  const handleForward = (roomId) => {
    forwardMessage(message.id, roomId);
    setSent(true);
    setTimeout(onClose, 800);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={titleStyle}>↗ Forward Message</span>
          <button style={closeStyle} onClick={onClose}>✕</button>
        </div>

        <div style={previewStyle}>
          {message.content?.slice(0, 100) || 'File message'}
        </div>

        {sent ? (
          <div style={{textAlign:'center', padding:'1rem', color:'var(--success)', fontWeight:600}}>
            ✓ Message forwarded!
          </div>
        ) : (
          <div style={listStyle}>
            {targetRooms.map(room => (
              <button
                key={room.id}
                style={roomBtnStyle}
                onClick={() => handleForward(room.id)}
                onMouseEnter={e => e.target.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.target.style.background = 'transparent'}
              >
                <img
                  src={room.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${room.name}`}
                  alt={room.name}
                  style={avatarStyle}
                />
                <span>{room.name || 'Unnamed'}</span>
              </button>
            ))}
            {targetRooms.length === 0 && (
              <div style={{color:'var(--text-muted)', textAlign:'center', padding:'1rem'}}>
                No other rooms to forward to
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
