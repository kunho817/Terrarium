import { describe, it, expect } from 'vitest';
import {
  formatTurnMaintenanceInjection,
  formatExtractionInjection,
  formatReliabilityGuard,
  formatMemoryInjection,
} from '$lib/core/agents/injection';
import type { TurnMaintenanceOutput, ExtractionSnapshot } from '$lib/core/agents/types';

describe('formatTurnMaintenanceInjection', () => {
  it('formats complete turn maintenance output', () => {
    const tmo: TurnMaintenanceOutput = {
      narrativeBrief: 'Alice confronts the guard.',
      correction: { shouldCorrect: false, reasons: [] },
      storyAuthor: {
        currentArc: 'Gate standoff',
        narrativeGoal: 'Resolve confrontation',
        activeTensions: ['Will violence erupt?'],
        nextBeats: ['Guard makes a choice'],
        guardrails: ['No deus ex machina'],
        focusCharacters: ['Alice'],
        recentDecisions: ['Drew sword'],
      },
      director: {
        sceneMandate: 'Escalate',
        requiredOutcomes: ['Physical confrontation'],
        forbiddenMoves: ['Peaceful resolution'],
        emphasis: ['Danger'],
        targetPacing: 'fast',
        pressureLevel: 'high',
        focusCharacters: ['Alice'],
      },
    };

    const result = formatTurnMaintenanceInjection(tmo);
    expect(result).toContain('[Narrative Brief]');
    expect(result).toContain('Alice confronts the guard');
    expect(result).toContain('[Story Author Guidance]');
    expect(result).toContain('Gate standoff');
    expect(result).toContain('[Director Supervision]');
    expect(result).toContain('Escalate');
    expect(result).toContain('fast');
    expect(result).toContain('high');
  });

  it('omits empty sections', () => {
    const tmo: TurnMaintenanceOutput = {
      narrativeBrief: '',
      correction: { shouldCorrect: false, reasons: [] },
      storyAuthor: {
        currentArc: '', narrativeGoal: '', activeTensions: [], nextBeats: [],
        guardrails: [], focusCharacters: [], recentDecisions: [],
      },
      director: {
        sceneMandate: 'Just keep going',
        requiredOutcomes: [], forbiddenMoves: [], emphasis: [],
        targetPacing: 'normal', pressureLevel: 'low', focusCharacters: [],
      },
    };

    const result = formatTurnMaintenanceInjection(tmo);
    expect(result).not.toContain('[Narrative Brief]');
    expect(result).not.toContain('[Story Author Guidance]');
    expect(result).toContain('[Director Supervision]');
  });
});

describe('formatExtractionInjection', () => {
  it('formats extraction snapshot for injection', () => {
    const snap: ExtractionSnapshot = {
      turnNumber: 1,
      timestamp: Date.now(),
      scene: { location: 'Tavern', characters: ['Alice'], atmosphere: 'tense', timeOfDay: 'evening', environmentalNotes: 'rain' },
      characters: {
        Alice: { name: 'Alice', emotion: 'nervous', location: 'bar', inventory: [], health: 'healthy', notes: '' },
      },
      events: ['Alice entered'],
      newFacts: [],
      changed: [],
    };

    const result = formatExtractionInjection(snap);
    expect(result).toContain('[Scene State]');
    expect(result).toContain('Tavern');
    expect(result).toContain('[Character States]');
    expect(result).toContain('Alice');
  });

  it('returns undefined for empty snapshot', () => {
    const snap: ExtractionSnapshot = {
      turnNumber: 1,
      timestamp: Date.now(),
      scene: { location: '', characters: [], atmosphere: '', timeOfDay: '', environmentalNotes: '' },
      characters: {},
      events: [],
      newFacts: [],
      changed: [],
    };
    expect(formatExtractionInjection(snap)).toBeUndefined();
  });
});

describe('formatReliabilityGuard', () => {
  it('returns the guard text', () => {
    const result = formatReliabilityGuard();
    expect(result).toContain('Reliability Guard');
    expect(result).toContain('conservatively');
  });
});

describe('formatMemoryInjection', () => {
  it('formats memory records', () => {
    const memories = [
      { content: 'Alice owns a sword', type: 'trait' as const },
      { content: 'The tavern is called Rusty Tankard', type: 'location' as const },
    ];
    const result = formatMemoryInjection(memories);
    expect(result).toContain('[Memory]');
    expect(result).toContain('Alice owns a sword');
    expect(result).toContain('Rusty Tankard');
  });

  it('returns undefined for empty memories', () => {
    expect(formatMemoryInjection([])).toBeUndefined();
  });
});
