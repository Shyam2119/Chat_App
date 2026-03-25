import { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';

const toastStyle = (visible, connected) => ({
  position: 'fixed',
  bottom: '1.5rem',
  left: '50%',
  transform: `translateX(-50%) translateY(${visible ? '0' : '20px'})`,
  opacity: visible ? 1 : 0,
  background: connected
    ? 'linear-gradient(135deg, #22c55e, #16a34a)'
    : 'linear-gradient(135deg, #ef4444, #dc2626)',
  color: '#fff',
  padding: '0.6rem 1.25rem',
  borderRadius: '12px',
  fontSize: '0.82rem',
  fontWeight: 600,
  boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
  zIndex: 9999,
  transition: 'all 0.3s ease',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
});

export default function ConnectionToast() {
  const { connected } = useSocket();
  const [visible, setVisible] = useState(false);
  const [lastState, setLastState] = useState(connected);

  useEffect(() => {
    if (connected !== lastState) {
      setLastState(connected);
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [connected, lastState]);

  return (
    <div style={toastStyle(visible, connected)}>
      <span>{connected ? '🟢' : '🔴'}</span>
      {connected ? 'Connected' : 'Connection lost — reconnecting…'}
    </div>
  );
}
