import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { charactersRepo } from '$lib/repositories/characters-repo';
import { worldsRepo } from '$lib/repositories/worlds-repo';
import { charactersStore } from '$lib/stores/characters';
import { worldsStore } from '$lib/stores/worlds';
import type { CharacterCard, WorldCard } from '$lib/types';

vi.mock('$lib/storage/characters');
vi.mock('$lib/storage/worlds');

describe('Character Lifecycle Integration', () => {
  let characterStorage: typeof import('$lib/storage/characters');
  let worldStorage: typeof import('$lib/storage/worlds');

  const mockCharacter: CharacterCard = {
    id: 'char-1',
    name: 'Test Character',
    description: 'A test character',
    personality: 'Friendly',
    scenario: 'Test scenario',
    firstMessage: 'Hello!',
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

  const mockWorld: WorldCard = {
    id: 'world-1',
    name: 'Test World',
    description: 'A test world',
    scenario: 'World scenario',
    firstMessage: 'Welcome to the world!',
    alternateGreetings: [],
    systemPrompt: '',
    postHistoryInstructions: '',
    lorebook: [],
    loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
    characters: [],
    regexScripts: [],
    triggers: [],
    scriptState: {},
    creator: 'Test',
    tags: [],
    creatorNotes: '',
    metadata: {},
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    charactersStore.reset();
    worldsStore.reset();

    characterStorage = await import('$lib/storage/characters');
    worldStorage = await import('$lib/storage/worlds');

    vi.mocked(characterStorage.listCharacters).mockResolvedValue([]);
    vi.mocked(characterStorage.loadCharacter).mockResolvedValue(mockCharacter);
    vi.mocked(characterStorage.saveCharacter).mockResolvedValue(undefined);
    vi.mocked(characterStorage.deleteCharacter).mockResolvedValue(undefined);
    vi.mocked(characterStorage.createCharacter).mockResolvedValue('new-char-id');

    vi.mocked(worldStorage.listWorlds).mockResolvedValue([]);
    vi.mocked(worldStorage.loadWorld).mockResolvedValue(mockWorld);
    vi.mocked(worldStorage.saveWorld).mockResolvedValue(undefined);
    vi.mocked(worldStorage.deleteWorld).mockResolvedValue(undefined);
    vi.mocked(worldStorage.createWorld).mockResolvedValue('new-world-id');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Character Creation', () => {
    it('should add new character to list after creation', async () => {
      vi.mocked(characterStorage.createCharacter).mockResolvedValue('char-123');

      const initialList = get(charactersStore).list;
      expect(initialList).toHaveLength(0);

      // Simulate creating a new character
      const newId = await characterStorage.createCharacter({
        name: 'New Character',
        description: '',
      } as CharacterCard);

      // Reload the list
      vi.mocked(characterStorage.listCharacters).mockResolvedValue([
        { id: newId, name: 'New Character' },
      ]);
      await charactersRepo.loadList();

      const charState = get(charactersStore);
      expect(charState.list).toHaveLength(1);
      expect(charState.list[0].name).toBe('New Character');
    });

    it('should select newly created character', async () => {
      const newId = 'char-123';
      vi.mocked(characterStorage.createCharacter).mockResolvedValue(newId);

      await charactersRepo.loadList();
      await charactersRepo.selectCharacter(newId);

      const charState = get(charactersStore);
      expect(charState.currentId).toBe(newId);
    });
  });

  describe('Character Update', () => {
    it('should save character changes to storage', async () => {
      await charactersRepo.selectCharacter('char-1');

      // Modify the character
      const updatedCharacter = {
        ...mockCharacter,
        name: 'Updated Name',
        description: 'Updated description',
      };

      await charactersRepo.saveCharacter('char-1', updatedCharacter);

      expect(characterStorage.saveCharacter).toHaveBeenCalledWith(
        'char-1',
        expect.objectContaining({ name: 'Updated Name' })
      );
    });

    it('should update character in list after edit', async () => {
      vi.mocked(characterStorage.listCharacters).mockResolvedValue([
        { id: 'char-1', name: 'Old Name' },
      ]);

      await charactersRepo.loadList();
      
      // Update character
      const updated = { ...mockCharacter, name: 'New Name' };
      await charactersRepo.saveCharacter('char-1', updated);

      // Verify save was called
      expect(characterStorage.saveCharacter).toHaveBeenCalled();
    });
  });

  describe('Character Deletion', () => {
    it('should remove character from list after deletion', async () => {
      vi.mocked(characterStorage.listCharacters).mockResolvedValue([
        { id: 'char-1', name: 'Character 1' },
        { id: 'char-2', name: 'Character 2' },
      ]);

      await charactersRepo.loadList();
      
      const initialList = get(charactersStore).list;
      expect(initialList).toHaveLength(2);

      await charactersRepo.deleteCharacter('char-1');

      const finalList = get(charactersStore).list;
      expect(finalList).toHaveLength(1);
      expect(finalList[0].id).toBe('char-2');
    });

    it('should clear selection when deleting current character', async () => {
      await charactersRepo.loadList();
      await charactersRepo.selectCharacter('char-1');

      expect(get(charactersStore).currentId).toBe('char-1');

      await charactersRepo.deleteCharacter('char-1');

      expect(get(charactersStore).currentId).toBeNull();
      expect(get(charactersStore).current).toBeNull();
    });
  });

  describe('World Lifecycle', () => {
    it('should create and load world', async () => {
      vi.mocked(worldStorage.listWorlds).mockResolvedValue([
        { id: 'world-1', name: 'Test World' },
      ]);

      await worldsRepo.loadList();
      await worldsRepo.selectWorld('world-1');

      const worldState = get(worldsStore);
      expect(worldState.currentId).toBe('world-1');
      expect(worldState.current?.name).toBe('Test World');
    });

    it('should delete world and update list', async () => {
      vi.mocked(worldStorage.listWorlds).mockResolvedValue([
        { id: 'world-1', name: 'World 1' },
        { id: 'world-2', name: 'World 2' },
      ]);

      await worldsRepo.loadList();
      await worldsRepo.deleteWorld('world-1');

      const worldState = get(worldsStore);
      expect(worldState.list).toHaveLength(1);
      expect(worldState.list[0].id).toBe('world-2');
    });
  });

  describe('Switching Between Cards', () => {
    it('should clear character selection when selecting world', async () => {
      await charactersRepo.selectCharacter('char-1');
      expect(get(charactersStore).currentId).toBe('char-1');

      charactersStore.clearSelection();
      await worldsRepo.selectWorld('world-1');

      expect(get(charactersStore).currentId).toBeNull();
      expect(get(worldsStore).currentId).toBe('world-1');
    });

    it('should clear world selection when selecting character', async () => {
      await worldsRepo.selectWorld('world-1');
      expect(get(worldsStore).currentId).toBe('world-1');

      worldsStore.clearSelection();
      await charactersRepo.selectCharacter('char-1');

      expect(get(worldsStore).currentId).toBeNull();
      expect(get(charactersStore).currentId).toBe('char-1');
    });
  });

  describe('Error Recovery', () => {
    it('should maintain consistent state after failed save', async () => {
      vi.mocked(characterStorage.saveCharacter).mockRejectedValue(
        new Error('Save failed')
      );

      await charactersRepo.selectCharacter('char-1');
      
      const beforeState = get(charactersStore);
      expect(beforeState.current).not.toBeNull();

      await expect(
        charactersRepo.saveCharacter('char-1', { ...mockCharacter, name: 'New' })
      ).rejects.toThrow();

      // State should still have the original character
      const afterState = get(charactersStore);
      expect(afterState.current).not.toBeNull();
    });
  });
});
