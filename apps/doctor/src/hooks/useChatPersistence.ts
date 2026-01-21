/**
 * useChatPersistence Hook
 *
 * Manages localStorage persistence for chat sessions.
 * Auto-expires sessions after 24 hours.
 */

import { useCallback } from 'react';
import type { ChatSession, VoiceSessionType } from '@/types/voice-assistant';

const STORAGE_PREFIX = 'voice_chat';
const EXPIRY_HOURS = 24;

/**
 * Generate storage key for a chat session
 */
function getStorageKey(patientId: string, sessionType: VoiceSessionType): string {
  return `${STORAGE_PREFIX}_${patientId}_${sessionType}`;
}

/**
 * Check if a session has expired
 */
function isExpired(timestamp: string | Date): boolean {
  const createdAt = new Date(timestamp);
  const now = new Date();
  const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  return hoursDiff > EXPIRY_HOURS;
}

/**
 * Serialize session for storage (convert Date objects to strings)
 */
function serializeSession(session: ChatSession): string {
  return JSON.stringify({
    ...session,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messages: session.messages.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    })),
  });
}

/**
 * Deserialize session from storage (convert strings back to Date objects)
 */
function deserializeSession(data: string): ChatSession | null {
  try {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
      messages: parsed.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
    };
  } catch (e) {
    console.error('[useChatPersistence] Failed to deserialize session:', e);
    return null;
  }
}

export interface UseChatPersistenceReturn {
  saveSession: (patientId: string, sessionType: VoiceSessionType, session: ChatSession) => void;
  loadSession: (patientId: string, sessionType: VoiceSessionType) => ChatSession | null;
  clearSession: (patientId: string, sessionType: VoiceSessionType) => void;
  clearAllSessions: () => void;
}

export function useChatPersistence(): UseChatPersistenceReturn {
  /**
   * Save a chat session to localStorage
   */
  const saveSession = useCallback(
    (patientId: string, sessionType: VoiceSessionType, session: ChatSession): void => {
      if (typeof window === 'undefined') return;

      try {
        const key = getStorageKey(patientId, sessionType);
        const serialized = serializeSession(session);
        localStorage.setItem(key, serialized);
      } catch (e) {
        console.error('[useChatPersistence] Failed to save session:', e);
      }
    },
    []
  );

  /**
   * Load a chat session from localStorage
   * Returns null if session doesn't exist or is expired
   */
  const loadSession = useCallback(
    (patientId: string, sessionType: VoiceSessionType): ChatSession | null => {
      if (typeof window === 'undefined') return null;

      try {
        const key = getStorageKey(patientId, sessionType);
        const stored = localStorage.getItem(key);

        if (!stored) return null;

        const session = deserializeSession(stored);

        if (!session) {
          // Failed to deserialize, clear corrupted data
          localStorage.removeItem(key);
          return null;
        }

        // Check if session is expired
        if (isExpired(session.createdAt)) {
          localStorage.removeItem(key);
          return null;
        }

        return session;
      } catch (e) {
        console.error('[useChatPersistence] Failed to load session:', e);
        return null;
      }
    },
    []
  );

  /**
   * Clear a specific chat session from localStorage
   */
  const clearSession = useCallback(
    (patientId: string, sessionType: VoiceSessionType): void => {
      if (typeof window === 'undefined') return;

      try {
        const key = getStorageKey(patientId, sessionType);
        localStorage.removeItem(key);
      } catch (e) {
        console.error('[useChatPersistence] Failed to clear session:', e);
      }
    },
    []
  );

  /**
   * Clear all voice chat sessions from localStorage
   * (useful for cleanup or logout)
   */
  const clearAllSessions = useCallback((): void => {
    if (typeof window === 'undefined') return;

    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (e) {
      console.error('[useChatPersistence] Failed to clear all sessions:', e);
    }
  }, []);

  return {
    saveSession,
    loadSession,
    clearSession,
    clearAllSessions,
  };
}
