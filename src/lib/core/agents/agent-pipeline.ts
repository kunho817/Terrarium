import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { runExtraction } from './extraction';
import { runTurnMaintenance } from './turn-maintenance';
import { runSectionWorld } from './section-world';
import {
  formatTurnMaintenanceInjection,
  formatExtractionInjection,
  formatReliabilityGuard,
  formatMemoryInjection,
  formatSectionWorldInjection,
  formatSummaryInjection,
  formatArcMemoryInjection,
  formatPersistentMemoryInjection,
  formatTurningPointInjection,
  formatWorldMemoryInjection,
  formatNarrativeGuidanceInjection,
  formatDirectorInjection,
  formatSceneStateInjection,
  formatCharacterStateInjection,
  formatWorldRelationsInjection,
} from './injection';
import { loadSessionState, saveSessionState } from '$lib/storage/session-agent-state';
import {
  deleteMemoriesForSession,
  deleteMemoriesForTurn,
  deleteSummariesFromTurn,
  findSimilarMemories,
  getMemoriesForSession,
  getLatestSummaryTurn,
  getSummariesForSession,
  getTopKMemories,
  insertSummary,
} from '$lib/storage/memories';
import { getEmbedding } from '$lib/core/embedding';
import { updateStepDiagnostic } from '$lib/stores/agent-progress';
import { memorySyncStore } from '$lib/stores/memory-sync';
import { callAgentLLM } from './agent-llm';
import { DEFAULT_SUMMARY_PROMPT } from '$lib/types/memory';
import { resolveSlotConfig } from '$lib/core/models/slot-resolver';
import { getAgentPrefill } from './prompts';
import { getActiveAgentPromptOverrides } from '$lib/core/presets/active-preset';
import type { MemoryRecord, MemoryType } from '$lib/types/memory';
import type {
  AgentPipelineContext,
  SessionAgentState,
  ExtractionSnapshot,
  PipelineProgressCallback,
  PipelineStepStatus,
  AgentPromptSections,
} from './types';

function resolveSummaryConfig(chatConfig?: import('$lib/types/config').UserConfig) {
  const settings = get(settingsStore);
  const slot = resolveSlotConfig(settings, ['summary', 'memory', 'chat'], chatConfig);
  const provider = slot.provider;
  const apiKey = slot.apiKey;
  const model = slot.model;
  const baseUrl = slot.baseUrl;
  const temperature = slot.temperature ?? 0.2;
  const maxTokens = slot.maxTokens ?? chatConfig?.maxTokens ?? 4096;
  const customPrompt =
    slot.slot?.customSummaryPrompt?.trim()
    || getActiveAgentPromptOverrides(settings).summarySystem?.trim()
    || DEFAULT_SUMMARY_PROMPT;

  return { provider, apiKey, model, baseUrl, temperature, maxTokens, customPrompt };
}

type StoredMemory = Omit<MemoryRecord, 'embedding'>;

function normalizeMemoryKey(content: string): string {
  return content.replace(/\s+/g, ' ').trim().toLowerCase();
}

function dedupeMemories(memories: StoredMemory[]): StoredMemory[] {
  const seen = new Set<string>();
  return memories.filter((memory) => {
    const key = `${memory.type}:${normalizeMemoryKey(memory.content)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickLayeredMemories(
  memories: StoredMemory[],
  allowedTypes: MemoryType[],
  limit: number,
  sortMode: 'importance' | 'recent',
): StoredMemory[] {
  const filtered = dedupeMemories(
    memories.filter((memory) => allowedTypes.includes(memory.type)),
  );

  filtered.sort((left, right) => {
    if (sortMode === 'recent') {
      if (right.turnNumber !== left.turnNumber) {
        return right.turnNumber - left.turnNumber;
      }
      if (right.createdAt !== left.createdAt) {
        return right.createdAt - left.createdAt;
      }
      return right.importance - left.importance;
    }

    if (right.importance !== left.importance) {
      return right.importance - left.importance;
    }
    if (right.turnNumber !== left.turnNumber) {
      return right.turnNumber - left.turnNumber;
    }
    return right.createdAt - left.createdAt;
  });

  return filtered.slice(0, Math.max(0, limit));
}

export interface PipelineBeforeResult {
  injection: string;
  reliabilityGuard: boolean;
  promptSections: AgentPromptSections;
}

export interface PipelineAfterResult {
  extraction: ExtractionSnapshot | null;
}

export class AgentPipeline {
  private state: SessionAgentState | null = null;
  private lastSessionId: string | null = null;

  getSteps(): Array<{ id: string; label: string }> {
    return [
      { id: 'memory-retrieval', label: 'Memory' },
      { id: 'turn-maintenance', label: 'Planning' },
      { id: 'section-world', label: 'World' },
      { id: 'generation', label: 'Generating' },
      { id: 'extraction', label: 'Extracting' },
    ];
  }

  reset(): void {
    this.state = null;
    this.lastSessionId = null;
  }

  async clearTurnState(fromTurn?: number, sessionId?: string): Promise<void> {
    const state =
      this.state && (!sessionId || this.state.sessionId === sessionId)
        ? this.state
        : sessionId
          ? await loadSessionState(sessionId)
          : this.state;

    const resolvedSessionId = (sessionId ?? state?.sessionId ?? this.lastSessionId) as string | null;
    const turn = fromTurn ?? state?.narrativeState.turnNumber ?? 0;

    if (resolvedSessionId && turn > 0) {
      await deleteMemoriesForTurn(resolvedSessionId, turn);
      await deleteSummariesFromTurn(resolvedSessionId, turn);
      memorySyncStore.bump();
    }

    if (!state) {
      return;
    }

    state.turnHistory = state.turnHistory.filter((entry) => entry.turnNumber < turn);
    state.lastTurnMaintenance = null;
    state.lastExtraction = null;
    state.lastSectionWorld = null;
    state.entities = {};
    state.relations = [];
    state.worldFacts = [];
    const previousTurn = state.turnHistory.length > 0
      ? state.turnHistory[state.turnHistory.length - 1].turnNumber
      : Math.max(0, turn - 1);
    state.narrativeState = {
      currentArc: '',
      activeTensions: [],
      recentDecisions: [],
      nextBeats: [],
      turnNumber: previousTurn,
    };

    await saveSessionState(state);
    this.state = state;
  }

  reportGenerationStatus(status: PipelineStepStatus, onProgress?: PipelineProgressCallback): void {
    onProgress?.('generation', status);
  }

  private createEmptyState(ctx: AgentPipelineContext): SessionAgentState {
    return {
      sessionId: ctx.sessionId,
      cardId: ctx.cardId,
      cardType: ctx.cardType,
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
  }

  private async ensureState(ctx: AgentPipelineContext): Promise<SessionAgentState> {
    if (this.state && this.state.sessionId === ctx.sessionId && this.lastSessionId === ctx.sessionId) {
      return this.state;
    }
    this.lastSessionId = ctx.sessionId;
    const loaded = await loadSessionState(ctx.sessionId);
    if (loaded) {
      if (
        (loaded.cardId && loaded.cardId !== ctx.cardId) ||
        (loaded.cardType && loaded.cardType !== ctx.cardType)
      ) {
        console.warn(
          '[AgentPipeline] Session state owner mismatch, resetting cached agent state',
          {
            sessionId: ctx.sessionId,
            expectedCardId: ctx.cardId,
            actualCardId: loaded.cardId,
            expectedCardType: ctx.cardType,
            actualCardType: loaded.cardType,
          },
        );
        await deleteMemoriesForSession(ctx.sessionId as string);
        this.state = this.createEmptyState(ctx);
      } else {
        this.state = {
          ...loaded,
          cardId: loaded.cardId ?? ctx.cardId,
          cardType: loaded.cardType ?? ctx.cardType,
        };
      }
    } else {
      this.state = this.createEmptyState(ctx);
    }
    return this.state;
  }

  async runBeforeGeneration(
    ctx: AgentPipelineContext,
    onProgress?: PipelineProgressCallback,
  ): Promise<PipelineBeforeResult> {
    const state = await this.ensureState(ctx);
    const settings = get(settingsStore);
    const agentSettings = settings.agentSettings as any;
    const parts: string[] = [];
    const promptSections: AgentPromptSections = {};
    let reliabilityGuard = false;

    if (agentSettings?.enabled === false) {
      onProgress?.('memory-retrieval', 'skipped');
      onProgress?.('turn-maintenance', 'skipped');
      onProgress?.('section-world', 'skipped');
      updateStepDiagnostic('generation', {
        inputChars: 0,
        outputChars: 0,
        resultPreview: 'Agent pipeline disabled in settings.',
        error: null,
      });
      return { injection: '', reliabilityGuard: false, promptSections };
    }

    if (state.lastExtraction) {
      promptSections.sceneState = formatSceneStateInjection(state.lastExtraction);
      promptSections.characterState = formatCharacterStateInjection(state.lastExtraction);
      const sceneInjection = formatExtractionInjection(state.lastExtraction);
      if (sceneInjection) parts.push(sceneInjection);
    }

    onProgress?.('memory-retrieval', 'running');
    const memoryPromise = this.retrieveMemories(ctx, state);

    let maintenancePromise: Promise<import('./types').TurnMaintenanceOutput | null> | null = null;
    if (agentSettings?.turnMaintenance?.enabled ?? true) {
      onProgress?.('turn-maintenance', 'running');
      const tmInputSize = ctx.messages.reduce((s, m) => s + m.content.length, 0) + JSON.stringify(state.lastExtraction || {}).length;
      const tmConfig = resolveSlotConfig(settings, ['director', 'storyAuthor', 'memory', 'chat'], ctx.config);
      const tmTemp = tmConfig.temperature ?? 0.7;
      const tmTimeoutMs = Math.max(30000, agentSettings?.turnMaintenance?.timeoutMs ?? 240000);
      updateStepDiagnostic('turn-maintenance', {
        inputChars: tmInputSize,
        temperature: tmTemp,
        providerId: tmConfig.provider ?? null,
        model: tmConfig.model ?? null,
        maxTokens: tmConfig.maxTokens ?? null,
        timeoutMs: tmTimeoutMs,
        resultPreview: '',
        resultFull: '',
        error: null,
        subTasks: [],
      });
      maintenancePromise = Promise.race([
        runTurnMaintenance(ctx.messages, state, ctx.cardType, ctx.config, (patch) => {
          updateStepDiagnostic('turn-maintenance', patch);
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), tmTimeoutMs)),
      ]);
    } else {
      updateStepDiagnostic('turn-maintenance', {
        inputChars: 0,
        outputChars: 0,
        resultPreview: 'Turn maintenance disabled in settings.',
        resultFull: 'Turn maintenance disabled in settings.',
        error: null,
        providerId: null,
        model: null,
        maxTokens: null,
        timeoutMs: null,
        temperature: null,
        inputTokens: null,
        outputTokens: null,
        subTasks: [],
      });
      onProgress?.('turn-maintenance', 'skipped');
    }

    const memoryText = await memoryPromise;
    if (memoryText) {
      promptSections.memory = memoryText;
      parts.unshift(memoryText);
      updateStepDiagnostic('memory-retrieval', {
        outputChars: memoryText.length,
        resultPreview: memoryText.slice(0, 200),
        resultFull: memoryText,
      });
    }
    onProgress?.('memory-retrieval', memoryText ? 'done' : 'skipped');

    if (maintenancePromise) {
      let maintenance: import('./types').TurnMaintenanceOutput | null = null;
      try {
        maintenance = await maintenancePromise;
      } catch (err: any) {
        updateStepDiagnostic('turn-maintenance', { error: err?.message || String(err) });
        maintenance = null;
      }
      if (maintenance) {
        state.lastTurnMaintenance = maintenance;
        state.narrativeState = {
          currentArc: maintenance.storyAuthor.currentArc || state.narrativeState.currentArc,
          activeTensions: maintenance.storyAuthor.activeTensions,
          recentDecisions: maintenance.storyAuthor.recentDecisions,
          nextBeats: maintenance.storyAuthor.nextBeats,
          turnNumber: ctx.turnNumber,
        };
        promptSections.narrativeGuidance = formatNarrativeGuidanceInjection(maintenance);
        promptSections.director = formatDirectorInjection(maintenance);
        parts.push(formatTurnMaintenanceInjection(maintenance));
        updateStepDiagnostic('turn-maintenance', {
          outputChars: JSON.stringify(maintenance).length,
          resultPreview: maintenance.narrativeBrief.slice(0, 200),
          resultFull: JSON.stringify(maintenance, null, 2),
        });
        onProgress?.('turn-maintenance', 'done');
      } else {
        const reliabilityGuardText = formatReliabilityGuard();
        parts.push(reliabilityGuardText);
        promptSections.narrativeGuidance = reliabilityGuardText;
        reliabilityGuard = true;
        updateStepDiagnostic('turn-maintenance', {
          resultPreview: reliabilityGuardText,
          resultFull: reliabilityGuardText,
          error: 'Timed out or response could not be parsed',
        });
        onProgress?.('turn-maintenance', 'failed');
      }
    }

    promptSections.worldRelations = formatWorldRelationsInjection(state);

    if (ctx.cardType === 'world' && (agentSettings?.worldMode?.sectionWorldInjection ?? true)) {
      onProgress?.('section-world', 'running');
      const swInputSize = JSON.stringify(state.lastExtraction || {}).length + Object.keys(state.entities).length * 100;
      updateStepDiagnostic('section-world', {
        inputChars: swInputSize,
        resultPreview: '',
        resultFull: '',
        error: null,
        subTasks: [],
      });
      const sectionWorld = await runSectionWorld(state, ctx.config, (patch) => {
        updateStepDiagnostic('section-world', patch);
      });
      if (sectionWorld) {
        state.lastSectionWorld = sectionWorld;
        const sectionWorldText = formatSectionWorldInjection(sectionWorld);
        promptSections.sectionWorld = sectionWorldText;
        parts.push(sectionWorldText);
        updateStepDiagnostic('section-world', {
          outputChars: JSON.stringify(sectionWorld).length,
          resultPreview: `${sectionWorld.sectionTitle}: ${sectionWorld.prompt.slice(0, 150)}`,
          resultFull: JSON.stringify(sectionWorld, null, 2),
        });
        onProgress?.('section-world', 'done');
      } else {
        updateStepDiagnostic('section-world', { error: 'No prior extraction was available for section world.' });
        onProgress?.('section-world', 'skipped');
      }
    } else {
      updateStepDiagnostic('section-world', {
        inputChars: 0,
        outputChars: 0,
        resultPreview: ctx.cardType === 'world' ? 'Section world disabled in settings.' : 'Character chat does not use section world.',
        resultFull: ctx.cardType === 'world' ? 'Section world disabled in settings.' : 'Character chat does not use section world.',
        error: null,
        providerId: null,
        model: null,
        maxTokens: null,
        timeoutMs: null,
        temperature: null,
        inputTokens: null,
        outputTokens: null,
        subTasks: [],
      });
      onProgress?.('section-world', 'skipped');
    }

    await saveSessionState(state);
    this.state = state;

    const injection = parts.join('\n\n');
    updateStepDiagnostic('generation', {
      inputChars: injection.length,
      resultPreview: injection.slice(0, 500),
      resultFull: injection,
    });

    return { injection, reliabilityGuard, promptSections };
  }

  async runAfterGeneration(
    ctx: AgentPipelineContext,
    response: string,
    onProgress?: PipelineProgressCallback,
  ): Promise<PipelineAfterResult> {
    const state = await this.ensureState(ctx);
    const agentSettings = get(settingsStore).agentSettings as any;

    if (agentSettings?.enabled === false || agentSettings?.extraction?.enabled === false) {
      updateStepDiagnostic('extraction', {
        inputChars: 0,
        outputChars: 0,
        resultPreview: 'Extraction disabled in settings.',
        resultFull: 'Extraction disabled in settings.',
        error: null,
        providerId: null,
        model: null,
        maxTokens: null,
        timeoutMs: null,
        temperature: null,
        inputTokens: null,
        outputTokens: null,
        subTasks: [],
      });
      onProgress?.('extraction', 'skipped');
      return { extraction: null };
    }

    onProgress?.('extraction', 'running');
    const allMessages = [...ctx.messages, { role: 'assistant' as const, content: response, type: 'dialogue' as const, timestamp: Date.now() }];
    const extractionConfig = resolveSlotConfig(get(settingsStore), ['extraction', 'memory', 'chat'], ctx.config);
    updateStepDiagnostic('extraction', {
      inputChars: allMessages.reduce((s, m) => s + m.content.length, 0),
      temperature: extractionConfig.temperature ?? 0.3,
      providerId: extractionConfig.provider ?? null,
      model: extractionConfig.model ?? null,
      maxTokens: extractionConfig.maxTokens ?? null,
      resultPreview: '',
      resultFull: '',
      error: null,
      subTasks: [],
    });
    const extraction = await runExtraction(allMessages, state, ctx.cardType, ctx.config, (patch) => {
      updateStepDiagnostic('extraction', patch);
    });

    if (extraction) {
      state.lastExtraction = extraction;
      state.narrativeState.turnNumber = ctx.turnNumber;
      state.turnHistory.push({
        turnNumber: ctx.turnNumber,
        extractionSummary: extraction.events.join('; ') || 'No events',
        events: extraction.events,
        timestamp: Date.now(),
      });
      const summaryThreshold = Math.max(10, get(settingsStore).memorySettings?.summaryThreshold ?? 50);
      const historyLimit = Math.max(summaryThreshold * 2, 60);
      if (state.turnHistory.length > historyLimit) {
        state.turnHistory = state.turnHistory.slice(-historyLimit);
      }
      await this.maybeSummarizeHistory(state, ctx.config);
      updateStepDiagnostic('extraction', {
        outputChars: JSON.stringify(extraction).length,
        resultPreview: `Scene: ${extraction.scene.location} | Events: ${extraction.events.slice(0, 3).join(', ')} | Facts: ${extraction.newFacts.length}`,
        resultFull: JSON.stringify(extraction, null, 2),
      });
      onProgress?.('extraction', 'done');
    } else {
      updateStepDiagnostic('extraction', { error: 'Extraction LLM returned null — parse failure or empty response' });
      onProgress?.('extraction', 'failed');
    }

    await saveSessionState(state);
    this.state = state;

    return { extraction };
  }

  private buildSummaryUserContent(batch: SessionAgentState['turnHistory']): string {
    const lines: string[] = [
      'Summarize these turns for long-term continuity. Preserve key events, relationship changes, world facts, and unresolved tensions.',
      '',
    ];

    for (const turn of batch) {
      lines.push(`Turn ${turn.turnNumber}`);
      lines.push(`Summary: ${turn.extractionSummary}`);
      if (turn.events.length > 0) {
        lines.push(`Events: ${turn.events.join('; ')}`);
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  private async maybeSummarizeHistory(
    state: SessionAgentState,
    config: import('$lib/types/config').UserConfig,
  ): Promise<void> {
    const settings = get(settingsStore);
    const threshold = Math.max(1, settings.memorySettings?.summaryThreshold ?? 50);
    const lastSummaryTurn = await getLatestSummaryTurn(state.sessionId);
    const unsummarized = state.turnHistory.filter((turn) => turn.turnNumber > lastSummaryTurn);
    if (unsummarized.length < threshold) {
      return;
    }

    const batch = unsummarized.slice(0, threshold);
    const summaryConfig = resolveSummaryConfig(config);
    if (!summaryConfig.provider || !summaryConfig.apiKey || !summaryConfig.model) {
      return;
    }

    try {
      const summary = await callAgentLLM(
        summaryConfig.customPrompt,
        this.buildSummaryUserContent(batch),
        {
          providerId: summaryConfig.provider,
          apiKey: summaryConfig.apiKey,
          model: summaryConfig.model,
          baseUrl: summaryConfig.baseUrl,
          temperature: summaryConfig.temperature,
          maxTokens: summaryConfig.maxTokens,
        },
        {
          assistantPrefill: getAgentPrefill('summary'),
        },
      );
      if (!summary.trim()) {
        return;
      }

      await insertSummary({
        id: crypto.randomUUID(),
        sessionId: state.sessionId as any,
        startTurn: batch[0].turnNumber,
        endTurn: batch[batch.length - 1].turnNumber,
        summary: summary.trim(),
        createdAt: Date.now(),
      });
    } catch (err) {
      console.warn('[AgentPipeline] Summary generation failed:', err);
    }
  }

  private async retrieveMemories(ctx: AgentPipelineContext, state: SessionAgentState): Promise<string | undefined> {
    const settings = get(settingsStore);
    const memSettings = settings.memorySettings;
    const topK = Math.max(1, memSettings?.topK ?? 15);
    const summaries = (await getSummariesForSession(ctx.sessionId as string))
      .filter((summary) => summary.endTurn < ctx.turnNumber)
      .slice(-3);

    try {
      const sections: string[] = [];
      const latestSummary = summaries.length > 0 ? summaries[summaries.length - 1].summary : undefined;
      const allMemories = (await getMemoriesForSession(ctx.sessionId as string))
        .filter((memory) => memory.turnNumber < ctx.turnNumber);

      if (summaries.length > 0) {
        const summaryText = formatSummaryInjection(summaries);
        if (summaryText) {
          sections.push(summaryText);
        }
      }

      const arcText = formatArcMemoryInjection(state.narrativeState, latestSummary);
      if (arcText) {
        sections.push(arcText);
      }

      const persistentMemories = pickLayeredMemories(
        allMemories,
        ctx.cardType === 'world'
          ? ['trait', 'relationship']
          : ['trait', 'relationship', 'world_fact', 'location'],
        Math.min(Math.max(4, Math.ceil(topK / 2)), 8),
        'importance',
      );
      const persistentText = formatPersistentMemoryInjection(
        persistentMemories.map((memory) => ({ content: memory.content, type: memory.type })),
      );
      if (persistentText) {
        sections.push(persistentText);
      }

      if (ctx.cardType === 'world') {
        const worldMemories = pickLayeredMemories(
          allMemories,
          ['world_fact', 'location', 'state'],
          Math.min(Math.max(4, Math.ceil(topK / 2)), 8),
          'importance',
        );
        const worldText = formatWorldMemoryInjection(
          worldMemories.map((memory) => ({ content: memory.content, type: memory.type })),
        );
        if (worldText) {
          sections.push(worldText);
        }
      }

      const turningPointMemories = pickLayeredMemories(
        allMemories,
        ['event', 'personal_event', 'state'],
        Math.min(Math.max(3, Math.ceil(topK / 3)), 6),
        'recent',
      );
      const turningPointFallback = turningPointMemories.length > 0
        ? turningPointMemories.map((memory) => memory.content)
        : state.turnHistory
            .slice(-3)
            .map((entry) => entry.extractionSummary)
            .filter((summary) => summary && summary !== 'No events');
      const turningPointText = formatTurningPointInjection(turningPointFallback);
      if (turningPointText) {
        sections.push(turningPointText);
      }

      let memories: Array<{ content: string; type: string }> = [];
      if (memSettings?.embeddingProvider && memSettings?.embeddingApiKey) {
        const recentMessages = ctx.messages.slice(-4);
        const queryParts = recentMessages.map((message) => message.content);
        if (state.lastExtraction?.scene.location) {
          queryParts.push(state.lastExtraction.scene.location);
        }
        if (state.lastTurnMaintenance?.narrativeBrief) {
          queryParts.push(state.lastTurnMaintenance.narrativeBrief);
        }
        if (summaries.length > 0) {
          queryParts.push(summaries[summaries.length - 1].summary);
        }
        const queryText = queryParts.join(' ').trim();
        if (queryText) {
          const queryEmbedding = await getEmbedding(queryText, {
            provider: memSettings.embeddingProvider as 'voyage' | 'openai-compatible',
            apiKey: memSettings.embeddingApiKey,
            model: memSettings.embeddingModel,
          });

          const results = await findSimilarMemories(ctx.sessionId, queryEmbedding, topK, ctx.turnNumber);
          memories = results.map((result) => ({ content: result.content, type: result.type }));
        }
      } else {
        const fallback = await getTopKMemories(ctx.sessionId as string, Math.max(topK * 3, topK + 6));
        memories = fallback
          .filter((memory) => memory.turnNumber < ctx.turnNumber)
          .sort((left, right) => {
            if (right.importance !== left.importance) {
              return right.importance - left.importance;
            }
            return right.createdAt - left.createdAt;
          })
          .slice(0, topK)
          .map((memory) => ({ content: memory.content, type: memory.type }));
      }

      const alreadyInjected = new Set(
        [
          ...persistentMemories,
          ...turningPointMemories,
        ].map((memory) => normalizeMemoryKey(memory.content)),
      );
      const filteredMemories = dedupeMemories(
        memories
          .filter((memory) => !alreadyInjected.has(normalizeMemoryKey(memory.content)))
          .map((memory) => ({
            id: `${memory.type}:${memory.content}`,
            sessionId: ctx.sessionId,
            type: memory.type as MemoryType,
            content: memory.content,
            importance: 0,
            sourceMessageIds: [],
            turnNumber: 0,
            createdAt: 0,
          })),
      )
        .slice(0, topK)
        .map((memory) => ({ content: memory.content, type: memory.type }));

      const memoryText = formatMemoryInjection(filteredMemories);
      if (memoryText) {
        sections.push(memoryText);
      }
      if (sections.length === 0) {
        return undefined;
      }

      const combined = sections.join('\n\n');
      const charBudget = Math.max(512, (memSettings?.tokenBudget ?? 4096) * 4);
      return combined.length > charBudget ? combined.slice(0, charBudget) : combined;
    } catch (err) {
      console.warn('[AgentPipeline] Memory retrieval failed:', err);
      return undefined;
    }
  }
}
