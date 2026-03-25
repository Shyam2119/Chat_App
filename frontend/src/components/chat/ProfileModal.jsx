import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
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
  maxWidth: '440px',
  padding: '2rem',
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1.5rem',
};

const titleStyle = {
  fontSize: '1.1rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const closeStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '1.2rem',
};

const avatarRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  marginBottom: '1.5rem',
};

const avatarImgStyle = {
  width: '64px',
  height: '64px',
  borderRadius: '16px',
  objectFit: 'cover',
  background: 'var(--avatar-bg)',
};

const nameStyle = {
  fontSize: '1.1rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
};

const emailStyle = {
  fontSize: '0.82rem',
  color: 'var(--text-muted)',
};

const fieldStyle = {
  marginBottom: '1rem',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.78rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '0.35rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  borderRadius: '10px',
  padding: '0.65rem 0.875rem',
  color: 'var(--text-primary)',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const statusRowStyle = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
};

const emojiInputStyle = {
  ...inputStyle,
  width: '60px',
  textAlign: 'center',
  fontSize: '1.2rem',
  padding: '0.5rem',
};

const btnStyle = {
  width: '100%',
  background: 'linear-gradient(135deg, var(--accent), var(--accent-light))',
  color: '#fff',
  border: 'none',
  borderRadius: '10px',
  padding: '0.75rem',
  fontSize: '0.9rem',
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: '0.5rem',
};

const msgStyle = (isErr) => ({
  fontSize: '0.82rem',
  textAlign: 'center',
  padding: '0.5rem 0',
  color: isErr ? 'var(--danger)' : 'var(--success)',
});

export default function ProfileModal({ onClose }) {
  const { user, setUser } = useAuth();
  const [bio, setBio]               = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl]    = useState(user?.avatarUrl || '');
  const [statusText, setStatusText]  = useState(user?.statusText || '');
  const [statusEmoji, setStatusEmoji] = useState(user?.statusEmoji || '');
  const [msg, setMsg]     = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/api/users/me', {
        bio: bio.trim(),
        avatarUrl: avatarUrl.trim(),
        statusText: statusText.trim(),
        statusEmoji: statusEmoji.trim(),
      });
      setUser(data);
      setMsg('Profile updated!');
      setTimeout(() => setMsg(''), 2000);
    } catch {
      setMsg('Error saving profile');
    }
    setSaving(false);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={titleStyle}>Profile Settings</span>
          <button style={closeStyle} onClick={onClose}>✕</button>
        </div>

        <div style={avatarRowStyle}>
          <img
            src={avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username}`}
            alt={user?.username}
            style={avatarImgStyle}
          />
          <div>
            <div style={nameStyle}>{user?.username}</div>
            <div style={emailStyle}>{user?.email}</div>
          </div>
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Avatar URL</label>
          <input
            style={inputStyle}
            value={avatarUrl}
            onChange={e => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Bio</label>
          <textarea
            style={{...inputStyle, minHeight:'60px', resize:'vertical', fontFamily:'inherit'}}
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Tell others about yourself…"
            maxLength={200}
          />
        </div>

        <div style={fieldStyle}>
          <label style={labelStyle}>Status</label>
          <div style={statusRowStyle}>
            <input
              style={emojiInputStyle}
              value={statusEmoji}
              onChange={e => setStatusEmoji(e.target.value)}
              placeholder="😊"
              maxLength={4}
            />
            <input
              style={{...inputStyle, flex:1}}
              value={statusText}
              onChange={e => setStatusText(e.target.value)}
              placeholder="What are you up to?"
              maxLength={100}
            />
          </div>
        </div>

        {msg && <div style={msgStyle(!msg.includes('updated'))}>{msg}</div>}

        <button style={btnStyle} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
