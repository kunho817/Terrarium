/**
 * Character card CRUD operations.
 * Character data stored as JSON in characters/{id}/card.json
 */

import type { CharacterCard } from '$lib/types';
import { readJson, writeJson, ensureDir, listDirs, removePath } from './database';
import { PATHS } from './paths';

export async function listCharacters(): Promise<{ id: string; name: string }[]> {
  const dirs = await listDirs(PATHS.characters);
  const characters: { id: string; name: string }[] = [];

  for (const id of dirs) {
    try {
      const card = await readJson<CharacterCard>(PATHS.characterCard(id));
      characters.push({ id, name: card.name });
    } catch {
      // Skip directories with invalid/corrupt card data
    }
  }

  return characters;
}

export async function loadCharacter(id: string): Promise<CharacterCard> {
  return readJson<CharacterCard>(PATHS.characterCard(id));
}

export async function saveCharacter(id: string, card: CharacterCard): Promise<void> {
  await ensureDir(PATHS.characterDir(id));
  await writeJson(PATHS.characterCard(id), card);
}

export async function deleteCharacter(id: string): Promise<void> {
  await removePath(PATHS.characterDir(id));
}

export async function createCharacter(card: CharacterCard): Promise<string> {
  const id = crypto.randomUUID();
  await saveCharacter(id, card);
  return id;
}
