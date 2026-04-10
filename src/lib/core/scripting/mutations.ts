/**
 * Mutation applier — pure function that applies ScriptMutations to SceneState.
 * State mutations (setVar, deleteVar, setLocation, etc.) update the scene.
 * Side effects (sendMessage, injectLore, etc.) are collected for the caller.
 */

import type { SceneState } from '$lib/types';
import type { ScriptMutation, StateMutation, SideEffect, MutationResult } from './api';

const STATE_MUTATION_TYPES: ReadonlySet<string> = new Set([
  'setVar',
  'deleteVar',
  'setLocation',
  'setTime',
  'setMood',
]);

function isStateMutation(mutation: ScriptMutation): mutation is StateMutation {
  return STATE_MUTATION_TYPES.has(mutation.type);
}

function applyStateMutation(scene: SceneState, mutation: StateMutation): SceneState {
  switch (mutation.type) {
    case 'setVar':
      return { ...scene, variables: { ...scene.variables, [mutation.key]: mutation.value } };
    case 'deleteVar': {
      const { [mutation.key]: _, ...rest } = scene.variables;
      return { ...scene, variables: rest };
    }
    case 'setLocation':
      return { ...scene, location: mutation.value };
    case 'setTime':
      return { ...scene, time: mutation.value };
    case 'setMood':
      return { ...scene, mood: mutation.value };
  }
}

export function applyMutations(scene: SceneState, mutations: ScriptMutation[]): MutationResult {
  let currentScene = scene;
  const sideEffects: SideEffect[] = [];

  for (const mutation of mutations) {
    if (isStateMutation(mutation)) {
      currentScene = applyStateMutation(currentScene, mutation);
    } else {
      sideEffects.push(mutation as SideEffect);
    }
  }

  return { scene: currentScene, sideEffects };
}
