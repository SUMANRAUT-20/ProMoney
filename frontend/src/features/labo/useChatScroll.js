import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const nearBottom = (log) => log.scrollHeight - log.clientHeight - log.scrollTop <= 20;

export function useChatScroll(messages, busy, proposalCount, statementCount) {
  const logRef = useRef(null);
  const follow = useRef(true);
  const lastTop = useRef(0);
  const lastMessage = useRef(null);
  const [newAnswer, setNewAnswer] = useState(false);

  const showLatest = useCallback(() => {
    const log = logRef.current;
    follow.current = true;
    setNewAnswer(false);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    log?.scrollTo({ top: log.scrollHeight, behavior: reducedMotion ? 'auto' : 'smooth' });
  }, []);

  useLayoutEffect(() => {
    const log = logRef.current;
    if (log && log.scrollTop < lastTop.current && !nearBottom(log)) follow.current = false;
    const newest = messages.at(-1);
    const newReply = newest?.role === 'ai' && newest.id !== lastMessage.current;
    lastMessage.current = newest?.id;
    if (follow.current) showLatest();
    else if (newReply) setNewAnswer(true);
  }, [messages, busy, proposalCount, statementCount, showLatest]);

  function onScroll({ currentTarget: log }) {
    if (nearBottom(log)) {
      follow.current = true;
      setNewAnswer(false);
    } else if (log.scrollTop < lastTop.current) {
      // Smooth scrolling toward a new reply also fires scroll events.
      follow.current = false;
    }
    lastTop.current = log.scrollTop;
  }

  return { logRef, onScroll, newAnswer, showLatest };
}
