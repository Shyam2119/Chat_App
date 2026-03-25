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
  padding: '1.5rem 2rem',
};

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1.25rem',
};

const SHORTCUTS = [
  { keys: 'Ctrl + K', action: 'Search messages' },
  { keys: 'Ctrl + N', action: 'New conversation' },
  { keys: '?', action: 'Show shortcuts' },
  { keys: 'Esc', action: 'Close modals/panels' },
  { keys: 'Enter', action: 'Send message' },
  { keys: 'Shift + Enter', action: 'New line in message' },
  { keys: 'Tab', action: 'Accept @mention suggestion' },
  { keys: '↑ / ↓', action: 'Navigate @mention list' },
  { keys: '@username', action: 'Mention a user' },
  { keys: '**text**', action: 'Bold formatting' },
  { keys: '*text*', action: 'Italic formatting' },
  { keys: '~~text~~', action: 'Strikethrough' },
  { keys: '`code`', action: 'Inline code' },
  { keys: '```code```', action: 'Code block' },
];

const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.5rem 0',
  borderBottom: '1px solid var(--border-color)',
};

const keysStyle = {
  display: 'flex',
  gap: '0.35rem',
  flexShrink: 0,
};

const kbdStyle = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  borderRadius: '5px',
  padding: '0.15rem 0.5rem',
  fontSize: '0.76rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
};

export default function KeyboardShortcuts({ onClose }) {
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{fontSize:'1rem', fontWeight:700, color:'var(--text-primary)'}}>
            ⌨️ Keyboard Shortcuts & Formatting
          </span>
          <button
            style={{background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.1rem'}}
            onClick={onClose}
          >✕</button>
        </div>
        {SHORTCUTS.map((s, i) => (
          <div key={i} style={rowStyle}>
            <span style={{fontSize:'0.85rem', color:'var(--text-secondary)'}}>{s.action}</span>
            <div style={keysStyle}>
              <kbd style={kbdStyle}>{s.keys}</kbd>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
