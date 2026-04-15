import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { charactersRepo } from '$lib/repositories/characters-repo';
import { chatRepo } from '$lib/repositories/chat-repo';
import { sceneRepo } from '$lib/repositories/scene-repo';
import { charactersStore } from '$lib/stores/characters';
import { chatStore } from '$lib/stores/chat';
import { sceneStore } from '$lib/stores/scene';
import { settingsRepo } from '$lib/repositories/settings-repo';
import { settingsStore } from '$lib/stores/settings';
import type { CharacterCard, WorldCard } from '$lib/types';

// Mock all storage modules
vi.mock('$lib/storage/characters');
vi.mock('$lib/storage/chats');
vi.mock('$lib/storage/settings');
vi.mock('$lib/core/bootstrap', () => ({
  getRegistry: vi.fn(() => ({
    listProviders: vi.fn(() => []),
    getProvider: vi.fn(),
  })),
  getEngine: vi.fn(() => ({
    send: vi.fn(),
  })),
}));

describe('Chat Flow Integration', () => {
  // Import mocked modules
  let characterStorage: typeof import('$lib/storage/characters');
  let chatStorage: typeof import('$lib/storage/chats');
  let settingsStorage: typeof import('$lib/storage/settings');

  const mockCharacter: CharacterCard = {
    id: 'char-1',
    name: 'Test Character',
    description: 'A test character',
    personality: 'Friendly',
    scenario: 'Test scenario',
    firstMessage: 'Hello! I am a test character.',
    alternateGreetings: [],
    exampleMessages: '',
    systemPrompt: '',
    postHistoryInstructions: '',
    creator: 'Test',
    characterVersion: '1.0',
    tags: ['test'],
    creatorNotes: '',
    lorebook: [],
    loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
    regexScripts: [],
    triggers: [],
    scriptState: {},
    emotionImages: [],
    additionalAssets: [],
    metadata: {},
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Reset all stores
    charactersStore.reset();
    chatStore.clear();
    sceneStore.reset();
    settingsStore.set({
      defaultProvider: '',
      theme: 'default',
      providers: {},
      developerMode: false,
      imageGeneration: { provider: 'none' } as any,
      modelSlots: {},
      memorySettings: {
        extractionBatchSize: 5,
        tokenBudget: 4096,
        topK: 15,
        summaryThreshold: 50,
        embeddingProvider: '',
        embeddingApiKey: '',
        embeddingModel: '',
      },
      outputLanguage: '',
    });

    // Import mocked modules
    characterStorage = await import('$lib/storage/characters');
    chatStorage = await import('$lib/storage/chats');
    settingsStorage = await import('$lib/storage/settings');

    // Setup default mock implementations
    vi.mocked(characterStorage.listCharacters).mockResolvedValue([
      { id: 'char-1', name: 'Test Character' },
    ]);
    vi.mocked(characterStorage.loadCharacter).mockResolvedValue(mockCharacter);
    vi.mocked(characterStorage.saveCharacter).mockResolvedValue(undefined);
    vi.mocked(characterStorage.deleteCharacter).mockResolvedValue(undefined);
    vi.mocked(characterStorage.createCharacter).mockResolvedValue('char-1');

    vi.mocked(chatStorage.loadMessages).mockResolvedValue([]);
    vi.mocked(chatStorage.saveMessages).mockResolvedValue(undefined);
    vi.mocked(chatStorage.listSessions).mockResolvedValue([]);
    vi.mocked(chatStorage.createSession).mockResolvedValue({
      id: 'session-1',
      name: 'Chat',
      lastMessageAt: Date.now(),
    });
    vi.mocked(chatStorage.loadScene).mockResolvedValue(null);
    vi.mocked(chatStorage.saveScene).mockResolvedValue(undefined);

    vi.mocked(settingsStorage.loadSettings).mockResolvedValue({
      defaultProvider: '',
      theme: 'default',
      providers: {},
      developerMode: false,
    });
    vi.mocked(settingsStorage.saveSettings).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Character Selection Flow', () => {
    it('should load character and initialize chat session', async () => {
      // Load character
      await charactersRepo.selectCharacter('char-1');
      
      const charState = get(charactersStore);
      expect(charState.currentId).toBe('char-1');
      expect(charState.current?.name).toBe('Test Character');
      
      // Initialize chat
      await chatRepo.loadChat('char-1');
      
      const chatState = get(chatStore);
      expect(chatState.chatId).toBe('char-1');
      expect(chatState.sessionId).toBeDefined();
    });

    it('should load scene for character', async () => {
      const mockScene = {
        location: 'Test Location',
        time: 'Morning',
        mood: 'Happy',
      };
      vi.mocked(chatStorage.loadScene).mockResolvedValue(mockScene);

      await charactersRepo.selectCharacter('char-1');
      await chatRepo.loadChat('char-1');
      
      const chatState = get(chatStore);
      if (chatState.sessionId) {
        await sceneRepo.loadScene('char-1', chatState.sessionId);
        
        const sceneState = get(sceneStore);
        expect(sceneState.location).toBe('Test Location');
        expect(sceneState.time).toBe('Morning');
      }
    });

    it('should handle character load errors gracefully', async () => {
      vi.mocked(characterStorage.loadCharacter).mockRejectedValue(
        new Error('Character not found')
      );

      await expect(charactersRepo.selectCharacter('invalid-id')).rejects.toThrow();
      
      const charState = get(charactersStore);
      expect(charState.isLoading).toBe(false);
      expect(charState.currentId).toBeNull();
    });
  });

  describe('Chat Session Flow', () => {
    it('should create and switch between sessions', async () => {
      await charactersRepo.selectCharacter('char-1');
      
      // Create first session
      vi.mocked(chatStorage.listSessions).mockResolvedValue([]);
      await chatRepo.loadChat('char-1');
      
      const firstSession = get(chatStore).sessionId;
      expect(firstSession).toBeDefined();
      
      // Simulate creating a second session
      vi.mocked(chatStorage.createSession).mockResolvedValue({
        id: 'session-2',
        name: 'Second Chat',
        lastMessageAt: Date.now(),
      });
      
      const secondSessionId = await chatRepo.createSession('char-1');
      expect(secondSessionId).toBe('session-2');
      
      // Switch to new session
      await chatRepo.loadSession('char-1', secondSessionId);
      
      const chatState = get(chatStore);
      expect(chatState.sessionId).toBe('session-2');
    });

    it('should persist messages across session switch', async () => {
      const mockMessages = [
        { role: 'user', content: 'Hello', type: 'dialogue', timestamp: Date.now() },
        { role: 'assistant', content: 'Hi there!', type: 'dialogue', timestamp: Date.now() },
      ];
      
      vi.mocked(chatStorage.loadMessages).mockResolvedValue(mockMessages);
      
      await charactersRepo.selectCharacter('char-1');
      await chatRepo.loadSession('char-1', 'session-1');
      
      const chatState = get(chatStore);
      expect(chatState.messages).toHaveLength(2);
      expect(chatState.messages[0].content).toBe('Hello');
    });

    it('should save messages to storage', async () => {
      await charactersRepo.selectCharacter('char-1');
      await chatRepo.loadChat('char-1');
      
      chatStore.addMessage({
        role: 'user',
        content: 'Test message',
        type: 'dialogue',
        timestamp: Date.now(),
      });
      
      await chatRepo.saveMessages();
      
      expect(chatStorage.saveMessages).toHaveBeenCalled();
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle storage errors with typed errors', async () => {
      vi.mocked(characterStorage.loadCharacter).mockRejectedValue(
        new Error('Storage error')
      );

      try {
        await charactersRepo.selectCharacter('char-1');
        throw new Error('Should have thrown');
      } catch (error: any) {
        expect(error.category).toBe('storage');
        expect(error.severity).toBe('error');
      }
    });

    it('should maintain state consistency on error', async () => {
      vi.mocked(chatStorage.loadMessages).mockRejectedValue(
        new Error('Load failed')
      );

      await expect(chatRepo.loadSession('char-1', 'session-1')).rejects.toThrow();
      
      const chatState = get(chatStore);
      expect(chatState.isLoading).toBe(false);
    });
  });

  describe('Settings Integration', () => {
    it('should load settings on app initialization', async () => {
      await settingsRepo.load();
      
      const settings = get(settingsStore);
      expect(settings.theme).toBe('default');
    });

    it('should handle settings load errors', async () => {
      vi.mocked(settingsStorage.loadSettings).mockRejectedValue(
        new Error('Settings corrupted')
      );

      await expect(settingsRepo.load()).rejects.toThrow();
    });
  });
});
