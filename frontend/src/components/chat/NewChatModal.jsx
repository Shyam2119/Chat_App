import { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
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
  padding: '1.5rem',
  maxHeight: '80vh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const inputStyle = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  borderRadius: '10px',
  padding: '0.6rem 0.875rem',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
  marginBottom: '0.75rem',
};

const tabsStyle = {
  display: 'flex',
  gap: '0.5rem',
  marginBottom: '1rem',
};

const tabStyle = (active) => ({
  flex: 1,
  padding: '0.5rem',
  borderRadius: '8px',
  border: '1px solid ' + (active ? 'var(--accent-border)' : 'var(--border-color)'),
  background: active ? 'var(--accent-glow)' : 'transparent',
  color: active ? 'var(--accent-light)' : 'var(--text-muted)',
  fontSize: '0.82rem',
  fontWeight: 600,
  cursor: 'pointer',
  textAlign: 'center',
});

const listStyle = {
  flex: 1,
  overflowY: 'auto',
  maxHeight: '300px',
};

const userItemStyle = (selected) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '0.65rem',
  width: '100%',
  padding: '0.55rem 0.75rem',
  background: selected ? 'var(--bg-active)' : 'transparent',
  border: 'none',
  borderRadius: '10px',
  cursor: 'pointer',
  color: 'var(--text-primary)',
  fontSize: '0.88rem',
  textAlign: 'left',
  transition: 'background 0.15s',
});

const avatarStyle = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  objectFit: 'cover',
  background: 'var(--avatar-bg)',
};

const createBtnStyle = (disabled) => ({
  width: '100%',
  padding: '0.75rem',
  borderRadius: '10px',
  border: 'none',
  background: disabled ? 'var(--bg-surface)' : 'linear-gradient(135deg, var(--accent), var(--accent-light))',
  color: disabled ? 'var(--text-muted)' : '#fff',
  fontSize: '0.9rem',
  fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  marginTop: '0.75rem',
});

const selectionStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.35rem',
  marginBottom: '0.75rem',
};

const chipStyle = {
  background: 'var(--accent-glow)',
  border: '1px solid var(--accent-border)',
  color: 'var(--accent-light)',
  borderRadius: '20px',
  padding: '0.2rem 0.6rem',
  fontSize: '0.78rem',
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: '0.3rem',
};

const chipRemove = {
  background: 'transparent',
  border: 'none',
  color: 'var(--accent-light)',
  cursor: 'pointer',
  fontSize: '0.7rem',
  padding: 0,
};

export default function NewChatModal({ onClose }) {
  const { createRoom, selectRoom } = useChat();
  const [tab, setTab] = useState('dm'); // dm | group
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await api.get(`/api/users/?q=${search}`);
        setUsers(data);
      } catch {}
    };
    const timer = setTimeout(fetchUsers, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleUser = (u) => {
    if (tab === 'dm') {
      setSelected([u]);
    } else {
      setSelected(prev =>
        prev.find(s => s.id === u.id)
          ? prev.filter(s => s.id !== u.id)
          : [...prev, u]
      );
    }
  };

  const handleCreate = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    try {
      const payload = tab === 'dm'
        ? { isPrivate: true, memberIds: [selected[0].id] }
        : { isPrivate: false, name: groupName.trim() || `Group`, memberIds: selected.map(u => u.id) };
      const room = await createRoom(payload);
      selectRoom(room);
      onClose();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to create conversation');
    }
    setLoading(false);
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem'}}>
          <span style={{fontSize:'1rem', fontWeight:700, color:'var(--text-primary)'}}>
            New Conversation
          </span>
          <button
            style={{background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.1rem'}}
            onClick={onClose}
          >✕</button>
        </div>

        {errorMsg && (
          <div style={{
            background: 'var(--accent-glow)',
            border: '1px solid var(--accent-border)',
            color: 'var(--accent-light)',
            padding: '0.6rem',
            borderRadius: '8px',
            fontSize: '0.8rem',
            marginBottom: '1rem',
            textAlign: 'center'
          }}>
            {errorMsg}
          </div>
        )}

        <div style={tabsStyle}>
          <button style={tabStyle(tab === 'dm')} onClick={() => { setTab('dm'); setSelected([]); }}>
            Direct Message
          </button>
          <button style={tabStyle(tab === 'group')} onClick={() => { setTab('group'); setSelected([]); }}>
            Group Chat
          </button>
        </div>

        {tab === 'group' && (
          <input
            style={inputStyle}
            placeholder="Group name…"
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
          />
        )}

        <input
          style={inputStyle}
          placeholder="Search users…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />

        {selected.length > 0 && tab === 'group' && (
          <div style={selectionStyle}>
            {selected.map(u => (
              <span key={u.id} style={chipStyle}>
                {u.username}
                <button style={chipRemove} onClick={() => toggleUser(u)}>✕</button>
              </span>
            ))}
          </div>
        )}

        <div style={listStyle}>
          {users.map(u => (
            <button
              key={u.id}
              style={userItemStyle(selected.find(s => s.id === u.id))}
              onClick={() => toggleUser(u)}
              onMouseEnter={e => { if(!selected.find(s=>s.id===u.id)) e.currentTarget.style.background='var(--bg-hover)'; }}
              onMouseLeave={e => { if(!selected.find(s=>s.id===u.id)) e.currentTarget.style.background='transparent'; }}
            >
              <img
                src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`}
                alt={u.username}
                style={avatarStyle}
              />
              <div style={{flex:1}}>
                <div style={{fontWeight:600}}>{u.username}</div>
                {u.statusEmoji && u.statusText && (
                  <div style={{fontSize:'0.72rem', color:'var(--text-muted)'}}>
                    {u.statusEmoji} {u.statusText}
                  </div>
                )}
              </div>
              {selected.find(s => s.id === u.id) && (
                <span style={{color:'var(--accent-light)', fontWeight:700}}>✓</span>
              )}
            </button>
          ))}
        </div>

        <button
          style={createBtnStyle(selected.length === 0 || loading)}
          onClick={handleCreate}
          disabled={selected.length === 0 || loading}
        >
          {loading ? 'Creating…' : tab === 'dm' ? 'Start Conversation' : 'Create Group'}
        </button>
      </div>
    </div>
  );
}
