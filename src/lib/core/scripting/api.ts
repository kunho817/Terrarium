/**
 * Script API types — defines the interface between Lua scripts and TypeScript.
 * ScriptContext is passed TO the Lua runtime, ScriptResult is returned FROM it.
 */

import type { VariableValue, VariableStore } from '$lib/types';

export interface ScriptContext {
  variables: VariableStore;
  scene: {
    location: string;
    time: string;
    mood: string;
  };
  message?: string;
  isUserMessage?: boolean;
  pattern?: string;
}

// State mutations — applied directly to SceneState
export type StateMutation =
  | { type: 'setVar'; key: string; value: VariableValue }
  | { type: 'deleteVar'; key: string }
  | { type: 'setLocation'; value: string }
  | { type: 'setTime'; value: string }
  | { type: 'setMood'; value: string };

// Side effects — returned for caller to handle
export type SideEffect =
  | { type: 'sendMessage'; text: string; msgType: string }
  | { type: 'injectLore'; name: string }
  | { type: 'disableLore'; name: string }
  | { type: 'enableLore'; name: string }
  | { type: 'blockMessage' }
  | { type: 'appendText'; text: string }
  | { type: 'showToast'; message: string }
  | { type: 'playEffect'; effect: string; config?: Record<string, unknown> };

export type ScriptMutation = StateMutation | SideEffect;

export interface ScriptResult {
  success: boolean;
  error?: string;
  mutations: ScriptMutation[];
  logs: string[];
}

export interface MutationResult {
  scene: import('$lib/types').SceneState;
  sideEffects: SideEffect[];
}
