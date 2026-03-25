import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ChatProvider } from './context/ChatContext';
import Login    from './pages/Login';
import Register from './pages/Register';
import Chat     from './pages/Chat';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{
      height:'100vh', display:'flex', alignItems:'center',
      justifyContent:'center', background:'#0a0a0f', color:'rgba(255,255,255,0.3)',
      fontSize:'0.9rem', gap:'0.75rem'
    }}>
      <span style={{fontSize:'1.5rem',filter:'drop-shadow(0 0 12px rgba(99,102,241,0.7))'}}>⚡</span>
      Loading…
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function RedirectIfAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <ChatProvider>
            <Routes>
              <Route path="/login"    element={<RedirectIfAuth><Login /></RedirectIfAuth>} />
              <Route path="/register" element={<RedirectIfAuth><Register /></RedirectIfAuth>} />
              <Route path="/"         element={<RequireAuth><Chat /></RequireAuth>} />
              <Route path="*"         element={<Navigate to="/" replace />} />
            </Routes>
          </ChatProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
