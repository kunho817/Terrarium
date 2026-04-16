import { describe, it, expect } from 'vitest';
import type { SceneState, CharacterState, DirectorGuidance, StateUpdate } from '$lib/types/agent-state';

describe('Agent State Types', () => {
	it('SceneState has all required fields', () => {
		const state: SceneState = {
			sessionId: 'test-session',
			location: 'The Rusty Tankard Inn',
			characters: ['Elara', 'Kai'],
			atmosphere: 'Tense',
			timeOfDay: 'Late evening',
			environmentalNotes: 'Fire crackling',
			lastUpdated: Date.now()
		};
		expect(state.location).toBe('The Rusty Tankard Inn');
	});

	it('CharacterState has all required fields', () => {
		const state: CharacterState = {
			id: 'char-1',
			sessionId: 'test-session',
			characterName: 'Elara',
			emotion: 'alert',
			location: 'at the bar',
			inventory: ['stolen amulet'],
			health: 'healthy',
			notes: 'Watching the door',
			lastUpdated: Date.now()
		};
		expect(state.characterName).toBe('Elara');
	});

	it('DirectorGuidance has all required fields', () => {
		const guidance: DirectorGuidance = {
			sceneMandate: 'Escalate tension',
			requiredOutcomes: ['Acquire information'],
			forbiddenMoves: ['Resolve subplot'],
			emphasis: ['Kai nervousness'],
			targetPacing: 'slow',
			pressureLevel: 'high'
		};
		expect(guidance.sceneMandate).toBe('Escalate tension');
	});

	it('StateUpdate can contain multiple state types', () => {
		const update: StateUpdate = {
			scene: { location: 'New location' },
			characters: [{ characterName: 'Elara', emotion: 'calm' }]
		};
		expect(update.scene?.location).toBe('New location');
	});
});
