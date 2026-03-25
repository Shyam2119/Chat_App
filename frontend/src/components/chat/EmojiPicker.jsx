import { useState, useRef, useEffect } from 'react';

const EMOJI_CATEGORIES = {
  'Smileys': ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','🤩','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤔','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤥','😒','😓','😔','😕','😖','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😱','😳','🥺','😡','🤬'],
  'Gestures': ['👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👋','🤚','🖐️','✋','🖖','👏','🙌','🤝','🙏','💪','🦾','🫶'],
  'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💝','💘','💖','💗','💓','💞','💕','💟'],
  'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐙','🦄','🐝','🦋','🐠','🐬','🦈'],
  'Food': ['🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🍍','🥝','🍔','🍕','🌮','🍜','🍦','🧁','🍰','☕','🍷'],
  'Objects': ['⚡','🔥','💎','🎯','🎉','🎊','✨','💫','🌟','⭐','🏆','🎵','🎶','💡','📌','📎','💻','📱','⌨️','🖥️','🔑','🗝️'],
  'Flags': ['🏳️','🏴','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇯🇵','🇰🇷','🇮🇳','🇧🇷','🇨🇦','🇦🇺'],
};

const wrapper = {
  position: 'absolute',
  bottom: '100%',
  left: 0,
  marginBottom: '0.5rem',
  width: '320px',
  maxHeight: '380px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-input)',
  borderRadius: '14px',
  boxShadow: '0 8px 30px var(--shadow-modal)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  animation: 'fadeInScale 0.12s ease',
  zIndex: 50,
};

const searchStyle = {
  padding: '0.6rem 0.75rem',
  borderBottom: '1px solid var(--border-color)',
};

const searchInput = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  borderRadius: '8px',
  padding: '0.45rem 0.65rem',
  color: 'var(--text-primary)',
  fontSize: '0.82rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const tabsStyle = {
  display: 'flex',
  borderBottom: '1px solid var(--border-color)',
  overflowX: 'auto',
};

const tabStyle = (active) => ({
  padding: '0.4rem 0.6rem',
  fontSize: '0.72rem',
  fontWeight: 600,
  color: active ? 'var(--accent-light)' : 'var(--text-muted)',
  background: active ? 'var(--accent-glow)' : 'transparent',
  border: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
});

const gridStyle = {
  flex: 1,
  overflowY: 'auto',
  padding: '0.5rem',
  display: 'grid',
  gridTemplateColumns: 'repeat(8, 1fr)',
  gap: '0.15rem',
};

const emojiBtnStyle = {
  background: 'transparent',
  border: 'none',
  fontSize: '1.3rem',
  cursor: 'pointer',
  padding: '0.25rem',
  borderRadius: '6px',
  transition: 'background 0.1s, transform 0.1s',
  lineHeight: 1,
};

export default function EmojiPicker({ onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Smileys');
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const categories = Object.keys(EMOJI_CATEGORIES);
  const emojis = search
    ? Object.values(EMOJI_CATEGORIES).flat().filter(() => true) // Show all for search (simple filter)
    : EMOJI_CATEGORIES[activeCategory] || [];

  return (
    <div ref={ref} style={wrapper}>
      <div style={searchStyle}>
        <input
          style={searchInput}
          placeholder="Search emoji…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>
      {!search && (
        <div style={tabsStyle}>
          {categories.map(cat => (
            <button
              key={cat}
              style={tabStyle(cat === activeCategory)}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
      <div style={gridStyle}>
        {emojis.map((emoji, i) => (
          <button
            key={i}
            style={emojiBtnStyle}
            onClick={() => { onSelect(emoji); }}
            onMouseEnter={e => { e.target.style.background='var(--bg-hover)'; e.target.style.transform='scale(1.2)'; }}
            onMouseLeave={e => { e.target.style.background='transparent'; e.target.style.transform='scale(1)'; }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
