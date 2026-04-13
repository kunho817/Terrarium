import type { LorebookEntry, LorebookSettings } from './lorebook';
import type { Trigger } from './trigger';
import type { RegexScript, VariableStore } from './script';
import type { DepthPrompt } from './character';

export interface WorldCharacter {
  id: string;
  name: string;
  description: string;
  personality?: string;
  exampleMessages?: string;
  avatar?: string;
  lorebookEntryIds?: string[];
}

export interface WorldCard {
  name: string;
  description: string;
  scenario: string;
  firstMessage: string;
  alternateGreetings: string[];

  systemPrompt: string;
  postHistoryInstructions: string;
  depthPrompt?: DepthPrompt;
  defaultPersonaId?: string;

  lorebook: LorebookEntry[];
  loreSettings: LorebookSettings;

  characters: WorldCharacter[];

  regexScripts: RegexScript[];
  triggers: Trigger[];
  virtualScript?: string;
  scriptState: VariableStore;

  backgroundHTML?: string;
  backgroundCSS?: string;
  customTheme?: string;

  creator: string;
  tags: string[];
  creatorNotes: string;
  license?: string;
  metadata: Record<string, unknown>;
}

export function createDefaultWorldCard(): WorldCard {
  return {
    name: '',
    description: '',
    scenario: '',
    firstMessage: '',
    alternateGreetings: [],
    systemPrompt: '',
    postHistoryInstructions: '',
    lorebook: [],
    loreSettings: { tokenBudget: 2048, scanDepth: 5, recursiveScanning: false, fullWordMatching: false },
    characters: [],
    regexScripts: [],
    triggers: [],
    scriptState: {},
    creator: '',
    tags: [],
    creatorNotes: '',
    metadata: {},
  };
}
