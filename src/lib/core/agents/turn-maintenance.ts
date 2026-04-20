import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { callAgentLLM } from './agent-llm';
import { PROMPTS } from './prompts';
import type { SessionAgentState, TurnMaintenanceOutput } from './types';
import type { Message } from '$lib/types/message';
import type { UserConfig } from '$lib/types/config';

function resolveMaintenanceConfig(chatConfig?: UserConfig) {
  const settings = get(settingsStore);
  const directorSlot = settings.modelSlots?.director;
  const memorySlot = settings.modelSlots?.memory;
  const chatSlot = settings.modelSlots?.chat;

  const provider = directorSlot?.provider || memorySlot?.provider || chatSlot?.provider
    || chatConfig?.providerId || settings.defaultProvider;
  const apiKey = directorSlot?.apiKey || memorySlot?.apiKey || chatSlot?.apiKey
    || chatConfig?.apiKey
    || (settings.providers?.[settings.defaultProvider!]?.apiKey as string);
  const model = directorSlot?.model || memorySlot?.model || chatSlot?.model
    || chatConfig?.model
    || (settings.providers?.[settings.defaultProvider!]?.model as string);
  const baseUrl = directorSlot?.baseUrl || memorySlot?.baseUrl || chatSlot?.baseUrl
    || chatConfig?.baseUrl;
  const temperature = directorSlot?.temperature ?? memorySlot?.temperature ?? chatSlot?.temperature ?? 0.7;
  const maxTokens = (settings.agentSettings as any)?.turnMaintenance?.tokenBudget ?? 2048;

  const agentSettings = settings.agentSettings as any;
  const directorMode = agentSettings?.director?.mode || 'light';

  return { provider, apiKey, model, baseUrl, temperature, maxTokens, directorMode };
}

export function parseTurnMaintenanceJson(content: string): TurnMaintenanceOutput | null {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);

    if (typeof parsed.narrativeBrief !== 'string') return null;
    if (!parsed.storyAuthor || typeof parsed.storyAuthor !== 'object') return null;
    if (!parsed.director || typeof parsed.director !== 'object') return null;

    const validPacing = ['slow', 'normal', 'fast'];
    const validPressure = ['low', 'medium', 'high'];

    return {
      narrativeBrief: parsed.narrativeBrief,
      correction: {
        shouldCorrect: Boolean(parsed.correction?.shouldCorrect),
        reasons: Array.isArray(parsed.correction?.reasons) ? parsed.correction.reasons : [],
        correctedEntities: parsed.correction?.correctedEntities,
        correctedRelations: parsed.correction?.correctedRelations,
      },
      storyAuthor: {
        currentArc: String(parsed.storyAuthor.currentArc || ''),
        narrativeGoal: String(parsed.storyAuthor.narrativeGoal || ''),
        activeTensions: Array.isArray(parsed.storyAuthor.activeTensions) ? parsed.storyAuthor.activeTensions.filter((t: unknown) => typeof t === 'string') : [],
        nextBeats: Array.isArray(parsed.storyAuthor.nextBeats) ? parsed.storyAuthor.nextBeats.filter((b: unknown) => typeof b === 'string') : [],
        guardrails: Array.isArray(parsed.storyAuthor.guardrails) ? parsed.storyAuthor.guardrails.filter((g: unknown) => typeof g === 'string') : [],
        focusCharacters: Array.isArray(parsed.storyAuthor.focusCharacters) ? parsed.storyAuthor.focusCharacters.filter((c: unknown) => typeof c === 'string') : [],
        recentDecisions: Array.isArray(parsed.storyAuthor.recentDecisions) ? parsed.storyAuthor.recentDecisions.filter((d: unknown) => typeof d === 'string') : [],
      },
      director: {
        sceneMandate: String(parsed.director.sceneMandate || ''),
        requiredOutcomes: Array.isArray(parsed.director.requiredOutcomes) ? parsed.director.requiredOutcomes.filter((o: unknown) => typeof o === 'string') : [],
        forbiddenMoves: Array.isArray(parsed.director.forbiddenMoves) ? parsed.director.forbiddenMoves.filter((m: unknown) => typeof m === 'string') : [],
        emphasis: Array.isArray(parsed.director.emphasis) ? parsed.director.emphasis.filter((e: unknown) => typeof e === 'string') : [],
        targetPacing: validPacing.includes(parsed.director.targetPacing) ? parsed.director.targetPacing : 'normal',
        pressureLevel: validPressure.includes(parsed.director.pressureLevel) ? parsed.director.pressureLevel : 'medium',
        focusCharacters: Array.isArray(parsed.director.focusCharacters) ? parsed.director.focusCharacters.filter((c: unknown) => typeof c === 'string') : [],
      },
    };
  } catch {
    return null;
  }
}

export function buildTurnMaintenanceUserContent(
  messages: Message[],
  state: SessionAgentState,
  cardType: 'character' | 'world',
): string {
  const parts: string[] = [];

  parts.push('=== Recent Conversation ===');
  for (const msg of messages.slice(-6)) {
    parts.push(`${msg.role}: ${msg.content}`);
  }

  if (state.lastExtraction) {
    parts.push('\n=== Current Extraction Snapshot ===');
    parts.push(`Scene: ${state.lastExtraction.scene.location}`);
    parts.push(`Characters: ${state.lastExtraction.scene.characters.join(', ')}`);
    parts.push(`Atmosphere: ${state.lastExtraction.scene.atmosphere}`);
    parts.push(`Events: ${state.lastExtraction.events.join('; ')}`);
    if (Object.keys(state.lastExtraction.characters).length > 0) {
      parts.push('Character States:');
      for (const [name, cs] of Object.entries(state.lastExtraction.characters)) {
        parts.push(`  ${name}: ${cs.emotion}, ${cs.location}, health: ${cs.health}`);
      }
    }
  }

  if (state.narrativeState.currentArc || state.narrativeState.activeTensions.length > 0) {
    parts.push('\n=== Current Narrative State ===');
    if (state.narrativeState.currentArc) parts.push(`Current Arc: ${state.narrativeState.currentArc}`);
    if (state.narrativeState.activeTensions.length) parts.push(`Active Tensions: ${state.narrativeState.activeTensions.join('; ')}`);
    if (state.narrativeState.recentDecisions.length) parts.push(`Recent Decisions: ${state.narrativeState.recentDecisions.join('; ')}`);
  }

  if (state.lastTurnMaintenance) {
    parts.push('\n=== Previous Turn Maintenance ===');
    parts.push(`Previous Brief: ${state.lastTurnMaintenance.narrativeBrief}`);
    if (state.lastTurnMaintenance.storyAuthor.nextBeats.length) {
      parts.push(`Previous Next Beats: ${state.lastTurnMaintenance.storyAuthor.nextBeats.join('; ')}`);
    }
  }

  if (cardType === 'world') {
    parts.push('\nNote: This is a world simulation. Include world-scale narrative guidance.');
  }

  return parts.join('\n');
}

export async function runTurnMaintenance(
  messages: Message[],
  state: SessionAgentState,
  cardType: 'character' | 'world',
  chatConfig?: UserConfig,
): Promise<TurnMaintenanceOutput | null> {
  const config = resolveMaintenanceConfig(chatConfig);
  if (!config.provider || !config.apiKey || !config.model) {
    console.warn('[TurnMaintenance] No model configured');
    return null;
  }

  const systemPrompt = PROMPTS.get('TURN_MAINTENANCE_SYSTEM');
  const userContent = buildTurnMaintenanceUserContent(messages, state, cardType);

  let rawContent: string;
  try {
    rawContent = await callAgentLLM(systemPrompt, userContent, {
      providerId: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
  } catch (err) {
    console.warn('[TurnMaintenance] LLM call failed:', err);
    return null;
  }

  let result = parseTurnMaintenanceJson(rawContent);

  if (!result) {
    console.warn('[TurnMaintenance] JSON parse failed, attempting repair');
    try {
      const repairedContent = await callAgentLLM(
        'Repair this JSON. Return only valid JSON with keys: narrativeBrief, correction, storyAuthor, director.',
        rawContent,
        {
          providerId: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
          temperature: 0.1,
          maxTokens: 2048,
        },
      );
      result = parseTurnMaintenanceJson(repairedContent);
    } catch (repairErr) {
      console.warn('[TurnMaintenance] Repair failed:', repairErr);
    }
  }

  if (!result) {
    console.warn('[TurnMaintenance] All attempts failed');
  }

  return result;
}
