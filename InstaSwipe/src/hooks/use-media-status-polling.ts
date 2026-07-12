import { useEffect, useRef, useState } from 'react';
import type { MediaStatus } from '@/components/post-card';

interface UseMediaStatusPollingOptions {
  intervalMs?: number;
  maxAttempts?: number;
}

// Polls `onPoll` on a fixed interval for as long as `status` is 'PROCESSING'.
// Has no API knowledge itself: the caller is expected to update `status` by
// refetching inside `onPoll`. There is no per-item GET endpoint for posts or
// profiles, so `onPoll` is typically a whole-list/whole-profile refetch.
export function useMediaStatusPolling(
  status: MediaStatus | null | undefined,
  onPoll: () => void,
  options: UseMediaStatusPollingOptions = {},
): { timedOut: boolean } {
  const { intervalMs = 2000, maxAttempts = 15 } = options;
  const [timedOut, setTimedOut] = useState(false);
  // Ref so a fresh `onPoll` identity each render doesn't restart the interval.
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;

  useEffect(() => {
    if (status !== 'PROCESSING') {
      setTimedOut(false);
      return;
    }

    let attempts = 0;
    const interval = setInterval(() => {
      attempts += 1;
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        setTimedOut(true);
        return;
      }
      onPollRef.current();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [status, intervalMs, maxAttempts]);

  return { timedOut };
}
