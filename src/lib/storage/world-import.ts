import type { WorldCard } from '$lib/types';
import { createDefaultWorldCard } from '$lib/types';

const TCWORLD_SPEC = 'tcworld';
const TCWORLD_VERSION = '1.0';

const REQUIRED_DATA_FIELDS: (keyof WorldCard)[] = ['name', 'description'];

export function validateWorldCard(data: ArrayBuffer): boolean {
  try {
    const text = new TextDecoder().decode(data);
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return false;
    if (parsed.spec !== TCWORLD_SPEC) return false;
    if (typeof parsed.data !== 'object' || parsed.data === null) return false;
    return REQUIRED_DATA_FIELDS.every((field) => field in parsed.data);
  } catch {
    return false;
  }
}

export function parseWorldCard(data: ArrayBuffer): WorldCard {
  const text = new TextDecoder().decode(data);
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON in world card file');
  }
  if (parsed.spec !== TCWORLD_SPEC || !parsed.data) {
    throw new Error('Not a valid .tcworld file');
  }
  const defaults = createDefaultWorldCard();
  return { ...defaults, ...parsed.data } as WorldCard;
}

export function exportWorldCard(card: WorldCard): ArrayBuffer {
  const envelope = {
    spec: TCWORLD_SPEC,
    specVersion: TCWORLD_VERSION,
    data: card,
  };
  const json = JSON.stringify(envelope, null, 2);
  return new TextEncoder().encode(json).buffer;
}
