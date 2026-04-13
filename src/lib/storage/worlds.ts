import type { WorldCard } from '$lib/types';
import { readJson, writeJson, ensureDir, listDirs, removePath } from './database';
import { PATHS } from './paths';

export async function listWorlds(): Promise<{ id: string; name: string }[]> {
  const dirs = await listDirs(PATHS.worlds);
  const worlds: { id: string; name: string }[] = [];

  for (const id of dirs) {
    try {
      const card = await readJson<WorldCard>(PATHS.worldFile(id));
      worlds.push({ id, name: card.name });
    } catch {
    }
  }

  return worlds;
}

export async function loadWorld(id: string): Promise<WorldCard> {
  return readJson<WorldCard>(PATHS.worldFile(id));
}

export async function saveWorld(id: string, card: WorldCard): Promise<void> {
  await ensureDir(PATHS.worldDir(id));
  await writeJson(PATHS.worldFile(id), card);
}

export async function deleteWorld(id: string): Promise<void> {
  await removePath(PATHS.worldDir(id));
}

export async function createWorld(card: WorldCard): Promise<string> {
  const id = crypto.randomUUID();
  await saveWorld(id, card);
  return id;
}
