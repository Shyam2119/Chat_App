import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import api from '../../utils/api';

const drawerStyle = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: '340px',
  maxWidth: '90vw',
  background: 'var(--bg-secondary)',
  borderLeft: '1px solid var(--border-color)',
  zIndex: 500,
  display: 'flex',
  flexDirection: 'column',
  animation: 'slideInRight 0.2s ease',
  boxShadow: '-8px 0 30px var(--shadow-modal)',
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1.25rem 1rem',
  borderBottom: '1px solid var(--border-color)',
};

const bodyStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '1rem',
};

const sectionTitle = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '0.5rem',
  marginTop: '1rem',
};

const memberStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.65rem',
  padding: '0.5rem 0',
};

const memberAvatar = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  objectFit: 'cover',
  background: 'var(--avatar-bg)',
};

const memberInfoStyle = {
  flex: 1,
  minWidth: 0,
};

const memberName = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--text-primary)',
};

const memberBio = {
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const kickBtnStyle = {
  background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.2)',
  color: 'var(--danger)',
  borderRadius: '6px',
  padding: '0.2rem 0.5rem',
  fontSize: '0.72rem',
  cursor: 'pointer',
  fontWeight: 600,
};

const actionBtnStyle = {
  width: '100%',
  padding: '0.7rem',
  borderRadius: '10px',
  border: 'none',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
  marginTop: '0.5rem',
};

const inputStyle = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  borderRadius: '8px',
  padding: '0.5rem 0.75rem',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const descStyle = {
  fontSize: '0.85rem',
  color: 'var(--text-secondary)',
  padding: '0.5rem 0',
  lineHeight: 1.5,
};

export default function RoomInfoDrawer({ room, onClose }) {
  const { user } = useAuth();
  const { kickMember, deleteRoom, onlineUsers, muteRoom, unmuteRoom, mutedRooms } = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [members, setMembers] = useState(room.members || []);

  const isCreator = room.createdBy === user.id;
  const isMuted = mutedRooms.has(room.id);

  useEffect(() => {
    setMembers(room.members || []);
  }, [room.members]);

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); return; }
    try {
      const { data } = await api.get(`/api/users/?q=${q}`);
      const memberIds = new Set(members.map(m => m.id));
      setSearchResults(data.filter(u => !memberIds.has(u.id)));
    } catch {}
  };

  const addMember = async (userId) => {
    try {
      const { data } = await api.post(`/api/rooms/${room.id}/members`, { userId });
      setMembers(data.members || []);
      setSearchResults([]);
      setSearchQuery('');
    } catch {}
  };

  const handleKick = async (userId) => {
    if (!window.confirm('Remove this member?')) return;
    const updated = await kickMember(room.id, userId);
    if (updated?.members) setMembers(updated.members);
  };

  const handleLeave = async () => {
    if (!window.confirm('Leave this room?')) return;
    try {
      await api.post(`/api/rooms/${room.id}/leave`);
      window.location.reload();
    } catch {}
  };

  return (
    <div style={drawerStyle}>
      <div style={headerStyle}>
        <span style={{fontSize:'1rem', fontWeight:700, color:'var(--text-primary)'}}>
          Room Info
        </span>
        <button
          style={{background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.1rem'}}
          onClick={onClose}
        >✕</button>
      </div>

      <div style={bodyStyle}>
        {/* Room avatar and name */}
        <div style={{textAlign:'center', padding:'1rem 0'}}>
          <img
            src={room.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${room.name}`}
            alt={room.name}
            style={{width:'64px', height:'64px', borderRadius:'16px', objectFit:'cover', background:'var(--avatar-bg)'}}
          />
          <div style={{fontSize:'1.15rem', fontWeight:700, color:'var(--text-primary)', marginTop:'0.75rem'}}>
            {room.name}
          </div>
          {room.description && (
            <div style={descStyle}>{room.description}</div>
          )}
          <div style={{fontSize:'0.78rem', color:'var(--text-muted)'}}>
            {room.isPrivate ? 'Direct Message' : `Group • ${members.length} members`}
          </div>
        </div>

        {/* Mute toggle */}
        <button
          style={{
            ...actionBtnStyle,
            background: isMuted ? 'var(--accent-glow)' : 'var(--bg-surface)',
            color: isMuted ? 'var(--accent-light)' : 'var(--text-secondary)',
            border: '1px solid ' + (isMuted ? 'var(--accent-border)' : 'var(--border-color)'),
          }}
          onClick={() => isMuted ? unmuteRoom(room.id) : muteRoom(room.id)}
        >
          {isMuted ? '🔇 Unmute Notifications' : '🔔 Mute Notifications'}
        </button>

        {/* Members */}
        <div style={sectionTitle}>Members ({members.length})</div>
        {members.map(m => (
          <div key={m.id} style={memberStyle}>
            <img
              src={m.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${m.username}`}
              alt={m.username}
              style={memberAvatar}
            />
            <div style={memberInfoStyle}>
              <div style={memberName}>
                {m.username}
                {m.id === room.createdBy && (
                  <span style={{fontSize:'0.66rem', color:'var(--accent-light)', marginLeft:'0.35rem'}}>ADMIN</span>
                )}
                {onlineUsers.has(m.id) && (
                  <span style={{fontSize:'0.66rem', color:'var(--success)', marginLeft:'0.35rem'}}>● Online</span>
                )}
              </div>
              <div style={memberBio}>
                {m.statusEmoji && m.statusText
                  ? `${m.statusEmoji} ${m.statusText}`
                  : m.bio || 'No bio'}
              </div>
            </div>
            {isCreator && m.id !== user.id && !room.isPrivate && (
              <button style={kickBtnStyle} onClick={() => handleKick(m.id)}>
                Remove
              </button>
            )}
          </div>
        ))}

        {/* Add member (groups only) */}
        {!room.isPrivate && (
          <>
            <div style={sectionTitle}>Add Member</div>
            <input
              style={inputStyle}
              placeholder="Search users to add…"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
            />
            {searchResults.map(u => (
              <div key={u.id} style={memberStyle}>
                <img
                  src={u.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`}
                  alt={u.username}
                  style={memberAvatar}
                />
                <div style={memberInfoStyle}>
                  <div style={memberName}>{u.username}</div>
                </div>
                <button
                  style={{...kickBtnStyle, background:'var(--accent-glow)', borderColor:'var(--accent-border)', color:'var(--accent-light)'}}
                  onClick={() => addMember(u.id)}
                >
                  Add
                </button>
              </div>
            ))}
          </>
        )}

        {/* Leave or Delete room */}
        {!room.isPrivate ? (
          <>
            {isCreator ? (
              <button
                style={{...actionBtnStyle, background:'rgba(239,68,68,0.1)', color:'var(--danger)', marginTop:'1.5rem'}}
                onClick={async () => {
                  if (window.confirm('Are you sure? This will delete the group and ALL messages for everyone.')) {
                    await deleteRoom(room.id);
                    onClose();
                  }
                }}
              >
                Delete Group
              </button>
            ) : (
              <button
                style={{...actionBtnStyle, background:'rgba(239,68,68,0.1)', color:'var(--danger)', marginTop:'1.5rem'}}
                onClick={handleLeave}
              >
                Leave Room
              </button>
            )}
          </>
        ) : (
          <button
            style={{...actionBtnStyle, background:'rgba(239,68,68,0.1)', color:'var(--danger)', marginTop:'1.5rem'}}
            onClick={async () => {
              if (window.confirm('Remove this conversation from your list?')) {
                await deleteRoom(room.id);
                onClose();
              }
            }}
          >
            Delete Chat
          </button>
        )}
      </div>
    </div>
  );
}
