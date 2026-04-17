import { describe, it, expect } from 'vitest';
import type { PromptItem } from '$lib/types/prompt-preset';

describe('Agent PromptItem types', () => {
  it('accepts memory type', () => {
    const item: PromptItem = {
      id: 'test',
      type: 'memory',
      name: 'Memory',
      enabled: true,
      role: 'system',
      content: '',
    };
    expect(item.type).toBe('memory');
  });

  it('accepts director type', () => {
    const item: PromptItem = {
      id: 'test',
      type: 'director',
      name: 'Director',
      enabled: true,
      role: 'system',
      content: '',
    };
    expect(item.type).toBe('director');
  });

  it('accepts sceneState type', () => {
    const item: PromptItem = {
      id: 'test',
      type: 'sceneState',
      name: 'Scene State',
      enabled: true,
      role: 'system',
      content: '',
    };
    expect(item.type).toBe('sceneState');
  });

  it('accepts characterState type', () => {
    const item: PromptItem = {
      id: 'test',
      type: 'characterState',
      name: 'Character State',
      enabled: true,
      role: 'system',
      content: '',
    };
    expect(item.type).toBe('characterState');
  });
});
