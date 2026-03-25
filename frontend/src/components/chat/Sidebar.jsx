import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useSocket } from '../../context/SocketContext';
import { formatDistanceToNow } from 'date-fns';
import styles from './Sidebar.module.css';

export default function Sidebar({ onNewChat, onOpenProfile, onOpenStarred }) {
  const { user, logout, toggleTheme } = useAuth();
  const { rooms, activeRoom, selectRoom, loadingRooms, onlineUsers, unreadCounts, mutedRooms } = useChat();
  const { connected } = useSocket();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all'); // all | dms | groups

  const filtered = rooms.filter(r => {
    const name = (r.name || '').toLowerCase();
    const matchSearch = name.includes(search.toLowerCase());
    if (tab === 'dms')    return r.isPrivate  && matchSearch;
    if (tab === 'groups') return !r.isPrivate && matchSearch;
    return matchSearch;
  });

  const isDark = user?.theme !== 'light';

  return (
    <aside className={styles.sidebar}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.brandRow}>
          <span className={styles.brandIcon}>⚡</span>
          <span className={styles.brandName}>Nexus</span>
          <div className={`${styles.connDot} ${connected ? styles.online : styles.offline}`} title={connected ? 'Connected' : 'Disconnected'} />
        </div>
        <div className={styles.headerBtns}>
          <button className={styles.themeBtn} onClick={toggleTheme} title={isDark ? 'Light mode' : 'Dark mode'}>
            {isDark ? '☀️' : '🌙'}
          </button>
          <button className={styles.newBtn} onClick={onNewChat} title="New conversation">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          className={styles.search}
          placeholder="Search conversations…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {['all','dms','groups'].map(t => (
          <button key={t} className={`${styles.tab} ${tab === t ? styles.activeTab : ''}`} onClick={() => setTab(t)}>
            {t === 'all' ? 'All' : t === 'dms' ? 'DMs' : 'Groups'}
          </button>
        ))}
      </div>

      {/* Room list */}
      <div className={styles.rooms}>
        {loadingRooms && <div className={styles.empty}>Loading…</div>}
        {!loadingRooms && filtered.length === 0 && (
          <div className={styles.empty}>
            {search ? 'No results' : 'No conversations yet'}
          </div>
        )}
        {filtered.map(room => {
          const isActive = activeRoom?.id === room.id;
          const otherUser = room.isPrivate ? room.otherUser : null;
          const isOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
          const lastMsg = room.lastMessage;
          const unread = unreadCounts[room.id] || 0;
          const isMuted = mutedRooms.has(room.id);

          return (
            <button
              key={room.id}
              className={`${styles.roomItem} ${isActive ? styles.active : ''}`}
              onClick={() => selectRoom(room)}
            >
              <div className={styles.avatarWrap}>
                <img
                  src={room.avatarUrl || otherUser?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${room.name}`}
                  alt={room.name}
                  className={styles.avatar}
                />
                {room.isPrivate && (
                  <span className={`${styles.onlineBadge} ${isOnline ? styles.isOnline : ''}`} />
                )}
                {!room.isPrivate && (
                  <span className={styles.groupBadge}>#</span>
                )}
              </div>
              <div className={styles.roomInfo}>
                <div className={styles.roomTop}>
                  <span className={styles.roomName}>
                    {room.name || 'Unnamed'}
                    {isMuted && <span className={styles.mutedIcon}>🔇</span>}
                  </span>
                  <div className={styles.roomTopRight}>
                    {lastMsg && (
                      <span className={styles.roomTime}>
                        {formatDistanceToNow(new Date(lastMsg.createdAt), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                </div>
                <div className={styles.roomSub}>
                  <span className={styles.lastMsgWrap}>
                    {lastMsg
                      ? <span className={styles.lastMsg}>
                          {lastMsg.messageType === 'image' ? '📷 Image' :
                           lastMsg.messageType === 'file' ? '📎 File' :
                           lastMsg.messageType === 'voice' ? '🎤 Voice' :
                           lastMsg.messageType === 'forwarded' ? '↗ Forwarded' :
                           lastMsg.content?.slice(0, 40) || '…'}
                        </span>
                      : <span className={styles.noMsg}>{room.isPrivate ? 'Start a conversation' : `${room.memberCount} members`}</span>
                    }
                  </span>
                  {unread > 0 && (
                    <span className={styles.unreadBadge}>{unread > 99 ? '99+' : unread}</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* User profile footer */}
      <div className={styles.footer}>
        <button className={styles.profileBtn} onClick={onOpenProfile}>
          <img
            src={user?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.username}`}
            alt={user?.username}
            className={styles.userAvatar}
          />
          <div className={styles.userInfo}>
            <span className={styles.userName}>{user?.username}</span>
            {user?.statusText ? (
              <span className={styles.userStatusText}>
                {user.statusEmoji && `${user.statusEmoji} `}{user.statusText}
              </span>
            ) : (
              <span className={styles.userStatus}>
                <span className={styles.onlineDot} /> Online
              </span>
            )}
          </div>
        </button>
        {onOpenStarred && (
          <button className={styles.logoutBtn} onClick={onOpenStarred} title="Starred messages" style={{color: '#fbbf24'}}>
            ★
          </button>
        )}
        <button className={styles.logoutBtn} onClick={logout} title="Sign out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
