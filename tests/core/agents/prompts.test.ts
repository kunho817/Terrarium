import { describe, it, expect } from 'vitest';
import { PROMPTS } from '$lib/core/agents/prompts';

describe('Agent prompts registry', () => {
  it('has EXTRACTION_SYSTEM prompt', () => {
    const prompt = PROMPTS.get('EXTRACTION_SYSTEM');
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('Extraction stage');
    expect(prompt).toContain('JSON');
  });

  it('has EXTRACTION_FALLBACK_SYSTEM prompt', () => {
    const prompt = PROMPTS.get('EXTRACTION_FALLBACK_SYSTEM');
    expect(prompt).toBeTruthy();
    expect(prompt!.length).toBeLessThan(PROMPTS.get('EXTRACTION_SYSTEM')!.length);
  });

  it('has EXTRACTION_REPAIR_SYSTEM prompt', () => {
    const prompt = PROMPTS.get('EXTRACTION_REPAIR_SYSTEM');
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('JSON');
  });

  it('has TURN_MAINTENANCE_SYSTEM prompt', () => {
    const prompt = PROMPTS.get('TURN_MAINTENANCE_SYSTEM');
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('narrative');
    expect(prompt).toContain('director');
  });

  it('has RELIABILITY_GUARD prompt', () => {
    const prompt = PROMPTS.get('RELIABILITY_GUARD');
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('conservatively');
  });

  it('has DIRECTOR_MODE_LIGHT, STRONG, ABSOLUTE', () => {
    expect(PROMPTS.get('DIRECTOR_MODE_LIGHT')).toBeTruthy();
    expect(PROMPTS.get('DIRECTOR_MODE_STRONG')).toBeTruthy();
    expect(PROMPTS.get('DIRECTOR_MODE_ABSOLUTE')).toBeTruthy();
  });

  it('build substitutes variables', () => {
    const result = PROMPTS.build('DIRECTOR_MODE_LIGHT', {});
    expect(result).toBeTruthy();
  });

  it('returns empty string for unknown key', () => {
    expect(PROMPTS.get('NONEXISTENT')).toBe('');
  });

  it('keys() returns all registered prompt keys', () => {
    const keys = PROMPTS.keys();
    expect(keys).toContain('EXTRACTION_SYSTEM');
    expect(keys).toContain('TURN_MAINTENANCE_SYSTEM');
    expect(keys).toContain('RELIABILITY_GUARD');
  });
});
