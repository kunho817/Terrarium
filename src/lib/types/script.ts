/**
 * Regex script and variable store types.
 * Spec reference: Section 7.3 — Variable Store, Section 7.4 — Regex Script System
 */

export type RegexStage = 'modify_input' | 'modify_output' | 'modify_request' | 'modify_display';

export interface RegexScript {
  id: string;
  name: string;
  pattern: string;
  replacement: string;
  stage: RegexStage;
  enabled: boolean;
  flag?: string;
}

export type VariableValue = string | number | boolean;

export type VariableStore = Record<string, VariableValue>;
