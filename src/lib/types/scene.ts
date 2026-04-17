/**
 * Scene state types for simulation mode.
 * Spec reference: Section 8 — Shared Types > SceneState
 */

import type { VariableStore } from './script';

export interface SceneState {
  location: string;
  time: string;
  mood: string;
  participatingCharacters: string[];
  variables: VariableStore;
  environmentalNotes: string;
  lastUpdated: number;
}
