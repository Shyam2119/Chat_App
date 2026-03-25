import { useRef, useCallback } from 'react';
import { useChat } from '../context/ChatContext';

export function useTyping(roomId) {
  const { sendTyping } = useChat();
  const timerRef = useRef(null);
  const isTypingRef = useRef(false);

  const onKeyPress = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      sendTyping(roomId, true);
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      sendTyping(roomId, false);
    }, 2000);
  }, [roomId, sendTyping]);

  const stopTyping = useCallback(() => {
    clearTimeout(timerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      sendTyping(roomId, false);
    }
  }, [roomId, sendTyping]);

  return { onKeyPress, stopTyping };
}
