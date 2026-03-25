import { useEffect, useState, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import api from '../../utils/api';

const overlayStyle = {
  background: 'var(--bg-secondary)',
  borderBottom: '1px solid var(--border-color)',
  padding: '0.75rem 1.25rem',
  maxHeight: '300px',
  overflowY: 'auto',
  animation: 'slideUp 0.2s ease',
};

const inputStyle = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-input)',
  borderRadius: '10px',
  padding: '0.6rem 0.875rem 0.6rem 2.5rem',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.5rem',
  position: 'relative',
};

const resultStyle = {
  padding: '0.5rem 0',
  borderBottom: '1px solid var(--border-color)',
  cursor: 'pointer',
};

const resultContentStyle = {
  fontSize: '0.85rem',
  color: 'var(--text-primary)',
  marginBottom: '0.2rem',
};

const resultMeta = {
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
};

export default function SearchOverlay({ roomId, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const doSearch = async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get(`/api/messages/search?q=${encodeURIComponent(q)}&roomId=${roomId}`);
      setResults(data.messages || []);
    } catch {}
    setLoading(false);
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(v), 300);
  };

  const highlightMatch = (text, q) => {
    if (!q.trim()) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase()
        ? <mark key={i} style={{background:'rgba(99,102,241,0.3)', color:'var(--text-primary)', borderRadius:'2px', padding:'0 2px'}}>{part}</mark>
        : part
    );
  };

  return (
    <div style={overlayStyle}>
      <div style={headerStyle}>
        <svg style={{position:'absolute', left:'0.75rem', top:'50%', transform:'translateY(-50%)', pointerEvents:'none', color:'var(--text-muted)'}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref={inputRef}
          style={inputStyle}
          placeholder="Search messages in this chat…"
          value={query}
          onChange={handleChange}
        />
        <button
          style={{background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'0.9rem', flexShrink:0}}
          onClick={onClose}
        >✕</button>
      </div>

      {loading && <div style={{color:'var(--text-muted)', fontSize:'0.82rem', padding:'0.5rem 0'}}>Searching…</div>}

      {!loading && query && results.length === 0 && (
        <div style={{color:'var(--text-muted)', fontSize:'0.82rem', padding:'0.5rem 0'}}>No messages found</div>
      )}

      {results.map(msg => (
        <div key={msg.id} style={resultStyle}>
          <div style={resultContentStyle}>{highlightMatch(msg.content, query)}</div>
          <div style={resultMeta}>
            {msg.sender?.username} • {msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : ''}
          </div>
        </div>
      ))}
    </div>
  );
}
