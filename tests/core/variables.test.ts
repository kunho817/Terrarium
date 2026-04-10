import { describe, it, expect } from 'vitest';
import {
  getVar,
  setVar,
  deleteVar,
  hasVar,
  listVars,
  formatVarValue,
} from '$lib/core/variables';
import type { VariableStore } from '$lib/types';

describe('getVar', () => {
  it('returns value for existing key', () => {
    const store: VariableStore = { 'player.hp': 100, name: 'Alice' };
    expect(getVar(store, 'player.hp')).toBe(100);
    expect(getVar(store, 'name')).toBe('Alice');
  });

  it('returns undefined for missing key', () => {
    const store: VariableStore = { name: 'Alice' };
    expect(getVar(store, 'missing')).toBeUndefined();
  });

  it('returns undefined for empty store', () => {
    expect(getVar({}, 'any')).toBeUndefined();
  });
});

describe('setVar', () => {
  it('sets a new key-value pair', () => {
    const store: VariableStore = {};
    const result = setVar(store, 'player.hp', 100);
    expect(result['player.hp']).toBe(100);
  });

  it('overwrites existing value', () => {
    const store: VariableStore = { count: 5 };
    const result = setVar(store, 'count', 10);
    expect(result.count).toBe(10);
  });

  it('does not mutate original store', () => {
    const store: VariableStore = { a: 1 };
    const result = setVar(store, 'b', 2);
    expect(store).toEqual({ a: 1 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('handles string values', () => {
    const store: VariableStore = {};
    const result = setVar(store, 'location', 'dark_forest');
    expect(result.location).toBe('dark_forest');
  });

  it('handles boolean values', () => {
    const store: VariableStore = {};
    const result = setVar(store, 'flags.met_king', true);
    expect(result['flags.met_king']).toBe(true);
  });
});

describe('deleteVar', () => {
  it('removes a key from the store', () => {
    const store: VariableStore = { a: 1, b: 2 };
    const result = deleteVar(store, 'a');
    expect(result).toEqual({ b: 2 });
  });

  it('returns unchanged store when key does not exist', () => {
    const store: VariableStore = { a: 1 };
    const result = deleteVar(store, 'missing');
    expect(result).toEqual({ a: 1 });
  });

  it('does not mutate original store', () => {
    const store: VariableStore = { a: 1, b: 2 };
    deleteVar(store, 'a');
    expect(store).toEqual({ a: 1, b: 2 });
  });
});

describe('hasVar', () => {
  it('returns true for existing key', () => {
    const store: VariableStore = { hp: 100 };
    expect(hasVar(store, 'hp')).toBe(true);
  });

  it('returns false for missing key', () => {
    const store: VariableStore = { hp: 100 };
    expect(hasVar(store, 'mp')).toBe(false);
  });

  it('returns true for falsy values', () => {
    const store: VariableStore = { count: 0, flag: false, name: '' };
    expect(hasVar(store, 'count')).toBe(true);
    expect(hasVar(store, 'flag')).toBe(true);
    expect(hasVar(store, 'name')).toBe(true);
  });
});

describe('listVars', () => {
  it('returns all keys and values', () => {
    const store: VariableStore = { hp: 100, name: 'Alice', active: true };
    const list = listVars(store);
    expect(list).toEqual([
      ['hp', 100],
      ['name', 'Alice'],
      ['active', true],
    ]);
  });

  it('returns empty array for empty store', () => {
    expect(listVars({})).toEqual([]);
  });
});

describe('formatVarValue', () => {
  it('formats string value', () => {
    expect(formatVarValue('hello')).toBe('hello');
  });

  it('formats number value', () => {
    expect(formatVarValue(42)).toBe('42');
  });

  it('formats boolean value', () => {
    expect(formatVarValue(true)).toBe('true');
    expect(formatVarValue(false)).toBe('false');
  });
});
