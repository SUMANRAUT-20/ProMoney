import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const nearBottom = (log) => log.scrollHeight - log.clientHeight - log.scrollTop <= 20;

export function useChatScroll(messages, busy, proposalCount, statementCount) {
  const logRef = useRef(null);
  const follow = useRef(true);
  const lastPosition = useRef({ top: 0, height: 0 });
  const lastMessage = useRef(null);
  const [newAnswer, setNewAnswer] = useState(false);

  const rememberPosition = useCallback((log) => {
    lastPosition.current = { top: log.scrollTop, height: log.clientHeight };
  }, []);

  const showLatest = useCallback(() => {
    const log = logRef.current;
    follow.current = true;
    setNewAnswer(false);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    log?.scrollTo({ top: log.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, []);

  useLayoutEffect(() => {
    const log = logRef.current;
    const { top, height } = lastPosition.current;
    if (log && log.clientHeight === height && log.scrollTop < top && !nearBottom(log)) follow.current = false;
    if (log) rememberPosition(log);
    const newest = messages.at(-1);
    const newReply = newest?.role === 'ai' && newest.id !== lastMessage.current;
    lastMessage.current = newest?.id;
    if (follow.current) showLatest();
    else if (newReply) setNewAnswer(true);
  }, [messages, busy, proposalCount, statementCount, showLatest, rememberPosition]);

  useLayoutEffect(() => {
    const log = logRef.current;
    if (!log) return;
    const observer = new ResizeObserver(() => {
      rememberPosition(log);
      if (follow.current) showLatest();
    });
    observer.observe(log);
    return () => observer.disconnect();
  }, [showLatest, rememberPosition]);

  function onScroll({ currentTarget: log }) {
    const { top, height } = lastPosition.current;
    if (nearBottom(log)) {
      follow.current = true;
      setNewAnswer(false);
    } else if (log.clientHeight === height && log.scrollTop < top) {
      // A taller message list can also clamp the previous scroll position.
      follow.current = false;
    }
    rememberPosition(log);
  }

  return { logRef, onScroll, newAnswer, showLatest };
}
