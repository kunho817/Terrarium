import { describe, it, expect } from 'vitest';
import { applyMutations } from '$lib/core/scripting/mutations';
import type { ScriptMutation } from '$lib/core/scripting/api';
import type { SceneState } from '$lib/types';

const baseScene: SceneState = {
  location: 'forest',
  time: 'day',
  mood: 'calm',
  participatingCharacters: [],
  variables: { 'player.hp': 100, 'player.gold': 50 },
  environmentalNotes: '',
  lastUpdated: 0,
};

describe('applyMutations', () => {
  it('applies setVar mutation', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setVar', key: 'player.hp', value: 85 },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene.variables['player.hp']).toBe(85);
    expect(result.sideEffects).toHaveLength(0);
  });

  it('applies deleteVar mutation', () => {
    const mutations: ScriptMutation[] = [
      { type: 'deleteVar', key: 'player.gold' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect('player.gold' in result.scene.variables).toBe(false);
    expect(result.scene.variables['player.hp']).toBe(100);
  });

  it('applies setLocation mutation', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setLocation', value: 'dark_cave' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene.location).toBe('dark_cave');
  });

  it('applies setTime mutation', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setTime', value: 'night' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene.time).toBe('night');
  });

  it('applies setMood mutation', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setMood', value: 'tense' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene.mood).toBe('tense');
  });

  it('does not mutate original scene', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setVar', key: 'player.hp', value: 0 },
    ];
    applyMutations(baseScene, mutations);
    expect(baseScene.variables['player.hp']).toBe(100);
  });

  it('collects sendMessage as side effect', () => {
    const mutations: ScriptMutation[] = [
      { type: 'sendMessage', text: 'HP dropped!', msgType: 'system' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene).toEqual(baseScene);
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toEqual({
      type: 'sendMessage',
      text: 'HP dropped!',
      msgType: 'system',
    });
  });

  it('collects injectLore as side effect', () => {
    const mutations: ScriptMutation[] = [
      { type: 'injectLore', name: 'injury_effects' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toEqual({ type: 'injectLore', name: 'injury_effects' });
  });

  it('collects showToast as side effect', () => {
    const mutations: ScriptMutation[] = [
      { type: 'showToast', message: 'Critical hit!' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.sideEffects).toHaveLength(1);
  });

  it('applies mixed state and side effect mutations', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setVar', key: 'player.hp', value: 30 },
      { type: 'sendMessage', text: 'Low HP!', msgType: 'system' },
      { type: 'setMood', value: 'danger' },
      { type: 'injectLore', name: 'danger_zone' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene.variables['player.hp']).toBe(30);
    expect(result.scene.mood).toBe('danger');
    expect(result.sideEffects).toHaveLength(2);
  });

  it('handles empty mutations', () => {
    const result = applyMutations(baseScene, []);
    expect(result.scene).toEqual(baseScene);
    expect(result.sideEffects).toHaveLength(0);
  });

  it('applies multiple setVar mutations in order', () => {
    const mutations: ScriptMutation[] = [
      { type: 'setVar', key: 'counter', value: 1 },
      { type: 'setVar', key: 'counter', value: 2 },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.scene.variables['counter']).toBe(2);
  });

  it('collects blockMessage as side effect', () => {
    const mutations: ScriptMutation[] = [
      { type: 'blockMessage' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toEqual({ type: 'blockMessage' });
  });

  it('collects appendText as side effect', () => {
    const mutations: ScriptMutation[] = [
      { type: 'appendText', text: '\n[Damage taken!]' },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toEqual({ type: 'appendText', text: '\n[Damage taken!]' });
  });

  it('collects playEffect as side effect', () => {
    const mutations: ScriptMutation[] = [
      { type: 'playEffect', effect: 'screen_shake', config: { duration: 500 } },
    ];
    const result = applyMutations(baseScene, mutations);
    expect(result.sideEffects).toHaveLength(1);
    expect(result.sideEffects[0]).toEqual({
      type: 'playEffect',
      effect: 'screen_shake',
      config: { duration: 500 },
    });
  });
});
