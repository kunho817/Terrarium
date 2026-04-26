import { describe, it, expect } from 'vitest';
import {
  formatTurnMaintenanceInjection,
  formatExtractionInjection,
  formatReliabilityGuard,
  formatMemoryInjection,
  formatArcMemoryInjection,
  formatPersistentMemoryInjection,
  formatTurningPointInjection,
  formatWorldMemoryInjection,
  formatSectionWorldInjection,
  buildAgentImageContext,
} from '$lib/core/agents/injection';
import type { TurnMaintenanceOutput, ExtractionSnapshot, SessionAgentState } from '$lib/core/agents/types';

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

describe('layered memory injections', () => {
  it('formats persistent memory section', () => {
    const result = formatPersistentMemoryInjection([
      { content: 'Alice distrusts the captain.', type: 'relationship' },
      { content: 'The chapel hides a safehouse.', type: 'location' },
    ]);
    expect(result).toContain('[Persistent Memory]');
    expect(result).toContain('Alice distrusts the captain.');
    expect(result).toContain('The chapel hides a safehouse.');
  });

  it('formats arc memory from narrative state and summary', () => {
    const result = formatArcMemoryInjection(
      {
        currentArc: 'Gate standoff',
        activeTensions: ['Guard vs Alice'],
        recentDecisions: ['Alice drew her sword'],
        nextBeats: ['Guard must answer'],
        turnNumber: 3,
      },
      'The confrontation at the gate has escalated.',
    );
    expect(result).toContain('[Arc Memory]');
    expect(result).toContain('Gate standoff');
    expect(result).toContain('Guard vs Alice');
    expect(result).toContain('The confrontation at the gate has escalated.');
  });

  it('formats turning points list', () => {
    const result = formatTurningPointInjection([
      'Alice challenged the guard.',
      'The captain arrived with reinforcements.',
    ]);
    expect(result).toContain('[Turning Points]');
    expect(result).toContain('Alice challenged the guard.');
    expect(result).toContain('The captain arrived with reinforcements.');
  });

  it('formats world encyclopedia section', () => {
    const result = formatWorldMemoryInjection([
      { content: 'Magic fails inside the iron ward.', type: 'world_fact' },
    ]);
    expect(result).toContain('[World Encyclopedia]');
    expect(result).toContain('Magic fails inside the iron ward.');
  });
});

describe('formatSectionWorldInjection', () => {
  it('formats complete section world output', () => {
    const sw = {
      sectionTitle: 'Enchanted Glade',
      prompt: 'Moonlight filters through ancient branches, illuminating fairy rings.',
      activeRules: ['Magic amplified at night', 'Fey creatures visible'],
      scenePressures: ['Time running out', 'Something stirs in the shadows'],
    };
    const result = formatSectionWorldInjection(sw);
    expect(result).toContain('[Section World: Enchanted Glade]');
    expect(result).toContain('Moonlight filters');
    expect(result).toContain('Active Rules: Magic amplified at night, Fey creatures visible');
    expect(result).toContain('Scene Pressures: Time running out, Something stirs in the shadows');
  });

  it('omits rules and pressures when empty', () => {
    const sw = {
      sectionTitle: 'Quiet Path',
      prompt: 'A winding trail through peaceful meadows.',
      activeRules: [],
      scenePressures: [],
    };
    const result = formatSectionWorldInjection(sw);
    expect(result).not.toContain('Active Rules');
    expect(result).not.toContain('Scene Pressures');
    expect(result).toContain('Quiet Path');
  });

  it('includes rules but omits pressures when only pressures is empty', () => {
    const sw = {
      sectionTitle: 'Market Square',
      prompt: 'Bustling trade in the afternoon sun.',
      activeRules: ['No weapons allowed'],
      scenePressures: [],
    };
    const result = formatSectionWorldInjection(sw);
    expect(result).toContain('Active Rules: No weapons allowed');
    expect(result).not.toContain('Scene Pressures');
  });
});

describe('buildAgentImageContext', () => {
  function makeState(overrides?: Partial<SessionAgentState>): SessionAgentState {
    return {
      sessionId: 'test',
      lastExtraction: {
        turnNumber: 1,
        timestamp: Date.now(),
        scene: { location: 'Castle', characters: ['Alice'], atmosphere: 'tense', timeOfDay: 'dusk', environmentalNotes: '' },
        characters: {
          Alice: { name: 'Alice', emotion: 'nervous', location: 'Castle', inventory: [], health: 'healthy', notes: '' },
          Bob: { name: 'Bob', emotion: '', location: 'Castle', inventory: [], health: 'healthy', notes: '' },
        },
        events: [],
        newFacts: [],
        changed: [],
      },
      lastTurnMaintenance: {
        narrativeBrief: 'Alice arrives at the castle.',
        correction: { shouldCorrect: false, reasons: [] },
        storyAuthor: {
          currentArc: '', narrativeGoal: '', activeTensions: [], nextBeats: [],
          guardrails: [], focusCharacters: [], recentDecisions: [],
        },
        director: {
          sceneMandate: 'Build tension',
          requiredOutcomes: [], forbiddenMoves: [], emphasis: ['Shadows', 'Silence'],
          targetPacing: 'slow', pressureLevel: 'medium', focusCharacters: [],
        },
      },
      lastSectionWorld: null,
      entities: {},
      relations: [],
      worldFacts: [],
      turnHistory: [],
      narrativeState: { currentArc: '', activeTensions: [], recentDecisions: [], nextBeats: [], turnNumber: 1 },
      ...overrides,
    };
  }

  it('extracts scene location, time, and mood from extraction', () => {
    const ctx = buildAgentImageContext(makeState());
    expect(ctx.sceneLocation).toBe('Castle');
    expect(ctx.sceneTime).toBe('dusk');
    expect(ctx.sceneMood).toBe('tense');
  });

  it('extracts character emotions, skipping empty ones', () => {
    const ctx = buildAgentImageContext(makeState());
    expect(ctx.characterEmotions).toEqual({ Alice: 'nervous' });
  });

  it('extracts director mandate and emphasis', () => {
    const ctx = buildAgentImageContext(makeState());
    expect(ctx.directorMandate).toBe('Build tension');
    expect(ctx.directorEmphasis).toEqual(['Shadows', 'Silence']);
  });

  it('returns empty context when no extraction or turn maintenance', () => {
    const ctx = buildAgentImageContext(makeState({ lastExtraction: null, lastTurnMaintenance: null }));
    expect(ctx).toEqual({});
  });

  it('handles extraction with no scene data gracefully', () => {
    const state = makeState({
      lastExtraction: {
        turnNumber: 1,
        timestamp: Date.now(),
        scene: { location: '', characters: [], atmosphere: '', timeOfDay: '', environmentalNotes: '' },
        characters: {},
        events: [],
        newFacts: [],
        changed: [],
      },
    });
    const ctx = buildAgentImageContext(state);
    expect(ctx.sceneLocation).toBeUndefined();
    expect(ctx.sceneTime).toBeUndefined();
    expect(ctx.sceneMood).toBeUndefined();
    expect(ctx.characterEmotions).toBeUndefined();
  });

  it('handles turn maintenance with empty director gracefully', () => {
    const state = makeState({
      lastTurnMaintenance: {
        narrativeBrief: 'test',
        correction: { shouldCorrect: false, reasons: [] },
        storyAuthor: {
          currentArc: '', narrativeGoal: '', activeTensions: [], nextBeats: [],
          guardrails: [], focusCharacters: [], recentDecisions: [],
        },
        director: {
          sceneMandate: '', requiredOutcomes: [], forbiddenMoves: [], emphasis: [],
          targetPacing: 'normal', pressureLevel: 'medium', focusCharacters: [],
        },
      },
    });
    const ctx = buildAgentImageContext(state);
    expect(ctx.directorMandate).toBeUndefined();
    expect(ctx.directorEmphasis).toBeUndefined();
  });
});
