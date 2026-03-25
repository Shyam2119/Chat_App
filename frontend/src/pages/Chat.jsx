import { useState, useEffect } from 'react';
import Sidebar from '../components/chat/Sidebar';
import ChatWindow from '../components/chat/ChatWindow';
import NewChatModal from '../components/chat/NewChatModal';
import ProfileModal from '../components/chat/ProfileModal';
import KeyboardShortcuts from '../components/chat/KeyboardShortcuts';
import StarredPanel from '../components/chat/StarredPanel';
import styles from './Chat.module.css';

export default function Chat() {
  const [showNewChat, setShowNewChat]      = useState(false);
  const [showProfile, setShowProfile]      = useState(false);
  const [showShortcuts, setShowShortcuts]  = useState(false);
  const [showStarred, setShowStarred]      = useState(false);

  useEffect(() => {
    const handleKey = (e) => {
      // Ctrl+N → new chat
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowNewChat(true);
      }
      // ? → shortcuts
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          e.preventDefault();
          setShowShortcuts(s => !s);
        }
      }
      // Escape → close all modals
      if (e.key === 'Escape') {
        setShowNewChat(false);
        setShowProfile(false);
        setShowShortcuts(false);
        setShowStarred(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className={styles.layout}>
      <Sidebar
        onNewChat={() => setShowNewChat(true)}
        onOpenProfile={() => setShowProfile(true)}
        onOpenStarred={() => setShowStarred(true)}
      />
      <ChatWindow />

      {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      {showShortcuts && <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />}
      {showStarred && <StarredPanel onClose={() => setShowStarred(false)} />}
    </div>
  );
}
