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

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const playChimeRef = useRef(playChime);
  playChimeRef.current = playChime;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const connect = useCallback(() => {
    if (!token || !url) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      const sseUrl = `${url}?token=${encodeURIComponent(token)}`;
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected((prev) => (!prev ? true : prev));
        retryCountRef.current = 0;
      };

      es.addEventListener('connected', () => {
        setIsConnected((prev) => (!prev ? true : prev));
        retryCountRef.current = 0;
      });

      es.addEventListener('system', () => {
        setIsConnected((prev) => (!prev ? true : prev));
        retryCountRef.current = 0;
      });

      es.addEventListener('notification', (e) => {
        try {
          const data: SSEEventData = JSON.parse(e.data);
          setLastEvent(data);
          setUnreadCount((prev) => prev + 1);

          if (playChimeRef.current) {
            playWebAudioChime();
          }

          // Show Ephemeral Toast
          notify.info({
            title: data.title,
            description: data.message,
          });

          onEventRef.current?.(data);
        } catch (err) {
          console.error('Failed to parse SSE notification payload:', err);
        }
      });

      es.addEventListener('security_alert', (e) => {
        try {
          const data: SSEEventData = JSON.parse(e.data);
          setLastEvent(data);
          setUnreadCount((prev) => prev + 1);

          if (playChimeRef.current) {
            playWebAudioChime();
          }

          notify.security({
            title: data.title,
            description: data.message,
          });

          onEventRef.current?.(data);
        } catch (err) {
          console.error('Failed to parse SSE security alert payload:', err);
        }
      });

      es.onerror = () => {
        setIsConnected((prev) => (prev ? false : prev));
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Exponential backoff to avoid hammering server or spinning in loop
        retryCountRef.current++;
        const delay =
          retryCountRef.current > 5
            ? 60000 // 60s cooldown if repeated failures
            : Math.min(5000 * retryCountRef.current, 30000);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (token) {
            connect();
          }
        }, delay);
      };
    } catch {
      setIsConnected(false);
    }
  }, [url, token]);

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
