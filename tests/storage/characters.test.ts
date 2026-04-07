import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database module
vi.mock('$lib/storage/database', () => ({
  readJson: vi.fn(),
  writeJson: vi.fn(),
  ensureDir: vi.fn(),
  listDirs: vi.fn(),
  removePath: vi.fn(),
  existsPath: vi.fn(),
}));

import { readJson, writeJson, ensureDir, listDirs, removePath } from '$lib/storage/database';
import {
  listCharacters,
  loadCharacter,
  saveCharacter,
  deleteCharacter,
  createCharacter,
} from '$lib/storage/characters';
import type { CharacterCard } from '$lib/types';

const mockCard: CharacterCard = {
  name: 'Test Character',
  description: 'A test character',
  personality: 'Friendly',
  scenario: 'Testing',
  firstMessage: 'Hello!',
  alternateGreetings: [],
  exampleMessages: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  creator: 'test',
  characterVersion: '1.0',
  tags: [],
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

describe('character storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listCharacters', () => {
    it('returns list of character ids and names', async () => {
      vi.mocked(listDirs).mockResolvedValue(['char-1', 'char-2']);
      vi.mocked(readJson)
        .mockResolvedValueOnce({ ...mockCard, name: 'Alice' })
        .mockResolvedValueOnce({ ...mockCard, name: 'Bob' });

      const result = await listCharacters();

      expect(result).toEqual([
        { id: 'char-1', name: 'Alice' },
        { id: 'char-2', name: 'Bob' },
      ]);
    });

    it('skips characters with invalid card data', async () => {
      vi.mocked(listDirs).mockResolvedValue(['good', 'bad']);
      vi.mocked(readJson)
        .mockResolvedValueOnce({ ...mockCard, name: 'Good' })
        .mockRejectedValueOnce(new Error('parse error'));

      const result = await listCharacters();

      expect(result).toEqual([{ id: 'good', name: 'Good' }]);
    });

    it('returns empty array when no characters exist', async () => {
      vi.mocked(listDirs).mockResolvedValue([]);

      const result = await listCharacters();

      expect(result).toEqual([]);
    });
  });

  describe('loadCharacter', () => {
    it('loads a character card by id', async () => {
      vi.mocked(readJson).mockResolvedValue(mockCard);

      const result = await loadCharacter('char-1');

      expect(readJson).toHaveBeenCalledWith('characters/char-1/card.json');
      expect(result).toEqual(mockCard);
    });
  });

  describe('saveCharacter', () => {
    it('creates directory and writes card', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJson).mockResolvedValue(undefined);

      await saveCharacter('char-1', mockCard);

      expect(ensureDir).toHaveBeenCalledWith('characters/char-1');
      expect(writeJson).toHaveBeenCalledWith('characters/char-1/card.json', mockCard);
    });
  });

  describe('deleteCharacter', () => {
    it('removes the character directory', async () => {
      vi.mocked(removePath).mockResolvedValue(undefined);

      await deleteCharacter('char-1');

      expect(removePath).toHaveBeenCalledWith('characters/char-1');
    });
  });

  describe('createCharacter', () => {
    it('generates an id and saves the card', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJson).mockResolvedValue(undefined);

      const id = await createCharacter(mockCard);

      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(ensureDir).toHaveBeenCalled();
      expect(writeJson).toHaveBeenCalled();
    });
  });
});
