/**
 * Low-level file I/O helpers wrapping @tauri-apps/plugin-fs.
 * All operations use BaseDirectory.AppData as the root.
 */

import {
  readTextFile,
  writeTextFile,
  mkdir,
  readDir,
  exists,
  remove,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';

const BASE = { baseDir: BaseDirectory.AppData };

export async function readJson<T>(path: string): Promise<T> {
  const content = await readTextFile(path, BASE);
  return JSON.parse(content);
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await writeTextFile(path, JSON.stringify(data, null, 2), BASE);
}

export async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path, BASE))) {
    await mkdir(path, { ...BASE, recursive: true });
  }
}

export async function listDirs(path: string): Promise<string[]> {
  if (!(await exists(path, BASE))) {
    return [];
  }
  const entries = await readDir(path, BASE);
  return entries.filter((e) => e.isDirectory).map((e) => e.name);
}

export async function removePath(path: string): Promise<void> {
  if (await exists(path, BASE)) {
    await remove(path, { ...BASE, recursive: true });
  }
}

export async function existsPath(path: string): Promise<boolean> {
  return exists(path, BASE);
}
