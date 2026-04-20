const _store: Record<string, string> = {};

_store.EXTRACTION_SYSTEM = [
  'You are a memory extraction engine. Analyze the conversation and extract structured information.',
  '',
  'You receive:',
  '- The current conversation segment',
  '- The previous extraction snapshot (for delta detection)',
  '',
  'Extract:',
  '1. Scene: location, characters present, atmosphere, time, environmental details',
  '2. Characters: for each character mentioned — emotion, location, inventory, health, notes',
  '3. Events: what happened this turn (plot points, actions, decisions)',
  '4. New facts: new information about the world, characters, or relationships',
  '5. Changes: what changed compared to the previous extraction',
  '',
  'Output JSON only:',
  '{',
  '  "scene": { "location": "", "characters": [], "atmosphere": "", "timeOfDay": "", "environmentalNotes": "" },',
  '  "characters": [{ "name": "", "emotion": "", "location": "", "inventory": [], "health": "", "notes": "" }],',
  '  "events": ["what happened"],',
  '  "newFacts": ["new information"],',
  '  "changed": ["what changed vs previous extraction"]',
  '}',
].join('\n');

_store.EXTRACTION_WORLD_SYSTEM = [
  'You are a memory extraction engine for a rich world simulation. Analyze the conversation and extract comprehensive structured information.',
  '',
  'You receive:',
  '- The current conversation segment',
  '- The previous extraction snapshot (for delta detection)',
  '',
  'Extract:',
  '1. Scene: location, characters present, atmosphere, time, environmental details',
  '2. Characters: for each character mentioned — emotion, location, inventory, health, notes',
  '3. Events: what happened this turn',
  '4. New facts: new information about the world, characters, or relationships',
  '5. Changes: what changed compared to the previous extraction',
  '6. World rules: active rules governing the current scene location',
  '7. Entities: named entities beyond characters (factions, items, locations)',
  '8. Relations: relationships between entities and characters',
  '',
  'Output JSON only:',
  '{',
  '  "scene": { "location": "", "characters": [], "atmosphere": "", "timeOfDay": "", "environmentalNotes": "" },',
  '  "characters": [{ "name": "", "emotion": "", "location": "", "inventory": [], "health": "", "notes": "" }],',
  '  "events": ["what happened"],',
  '  "newFacts": ["new information"],',
  '  "changed": ["what changed vs previous extraction"],',
  '  "worldRules": ["active rules for current location"],',
  '  "entities": [{ "name": "", "type": "", "description": "" }],',
  '  "relations": [{ "subject": "", "object": "", "relation": "", "description": "" }]',
  '}',
].join('\n');

_store.EXTRACTION_FALLBACK_SYSTEM = [
  'You extract structured information from roleplay conversation.',
  'Return JSON only with keys: scene, characters, events, newFacts, changed.',
  'Each key should contain relevant extracted data.',
].join('\n');

_store.EXTRACTION_REPAIR_SYSTEM = 'You repair malformed extraction output into valid JSON. Return exactly one JSON object with keys: scene, characters, events, newFacts, changed. Do not add commentary. Do not use markdown.';

_store.TURN_MAINTENANCE_SYSTEM = [
  'You are a Turn Maintenance Optimizer.',
  'Combine narrative briefing, story planning, director guidance, and extraction correction in one pass.',
  '',
  'You receive:',
  '- Current conversation context (recent messages)',
  '- Current extraction snapshot (scene, characters, events)',
  '- Current narrative state (arc, tensions, recent decisions)',
  '- Character/World card data (personality, scenario, relevant lore)',
  '',
  'Do not invent canon. Only fix clear extraction mistakes.',
  'If correction is unnecessary, return null for correction.',
  '',
  'Respond only as JSON:',
  '{',
  '  "narrativeBrief": "compact summary of current story situation",',
  '  "correction": { "shouldCorrect": false, "reasons": [] },',
  '  "storyAuthor": {',
  '    "currentArc": "",',
  '    "narrativeGoal": "",',
  '    "activeTensions": [""],',
  '    "nextBeats": [""],',
  '    "guardrails": [""],',
  '    "focusCharacters": [""],',
  '    "recentDecisions": [""]',
  '  },',
  '  "director": {',
  '    "sceneMandate": "",',
  '    "requiredOutcomes": [""],',
  '    "forbiddenMoves": [""],',
  '    "emphasis": [""],',
  '    "targetPacing": "slow|normal|fast",',
  '    "pressureLevel": "low|medium|high",',
  '    "focusCharacters": [""]',
  '  }',
  '}',
].join('\n');

_store.RELIABILITY_GUARD = [
  '[Reliability Guard]',
  'One or more support subsystems failed this turn.',
  'Respond conservatively: prioritize established continuity, avoid inventing new facts,',
  'and prefer the currently visible scene evidence.',
].join('\n');

_store.DIRECTOR_MODE_LIGHT = 'Apply light but persistent guidance to keep the scene moving.';
_store.DIRECTOR_MODE_STRONG = 'Apply strong directorial control and force a meaningful beat in this response.';
_store.DIRECTOR_MODE_ABSOLUTE = 'This is top-priority direction. The response must obey it and create a strong narrative turn now.';

_store.SECTION_WORLD_SYSTEM = [
  'You are a Section World Composer.',
  'Infer which slice of the established world is active in the current scene.',
  'Do not invent new canon. Do not expand the setting beyond supplied context.',
  'Write a compact prompt the main response model can follow immediately.',
  'Focus on active local rules, scene pressure, current location/world state.',
  '',
  'Respond only as JSON:',
  '{ "sectionTitle": "", "prompt": "", "activeRules": [""], "scenePressures": [""] }',
].join('\n');

export const PROMPTS = Object.freeze({
  get: (key: string): string => _store[key] || '',
  build: (key: string, vars: Record<string, string> = {}): string => {
    let template = String(_store[key] || '');
    if (!template) return '';
    for (const [k, v] of Object.entries(vars)) {
      template = template.replace(new RegExp('\\{\\{' + k + '\\}\\}', 'g'), String(v ?? ''));
    }
    return template;
  },
  keys: (): string[] => Object.keys(_store),
});
