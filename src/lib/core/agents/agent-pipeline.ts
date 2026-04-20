import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { runExtraction } from './extraction';
import { runTurnMaintenance } from './turn-maintenance';
import { formatTurnMaintenanceInjection, formatExtractionInjection, formatReliabilityGuard, formatMemoryInjection } from './injection';
import { loadSessionState, saveSessionState } from '$lib/storage/session-agent-state';
import { findSimilarMemories } from '$lib/storage/memories';
import { getEmbedding } from '$lib/core/embedding';
import type {
  AgentPipelineContext,
  SessionAgentState,
  ExtractionSnapshot,
  PipelineProgressCallback,
  PipelineStepStatus,
} from './types';

export interface PipelineBeforeResult {
  injection: string;
  reliabilityGuard: boolean;
}

export interface PipelineAfterResult {
  extraction: ExtractionSnapshot | null;
}

export class AgentPipeline {
  private state: SessionAgentState | null = null;

  getSteps(): Array<{ id: string; label: string }> {
    return [
      { id: 'memory-retrieval', label: 'Memory' },
      { id: 'turn-maintenance', label: 'Planning' },
      { id: 'generation', label: 'Generating' },
      { id: 'extraction', label: 'Extracting' },
    ];
  }

  reportGenerationStatus(status: PipelineStepStatus, onProgress?: PipelineProgressCallback): void {
    onProgress?.('generation', status);
  }

  private async ensureState(ctx: AgentPipelineContext): Promise<SessionAgentState> {
    if (this.state && this.state.sessionId === ctx.sessionId) {
      return this.state;
    }
    const loaded = await loadSessionState(ctx.sessionId);
    if (loaded) {
      this.state = loaded;
    } else {
      this.state = {
        sessionId: ctx.sessionId,
        lastExtraction: null,
        lastTurnMaintenance: null,
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
    return this.state;
  }

  async runBeforeGeneration(
    ctx: AgentPipelineContext,
    onProgress?: PipelineProgressCallback,
  ): Promise<PipelineBeforeResult> {
    const state = await this.ensureState(ctx);
    const parts: string[] = [];
    let reliabilityGuard = false;

    onProgress?.('memory-retrieval', 'running');
    const memoryText = await this.retrieveMemories(ctx);
    if (memoryText) {
      parts.push(memoryText);
    }
    onProgress?.('memory-retrieval', memoryText ? 'done' : 'skipped');

    if (state.lastExtraction) {
      const sceneInjection = formatExtractionInjection(state.lastExtraction);
      if (sceneInjection) parts.push(sceneInjection);
    }

    onProgress?.('turn-maintenance', 'running');
    const maintenance = await runTurnMaintenance(ctx.messages, state, ctx.cardType, ctx.config);
    if (maintenance) {
      state.lastTurnMaintenance = maintenance;
      state.narrativeState = {
        currentArc: maintenance.storyAuthor.currentArc || state.narrativeState.currentArc,
        activeTensions: maintenance.storyAuthor.activeTensions,
        recentDecisions: maintenance.storyAuthor.recentDecisions,
        nextBeats: maintenance.storyAuthor.nextBeats,
        turnNumber: ctx.turnNumber,
      };
      parts.push(formatTurnMaintenanceInjection(maintenance));
      onProgress?.('turn-maintenance', 'done');
    } else {
      parts.push(formatReliabilityGuard());
      reliabilityGuard = true;
      onProgress?.('turn-maintenance', 'failed');
    }

    await saveSessionState(state);
    this.state = state;

    return { injection: parts.join('\n\n'), reliabilityGuard };
  }

  async runAfterGeneration(
    ctx: AgentPipelineContext,
    response: string,
    onProgress?: PipelineProgressCallback,
  ): Promise<PipelineAfterResult> {
    const state = await this.ensureState(ctx);

    onProgress?.('extraction', 'running');
    const allMessages = [...ctx.messages, { role: 'assistant' as const, content: response, type: 'dialogue' as const, timestamp: Date.now() }];
    const extraction = await runExtraction(allMessages, state, ctx.cardType, ctx.config);

    if (extraction) {
      state.lastExtraction = extraction;
      state.narrativeState.turnNumber = ctx.turnNumber;
      state.turnHistory.push({
        turnNumber: ctx.turnNumber,
        extractionSummary: extraction.events.join('; ') || 'No events',
        events: extraction.events,
        timestamp: Date.now(),
      });
      if (state.turnHistory.length > 20) {
        state.turnHistory = state.turnHistory.slice(-20);
      }
      onProgress?.('extraction', 'done');
    } else {
      onProgress?.('extraction', 'failed');
    }

    await saveSessionState(state);
    this.state = state;

    return { extraction };
  }

  private async retrieveMemories(ctx: AgentPipelineContext): Promise<string | undefined> {
    const settings = get(settingsStore);
    const memSettings = settings.memorySettings;
    if (!memSettings?.embeddingProvider || !memSettings?.embeddingApiKey) {
      return undefined;
    }

    try {
      const recentMessages = ctx.messages.slice(-4);
      const queryText = recentMessages.map(m => m.content).join(' ');
      if (!queryText.trim()) return undefined;

      const queryEmbedding = await getEmbedding(queryText, {
        provider: memSettings.embeddingProvider as 'voyage' | 'openai-compatible',
        apiKey: memSettings.embeddingApiKey,
        model: memSettings.embeddingModel,
      });

      const topK = memSettings.topK ?? 15;
      const results = await findSimilarMemories(ctx.sessionId, queryEmbedding, topK, ctx.turnNumber);
      if (!results.length) return undefined;

      return formatMemoryInjection(results.map(r => ({ content: r.content, type: r.type })));
    } catch (err) {
      console.warn('[AgentPipeline] Memory retrieval failed:', err);
      return undefined;
    }
  }
}
