export type { SceneState } from './scene';

export interface CharacterState {
	id: string;
	sessionId: string;
	characterName: string;
	emotion: string;
	location: string;
	inventory: string[];
	health: string;
	notes: string;
	lastUpdated: number;
}

export interface DirectorGuidance {
	sceneMandate: string;
	requiredOutcomes: string[];
	forbiddenMoves: string[];
	emphasis: string[];
	targetPacing: 'slow' | 'normal' | 'fast';
	pressureLevel: 'low' | 'medium' | 'high';
}

export interface StateUpdate {
	scene?: Partial<SceneState>;
	characters?: Partial<CharacterState>[];
	directorGuidance?: DirectorGuidance;
}

export type DirectorMode = 'light' | 'strong' | 'absolute';

export interface AgentTokenBudget {
	maxTokens: number;
	userBudget: number;
	warningThreshold: number;
}

export interface AgentBudgetConfig {
	memory: number;
	director: number;
	scene: number;
	character: number;
}
