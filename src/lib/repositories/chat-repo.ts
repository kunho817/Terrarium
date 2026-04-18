/**
 * Chat repository — handles persistence for chat store.
 */

import { get } from 'svelte/store';
import { chatStore } from '$lib/stores/chat';
import { StorageError, ValidationError } from '$lib/errors/error-types';
import { logger } from '$lib/utils/logger';
import * as chatStorage from '$lib/storage/chats';
import type { Message } from '$lib/types';
import { makeCharacterId, makeSessionId } from '$lib/types/branded';

const log = logger.scope('ChatRepo');

export const chatRepo = {
  /**
   * Load messages for a specific character and session.
   */
  async loadSession(characterId: string, sessionId: string): Promise<void> {
    if (!characterId || !sessionId) {
      throw new ValidationError('ids', 'Character ID and Session ID are required');
    }
    
    chatStore.update((s) => ({ ...s, isLoading: true }));
    log.debug('Loading session', { characterId, sessionId });
    
    try {
      const messages = await chatStorage.loadMessages(characterId, sessionId);
      chatStore.setSessionState(makeCharacterId(characterId), makeSessionId(sessionId), messages);
      log.info('Session loaded', { characterId, sessionId, messageCount: messages.length });
    } catch (error) {
      chatStore.setSessionState(makeCharacterId(characterId), makeSessionId(sessionId), []);
      throw new StorageError(
        'loadMessages',
        'Failed to load chat messages',
        error as Error
      );
    }
  },

  /**
   * Legacy compat: loadChat migrates to session-aware automatically.
   * Loads the most recent session for the character, or creates one.
   */
  async loadChat(chatId: string): Promise<void> {
    if (!chatId) {
      throw new ValidationError('chatId', 'Chat ID is required');
    }
    
    chatStore.update((s) => ({ ...s, isLoading: true }));
    log.debug('Loading chat', { chatId });
    
    try {
      await chatStorage.listSessions(chatId); // triggers migration
      const sessions = await chatStorage.listSessions(chatId);
      let sessionId: ReturnType<typeof makeSessionId>;

      if (sessions.length > 0) {
        sessions.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
        sessionId = sessions[0].id;
        log.debug('Using existing session', { sessionId: sessionId as string });
      } else {
        const session = await chatStorage.createSession(chatId);
        sessionId = session.id;
        log.info('Created new session', { sessionId: sessionId as string });
      }

      const messages = await chatStorage.loadMessages(chatId, sessionId as string);
      chatStore.setSessionState(makeCharacterId(chatId), sessionId, messages);
      log.info('Chat loaded', { chatId, sessionId, messageCount: messages.length });
    } catch (error) {
      chatStore.clear();
      throw new StorageError(
        'loadChat',
        'Failed to load chat',
        error as Error
      );
    }
  },

  /**
   * Save current messages to storage.
   */
  async saveMessages(): Promise<void> {
    const state = get(chatStore);
    if (state.characterId && state.sessionId) {
      try {
        await chatStorage.saveMessages(state.characterId, state.sessionId, state.messages);
        log.debug('Messages saved', { 
          chatId: state.chatId, 
          sessionId: state.sessionId,
          messageCount: state.messages.length 
        });
      } catch (error) {
        throw new StorageError(
          'saveMessages',
          'Failed to save messages',
          error as Error
        );
      }
    }
  },

  /**
   * Create a new session for a character.
   */
  async createSession(characterId: string): Promise<string> {
    try {
      const session = await chatStorage.createSession(characterId);
      log.info('Session created', { characterId, sessionId: session.id });
      return session.id;
    } catch (error) {
      throw new StorageError(
        'createSession',
        'Failed to create chat session',
        error as Error
      );
    }
  },

  /**
   * Load a specific session by ID.
   */
  async loadSessionById(characterId: string, sessionId: string): Promise<void> {
    await this.loadSession(characterId, sessionId);
  },
};
