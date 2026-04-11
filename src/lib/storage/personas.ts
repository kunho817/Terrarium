/**
 * Persona CRUD operations.
 * Persona data stored as JSON in personas/{id}/persona.json
 */

import type { UserPersona } from '$lib/types/persona';
import { readJson, writeJson, ensureDir, listDirs, removePath } from './database';
import { PATHS } from './paths';

export async function listPersonas(): Promise<{ id: string; name: string }[]> {
  const dirs = await listDirs(PATHS.personas);
  const personas: { id: string; name: string }[] = [];

  for (const id of dirs) {
    try {
      const persona = await readJson<UserPersona>(PATHS.personaFile(id));
      personas.push({ id, name: persona.name });
    } catch {
      // Skip directories with invalid/corrupt data
    }
  }

  return personas;
}

export async function loadPersona(id: string): Promise<UserPersona> {
  return readJson<UserPersona>(PATHS.personaFile(id));
}

export async function savePersona(id: string, persona: UserPersona): Promise<void> {
  await ensureDir(PATHS.personaDir(id));
  await writeJson(PATHS.personaFile(id), persona);
}

export async function deletePersona(id: string): Promise<void> {
  await removePath(PATHS.personaDir(id));
}

export async function createPersona(persona: UserPersona): Promise<string> {
  const id = crypto.randomUUID();
  await savePersona(id, persona);
  return id;
}
