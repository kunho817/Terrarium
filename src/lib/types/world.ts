import type { LorebookEntry, LorebookSettings } from './lorebook';
import type { Trigger } from './trigger';
import type { RegexScript, VariableStore } from './script';
import type { DepthPrompt } from './character';

export interface WorldCharacter {
	id: string;
	name: string;
	description: string;
	personality: string;
	exampleMessages: string;
	avatar: string | null;
	lorebookEntryIds: string[];
	trackState: boolean;
	tags: string[];
}

export interface AlternateGreeting {
	id: string;
	name: string;
	content: string;
}

export interface WorldScenario {
	id: string;
	name: string;
	description: string;
	condition: string;
	actions: string;
	enabled: boolean;
}

export interface WorldSettings {
	providerId?: string;
	model?: string;
	temperature?: number;
	topP?: number;
	maxTokens?: number;
	agents?: {
		memory?: { enabled?: boolean; tokenBudget?: number };
		director?: { enabled?: boolean; tokenBudget?: number };
		sceneState?: { enabled?: boolean; tokenBudget?: number };
		characterState?: { enabled?: boolean; tokenBudget?: number };
		narrativeConsistency?: { enabled?: boolean; tokenBudget?: number };
	};
	loreSettings?: Partial<LorebookSettings>;
}

export interface WorldCard {
	name: string;
	description: string;
	scenario: string;
	firstMessage: string;
	alternateGreetings: AlternateGreeting[];

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

	scenarios: WorldScenario[];

	worldSettings?: WorldSettings;

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
		scenarios: [],
		creator: '',
		tags: [],
		creatorNotes: '',
		metadata: {},
	};
}
