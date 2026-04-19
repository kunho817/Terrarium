import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/plugin-fs', () => import('../__mocks__/tauri-plugin-fs'));

import { readTextFile, writeTextFile, mkdir, readDir, exists, remove, rename } from '@tauri-apps/plugin-fs';
import { readJson, writeJson, writeJsonAtomic, ensureDir, listDirs, removePath, existsPath } from '$lib/storage/database';

describe('database', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('readJson', () => {
    it('parses JSON from file', async () => {
      const data = { name: 'test', value: 42 };
      vi.mocked(readTextFile).mockResolvedValue(JSON.stringify(data));

      const result = await readJson<{ name: string; value: number }>('test.json');

      expect(readTextFile).toHaveBeenCalledWith('test.json', { baseDir: 1 });
      expect(result).toEqual(data);
    });
  });

  describe('writeJson', () => {
    it('writes formatted JSON to file', async () => {
      vi.mocked(writeTextFile).mockResolvedValue(undefined);

      await writeJson('test.json', { name: 'test' });

      expect(writeTextFile).toHaveBeenCalledWith(
        'test.json',
        JSON.stringify({ name: 'test' }, null, 2),
        { baseDir: 1 }
      );
    });
  });

  describe('ensureDir', () => {
    it('creates directory if it does not exist', async () => {
      vi.mocked(exists).mockResolvedValue(false);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      await ensureDir('characters/abc');

      expect(mkdir).toHaveBeenCalledWith(
        'characters/abc',
        { baseDir: 1, recursive: true }
      );
    });

    it('skips creation if directory already exists', async () => {
      vi.mocked(exists).mockResolvedValue(true);

      await ensureDir('characters/abc');

      expect(mkdir).not.toHaveBeenCalled();
    });
  });

  describe('listDirs', () => {
    it('returns subdirectory names', async () => {
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(readDir).mockResolvedValue([
        { name: 'char-1', isDirectory: true, isFile: false } as any,
        { name: 'char-2', isDirectory: true, isFile: false } as any,
        { name: 'file.txt', isDirectory: false, isFile: true } as any,
      ]);

      const result = await listDirs('characters');

      expect(result).toEqual(['char-1', 'char-2']);
    });

    it('returns empty array if directory does not exist', async () => {
      vi.mocked(exists).mockResolvedValue(false);

      const result = await listDirs('characters');

      expect(result).toEqual([]);
    });
  });

  describe('removePath', () => {
    it('removes path if it exists', async () => {
      vi.mocked(exists).mockResolvedValue(true);
      vi.mocked(remove).mockResolvedValue(undefined);

      await removePath('characters/old-char');

      expect(remove).toHaveBeenCalledWith(
        'characters/old-char',
        { baseDir: 1, recursive: true }
      );
    });

    it('does nothing if path does not exist', async () => {
      vi.mocked(exists).mockResolvedValue(false);

      await removePath('characters/nonexistent');

      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe('existsPath', () => {
    it('returns true when path exists', async () => {
      vi.mocked(exists).mockResolvedValue(true);
      expect(await existsPath('settings.json')).toBe(true);
    });

    it('returns false when path does not exist', async () => {
      vi.mocked(exists).mockResolvedValue(false);
      expect(await existsPath('nonexistent.json')).toBe(false);
    });
  });

  describe('writeJsonAtomic', () => {
    it('writes to temp file then renames', async () => {
      vi.mocked(writeTextFile).mockResolvedValue(undefined);
      vi.mocked(rename).mockResolvedValue(undefined);

      await writeJsonAtomic('test/path.json', { hello: 'world' });

      expect(writeTextFile).toHaveBeenCalledWith(
        'test/path.json.tmp',
        JSON.stringify({ hello: 'world' }, null, 2),
        { baseDir: 1 },
      );
      expect(rename).toHaveBeenCalledWith('test/path.json.tmp', 'test/path.json', { oldPathBaseDir: 1, newPathBaseDir: 1 });
    });
  });
});
