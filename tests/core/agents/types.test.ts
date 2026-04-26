import { describe, it, expect } from 'vitest';
import type {
  SessionAgentState,
  ExtractionSnapshot,
  CharacterSnapshot,
  NarrativeState,
  TurnMaintenanceOutput,
  EntityRecord,
  RelationRecord,
  WorldFactRecord,
  TurnSnapshot,
  AgentPipelineContext,
} from '$lib/core/agents/types';

describe('Agent pipeline types', () => {
  it('ExtractionSnapshot has required scene fields', () => {
    const snapshot: ExtractionSnapshot = {
      turnNumber: 1,
      timestamp: Date.now(),
      scene: {
        location: 'Tavern',
        characters: ['Alice'],
        atmosphere: 'tense',
        timeOfDay: 'evening',
        environmentalNotes: 'rain outside',
      },
      characters: {},
      events: ['Alice entered the tavern'],
      newFacts: ['Alice is looking for someone'],
      changed: [],
      memoryCandidates: {
        persistent: [{ content: 'Alice is looking for someone', type: 'trait' }],
        turningPoints: ['Alice entered the tavern'],
        worldLog: ['The tavern is crowded tonight'],
      },
    };
    expect(snapshot.scene.location).toBe('Tavern');
    expect(snapshot.scene.characters).toEqual(['Alice']);
    expect(snapshot.memoryCandidates?.persistent[0].type).toBe('trait');
  });

  it('CharacterSnapshot has required fields', () => {
    const cs: CharacterSnapshot = {
      name: 'Alice',
      emotion: 'nervous',
      location: 'at the bar',
      inventory: ['sword'],
      health: 'healthy',
      notes: 'scanning the room',
    };
    expect(cs.emotion).toBe('nervous');
    expect(cs.inventory).toEqual(['sword']);
  });

  it('NarrativeState tracks arc and tensions', () => {
    const ns: NarrativeState = {
      currentArc: "Alice's search",
      activeTensions: ['Who is Alice looking for?'],
      recentDecisions: ['Alice decided to enter the tavern'],
      nextBeats: ['Alice spots someone'],
      turnNumber: 1,
    };
    expect(ns.currentArc).toBe("Alice's search");
    expect(ns.activeTensions).toHaveLength(1);
  });

  it('TurnMaintenanceOutput has all sections', () => {
    const tmo: TurnMaintenanceOutput = {
      narrativeBrief: 'Alice arrived at the tavern looking for someone.',
      correction: {
        shouldCorrect: false,
        reasons: [],
      },
      storyAuthor: {
        currentArc: "Alice's search",
        narrativeGoal: 'Discover who Alice is looking for',
        activeTensions: ['Mystery of the search target'],
        nextBeats: ['Alice finds a clue'],
        guardrails: ['Do not reveal the target yet'],
        focusCharacters: ['Alice'],
        recentDecisions: ['Entered the tavern'],
      },
      director: {
        sceneMandate: 'Build tension as Alice searches',
        requiredOutcomes: ['Alice interacts with an NPC'],
        forbiddenMoves: ['Do not resolve the search this turn'],
        emphasis: ['Atmosphere', 'Suspicion'],
        targetPacing: 'slow',
        pressureLevel: 'medium',
        focusCharacters: ['Alice'],
      },
    };
    expect(tmo.narrativeBrief).toBeTruthy();
    expect(tmo.correction.shouldCorrect).toBe(false);
    expect(tmo.storyAuthor.currentArc).toBeTruthy();
    expect(tmo.director.sceneMandate).toBeTruthy();
  });

  it('SessionAgentState has all fields', () => {
    const state: SessionAgentState = {
      sessionId: 'sess-1',
      lastExtraction: null,
      lastTurnMaintenance: null,
      lastSectionWorld: null,
      entities: {},
      relations: [],
      worldFacts: [],
      turnHistory: [],
      narrativeState: {
        currentArc: '',
        activeTensions: [],
        recentDecisions: [],
        nextBeats: [],
        turnNumber: 0,
      },
    };
    expect(state.sessionId).toBe('sess-1');
    expect(state.lastExtraction).toBeNull();
    expect(state.narrativeState.turnNumber).toBe(0);
  });

  it('EntityRecord has required fields', () => {
    const er: EntityRecord = {
      id: 'ent-1',
      name: 'Rusty Tankard',
      type: 'location',
      description: 'A worn but cozy tavern',
      attributes: { reputation: 'neutral' },
      lastUpdated: Date.now(),
    };
    expect(er.type).toBe('location');
  });

  it('AgentPipelineContext has cardType', () => {
    const ctx: AgentPipelineContext = {
      sessionId: 'sess-1' as any,
      cardId: 'card-1' as any,
      cardType: 'character',
      messages: [],
      scene: {
        location: '',
        participatingCharacters: [],
        mood: '',
        time: '',
        environmentalNotes: '',
        lastUpdated: 0,
        variables: {},
      },
      turnNumber: 1,
      config: {
        providerId: 'openai',
        model: 'gpt-4',
        apiKey: 'test',
        temperature: 0.7,
        maxTokens: 4096,
      },
    };
    expect(ctx.cardType).toBe('character');
  });
});
