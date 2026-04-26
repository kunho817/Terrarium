import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AGENT_PROMPTS,
  createDefaultAgentPromptOverrides,
  migrateAgentPromptOverrides,
} from '$lib/core/agents/prompt-defaults';

const LEGACY_STORY_AUTHOR_SYSTEM = [
  'You are a Story Author agent operating inside the planning pipeline.',
  'Focus on narrative momentum, continuity, unresolved tensions, and the next meaningful beat.',
  'Do not write final prose. Do not summarize vaguely. Produce compact, actionable planning guidance only.',
  'The current user turn is the highest-priority axis. Your guidance must support it rather than replace it.',
  '',
  'Respond only as JSON:',
  '{"currentArc":"","narrativeGoal":"","activeTensions":[],"nextBeats":[],"guardrails":[],"focusCharacters":[],"recentDecisions":[]}',
].join('\n');

const LEGACY_SUMMARY_PROMPT = `You are a narrative summarizer. Summarize the following conversation segment, preserving key events, character developments, relationship changes, and important plot details. Write in a concise narrative style that captures the essence of what happened. Focus on information that would be needed for story continuity.`;

describe('prompt-defaults', () => {
  it('creates stage-aware agent defaults', () => {
    const overrides = createDefaultAgentPromptOverrides();
    expect(overrides.storyAuthorSystem).toContain('Planning stage');
    expect(overrides.extractionSystem).toContain('Extraction stage');
    expect(overrides.summarySystem).toContain('Summary stage');
  });

  it('migrates legacy agent prompt defaults in place', () => {
    const overrides = createDefaultAgentPromptOverrides();
    overrides.storyAuthorSystem = LEGACY_STORY_AUTHOR_SYSTEM;
    overrides.summarySystem = LEGACY_SUMMARY_PROMPT;

    const changed = migrateAgentPromptOverrides(overrides);

    expect(changed).toBe(true);
    expect(overrides.storyAuthorSystem).toBe(DEFAULT_AGENT_PROMPTS.STORY_AUTHOR_SYSTEM);
    expect(overrides.summarySystem).toBe(createDefaultAgentPromptOverrides().summarySystem);
  });
});
