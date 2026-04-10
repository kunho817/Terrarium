/**
 * Variable store — pure functions for CRUD operations on VariableStore.
 * Foundation for the scripting engine API (Plan 7) and template substitution.
 */

import type { VariableStore, VariableValue } from '$lib/types';

export function getVar(store: VariableStore, key: string): VariableValue | undefined {
  return store[key];
}

export function setVar(store: VariableStore, key: string, value: VariableValue): VariableStore {
  return { ...store, [key]: value };
}

export function deleteVar(store: VariableStore, key: string): VariableStore {
  const { [key]: _, ...rest } = store;
  return rest;
}

export function hasVar(store: VariableStore, key: string): boolean {
  return key in store;
}

export function listVars(store: VariableStore): [string, VariableValue][] {
  return Object.entries(store);
}

export function formatVarValue(value: VariableValue): string {
  return String(value);
}
