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
import { listPersonas, loadPersona, savePersona, deletePersona, createPersona } from '$lib/storage/personas';
import type { UserPersona } from '$lib/types/persona';

const mockPersona: UserPersona = {
  name: 'TestUser',
  shortDescription: 'A test persona',
  detailedSettings: 'Detailed test settings',
  exampleDialogue: 'TestUser: "Hello world"',
};

describe('persona storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listPersonas', () => {
    it('returns list of persona ids and names', async () => {
      vi.mocked(listDirs).mockResolvedValue(['p1', 'p2']);
      vi.mocked(readJson)
        .mockResolvedValueOnce({ ...mockPersona, name: 'Alice' })
        .mockResolvedValueOnce({ ...mockPersona, name: 'Bob' });

      const result = await listPersonas();

      expect(result).toEqual([
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ]);
    });

    it('skips personas with invalid data', async () => {
      vi.mocked(listDirs).mockResolvedValue(['good', 'bad']);
      vi.mocked(readJson)
        .mockResolvedValueOnce({ ...mockPersona, name: 'Good' })
        .mockRejectedValueOnce(new Error('parse error'));

      const result = await listPersonas();

      expect(result).toEqual([{ id: 'good', name: 'Good' }]);
    });

    it('returns empty array when no personas exist', async () => {
      vi.mocked(listDirs).mockResolvedValue([]);

      const result = await listPersonas();

      expect(result).toEqual([]);
    });
  });

  describe('loadPersona', () => {
    it('loads a persona by id', async () => {
      vi.mocked(readJson).mockResolvedValue(mockPersona);

      const result = await loadPersona('test-id');

      expect(readJson).toHaveBeenCalledWith('personas/test-id/persona.json');
      expect(result).toEqual(mockPersona);
    });
  });

  describe('savePersona', () => {
    it('creates directory and writes persona', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJson).mockResolvedValue(undefined);

      await savePersona('test-id', mockPersona);

      expect(ensureDir).toHaveBeenCalledWith('personas/test-id');
      expect(writeJson).toHaveBeenCalledWith('personas/test-id/persona.json', mockPersona);
    });
  });

  describe('deletePersona', () => {
    it('removes the persona directory', async () => {
      vi.mocked(removePath).mockResolvedValue(undefined);

      await deletePersona('test-id');

      expect(removePath).toHaveBeenCalledWith('personas/test-id');
    });
  });

  describe('createPersona', () => {
    it('generates an id and saves the persona', async () => {
      vi.mocked(ensureDir).mockResolvedValue(undefined);
      vi.mocked(writeJson).mockResolvedValue(undefined);

      const id = await createPersona(mockPersona);

      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
      expect(ensureDir).toHaveBeenCalled();
      expect(writeJson).toHaveBeenCalled();
    });
  });
});
