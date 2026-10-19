import { useEffect, useRef, useState, useCallback } from 'react';
import type { SSEEventData } from '@simrt/shared-types';
import { notify } from './use-app-notify.js';

interface UseSSEOptions {
  url: string;
  token: string | null;
  onEvent?: (event: SSEEventData) => void;
  playChime?: boolean;
}

/**
 * Synthesize soft notification chime using Web Audio API (Zero external file dependencies)
 */
function playWebAudioChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Two-tone gentle chime: C6 (1046.5 Hz) -> E6 (1318.5 Hz)
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1318.5, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio autoplay restrictions or headless environment
  }
}

export function useSSE({ url, token, onEvent, playChime = true }: UseSSEOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastEvent, setLastEvent] = useState<SSEEventData | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const connect = useCallback(() => {
    if (!token) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sseUrl = `${url}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      retryCountRef.current = 0;
    };

    es.addEventListener('notification', (e) => {
      try {
        const data: SSEEventData = JSON.parse(e.data);
        setLastEvent(data);
        setUnreadCount((prev) => prev + 1);

        if (playChime) {
          playWebAudioChime();
        }

        // Show Ephemeral Toast
        notify.info({
          title: data.title,
          description: data.message,
        });

        if (onEvent) {
          onEvent(data);
        }
      } catch (err) {
        console.error('Failed to parse SSE notification payload:', err);
      }
    });

    es.addEventListener('security_alert', (e) => {
      try {
        const data: SSEEventData = JSON.parse(e.data);
        setLastEvent(data);
        setUnreadCount((prev) => prev + 1);

        if (playChime) {
          playWebAudioChime();
        }

        notify.security({
          title: data.title,
          description: data.message,
        });

        if (onEvent) {
          onEvent(data);
        }
      } catch (err) {
        console.error('Failed to parse SSE security alert payload:', err);
      }
    });

    es.onerror = () => {
      setIsConnected(false);
      es.close();

      // Exponential backoff with random jitter (1s - 30s)
      const maxDelay = 30000;
      const baseDelay = Math.min(1000 * Math.pow(1.5, retryCountRef.current), maxDelay);
      const jitter = Math.random() * 1000;
      const delay = baseDelay + jitter;

      retryCountRef.current++;

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [url, token, onEvent, playChime]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  const clearUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return {
    isConnected,
    unreadCount,
    lastEvent,
    clearUnreadCount,
  };
}
