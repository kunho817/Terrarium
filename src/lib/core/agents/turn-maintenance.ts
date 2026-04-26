import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { callAgentLLMWithMetadata } from './agent-llm';
import { getAgentPrefill, PROMPTS } from './prompts';
import type { SessionAgentState, TurnMaintenanceOutput } from './types';
import type { Message } from '$lib/types/message';
import type { UserConfig } from '$lib/types/config';
import { resolveSlotConfig } from '$lib/core/models/slot-resolver';
import type { PipelineSubTaskDiagnostic, StepDiagnostic } from '$lib/types/diagnostics';

type StoryAuthorPlan = TurnMaintenanceOutput['storyAuthor'];
type DirectorPlan = TurnMaintenanceOutput['director'];

function resolveMaintenanceConfig(chatConfig?: UserConfig) {
  const settings = get(settingsStore);
  const agentSettings = settings.agentSettings as any;
  const slot = resolveSlotConfig(settings, ['director', 'storyAuthor', 'memory', 'chat'], chatConfig);

  const provider = slot.provider;
  const apiKey = slot.apiKey;
  const model = slot.model;
  const baseUrl = slot.baseUrl;
  const temperature = slot.temperature ?? 0.7;
  const maxTokens = slot.maxTokens ?? agentSettings?.turnMaintenance?.tokenBudget ?? 32000;
  const timeoutMs = agentSettings?.turnMaintenance?.timeoutMs ?? 240000;
  const directorMode = agentSettings?.director?.mode || 'light';
  const contextMessages = agentSettings?.turnMaintenance?.contextMessages ?? 4;
  const enabled = agentSettings?.turnMaintenance?.enabled ?? true;

  return { provider, apiKey, model, baseUrl, temperature, maxTokens, timeoutMs, directorMode, contextMessages, enabled };
}

export function extractJsonFromLLMResponse(text: string): string | null {
	let cleaned = text;
	cleaned = cleaned.replace(/```(?:json)?\s*\n?/gi, '');
	cleaned = cleaned.replace(/```\s*/g, '');

	const braceMatch = cleaned.match(/\{[\s\S]*\}/);
	if (braceMatch) return braceMatch[0];

	const openBraces = (cleaned.match(/\{/g) || []).length;
	const closeBraces = (cleaned.match(/\}/g) || []).length;
	const openBrackets = (cleaned.match(/\[/g) || []).length;
	const closeBrackets = (cleaned.match(/\]/g) || []).length;
	if (openBraces > closeBraces) {
		let repaired = cleaned;
		while (openBrackets > closeBrackets + (repaired.match(/\]/g) || []).length - closeBrackets) {
			repaired += ']';
		}
		for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
		const repairedMatch = repaired.match(/\{[\s\S]*\}/);
		if (repairedMatch) return repairedMatch[0];
	}

	return null;
}

function tryParseJsonLenient(raw: string): any | null {
	for (const candidate of [raw, raw.replace(/,\s*([}\]])/g, '$1')]) {
		try {
			return JSON.parse(candidate);
		} catch {}
	}
	return null;
}

const validPacing = ['slow', 'normal', 'fast'];
const validPressure = ['low', 'medium', 'high'];

function str(val: unknown, fallback = ''): string {
	return typeof val === 'string' ? val : fallback;
}

function strArr(val: unknown): string[] {
	return Array.isArray(val) ? val.filter((x: unknown) => typeof x === 'string') : [];
}

function parseStoryAuthorJson(content: string): StoryAuthorPlan | null {
	if (typeof content !== 'string') return null;
	const jsonStr = extractJsonFromLLMResponse(content);
	if (!jsonStr) return null;

	const parsed = tryParseJsonLenient(jsonStr);
	if (!parsed || typeof parsed !== 'object') return null;
	const source = parsed.storyAuthor && typeof parsed.storyAuthor === 'object' ? parsed.storyAuthor : parsed;

	return {
		currentArc: str(source.currentArc),
		narrativeGoal: str(source.narrativeGoal),
		activeTensions: strArr(source.activeTensions),
		nextBeats: strArr(source.nextBeats),
		guardrails: strArr(source.guardrails),
		focusCharacters: strArr(source.focusCharacters),
		recentDecisions: strArr(source.recentDecisions),
	};
}

function parseDirectorJson(content: string): DirectorPlan | null {
	if (typeof content !== 'string') return null;
	const jsonStr = extractJsonFromLLMResponse(content);
	if (!jsonStr) return null;

	const parsed = tryParseJsonLenient(jsonStr);
	if (!parsed || typeof parsed !== 'object') return null;
	const source = parsed.director && typeof parsed.director === 'object' ? parsed.director : parsed;

	return {
		sceneMandate: str(source.sceneMandate),
		requiredOutcomes: strArr(source.requiredOutcomes),
		forbiddenMoves: strArr(source.forbiddenMoves),
		emphasis: strArr(source.emphasis),
		targetPacing: validPacing.includes(source.targetPacing) ? source.targetPacing : 'normal',
		pressureLevel: validPressure.includes(source.pressureLevel) ? source.pressureLevel : 'medium',
		focusCharacters: strArr(source.focusCharacters),
	};
}

function composeNarrativeBrief(
	state: SessionAgentState,
	storyAuthor: StoryAuthorPlan,
	director: DirectorPlan,
): string {
	const fragments: string[] = [];

	if (state.lastExtraction?.scene.location) {
		fragments.push(`Scene remains anchored at ${state.lastExtraction.scene.location}.`);
	}
	if (storyAuthor.narrativeGoal) {
		fragments.push(`Immediate goal: ${storyAuthor.narrativeGoal}.`);
	}
	if (storyAuthor.activeTensions[0]) {
		fragments.push(`Primary tension: ${storyAuthor.activeTensions[0]}.`);
	}
	if (director.sceneMandate) {
		fragments.push(`Scene mandate: ${director.sceneMandate}.`);
	}

	return fragments.join(' ').trim() || 'Continue the current scene while preserving continuity and forcing one meaningful beat.';
}

export function parseTurnMaintenanceJson(content: string): TurnMaintenanceOutput | null {
	const jsonStr = extractJsonFromLLMResponse(content);
	if (!jsonStr) return null;

	const parsed = tryParseJsonLenient(jsonStr);
	if (!parsed || typeof parsed !== 'object') return null;

	return {
		narrativeBrief: str(parsed.narrativeBrief),
		correction: {
			shouldCorrect: Boolean(parsed.correction?.shouldCorrect),
			reasons: strArr(parsed.correction?.reasons),
			correctedEntities: parsed.correction?.correctedEntities,
			correctedRelations: parsed.correction?.correctedRelations,
		},
		storyAuthor: {
			currentArc: str(parsed.storyAuthor?.currentArc),
			narrativeGoal: str(parsed.storyAuthor?.narrativeGoal),
			activeTensions: strArr(parsed.storyAuthor?.activeTensions),
			nextBeats: strArr(parsed.storyAuthor?.nextBeats),
			guardrails: strArr(parsed.storyAuthor?.guardrails),
			focusCharacters: strArr(parsed.storyAuthor?.focusCharacters),
			recentDecisions: strArr(parsed.storyAuthor?.recentDecisions),
		},
		director: {
			sceneMandate: str(parsed.director?.sceneMandate),
			requiredOutcomes: strArr(parsed.director?.requiredOutcomes),
			forbiddenMoves: strArr(parsed.director?.forbiddenMoves),
			emphasis: strArr(parsed.director?.emphasis),
			targetPacing: validPacing.includes(parsed.director?.targetPacing) ? parsed.director.targetPacing : 'normal',
			pressureLevel: validPressure.includes(parsed.director?.pressureLevel) ? parsed.director.pressureLevel : 'medium',
			focusCharacters: strArr(parsed.director?.focusCharacters),
		},
	};
}

export function buildTurnMaintenanceUserContent(
  messages: Message[],
  state: SessionAgentState,
  cardType: 'character' | 'world',
  contextMessages = 4,
): string {
  const parts: string[] = [];

  parts.push('=== Recent Conversation ===');
  for (const msg of messages.slice(-Math.max(1, contextMessages))) {
    parts.push(`${msg.role}: ${msg.content.slice(0, 800)}`);
  }

  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  if (latestUserMessage) {
    parts.push('\n=== User Priority ===');
    parts.push(`Current user turn: ${latestUserMessage.content.slice(0, 800)}`);
    parts.push('Any planning output must directly support this user turn.');
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

async function runCombinedTurnMaintenance(
  userContent: string,
  state: SessionAgentState,
  config: ReturnType<typeof resolveMaintenanceConfig>,
  subTasks: PipelineSubTaskDiagnostic[],
): Promise<TurnMaintenanceOutput | null> {
  const modePrompt = PROMPTS.get(`DIRECTOR_MODE_${config.directorMode.toUpperCase()}`);
  const systemPrompt = [PROMPTS.get('TURN_MAINTENANCE_SYSTEM'), modePrompt].filter(Boolean).join('\n\n');

  let rawContent: string;
  try {
    const callResult = await callAgentLLMWithMetadata(systemPrompt, userContent, {
      providerId: config.provider!,
      apiKey: config.apiKey!,
      model: config.model!,
      baseUrl: config.baseUrl,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    }, {
      assistantPrefill: getAgentPrefill('turnMaintenance'),
    });
    rawContent = callResult.text;
    subTasks.push({
      id: 'combined-planner',
      label: 'Combined Planner',
      status: 'done',
      startedAt: Date.now() - callResult.durationMs,
      finishedAt: Date.now(),
      providerId: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      inputChars: userContent.length,
      outputChars: rawContent.length,
      inputTokens: callResult.inputTokens ?? null,
      outputTokens: callResult.outputTokens ?? null,
      result: rawContent,
      error: null,
    });
  } catch (err) {
    subTasks.push({
      id: 'combined-planner',
      label: 'Combined Planner',
      status: 'failed',
      startedAt: Date.now(),
      finishedAt: Date.now(),
      providerId: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      inputChars: userContent.length,
      outputChars: 0,
      inputTokens: null,
      outputTokens: null,
      result: '',
      error: err instanceof Error ? err.message : String(err),
    });
    console.warn('[TurnMaintenance] Combined LLM call failed:', err);
    return null;
  }

  console.log('[TurnMaintenance] raw response length:', rawContent.length, 'first 500 chars:', rawContent.slice(0, 500));
  if (!rawContent.trim()) {
    console.warn('[TurnMaintenance] LLM returned empty response');
    return null;
  }

  let result = parseTurnMaintenanceJson(rawContent);
  if (!result) {
    console.warn('[TurnMaintenance] JSON parse failed, raw was:', rawContent.slice(0, 1000));
    try {
      const repairedResult = await callAgentLLMWithMetadata(
        'Repair this JSON. Return only valid JSON with keys: narrativeBrief, correction, storyAuthor, director.',
        rawContent,
        {
          providerId: config.provider!,
          apiKey: config.apiKey!,
          model: config.model!,
          baseUrl: config.baseUrl,
          temperature: 0.1,
          maxTokens: 8000,
        },
        {
          assistantPrefill: getAgentPrefill('turnMaintenance'),
        },
      );
      const repairedContent = repairedResult.text;
      subTasks.push({
        id: 'combined-repair',
        label: 'Planning Repair',
        status: 'done',
        startedAt: Date.now() - repairedResult.durationMs,
        finishedAt: Date.now(),
        providerId: config.provider,
        model: config.model,
        temperature: 0.1,
        maxTokens: 8000,
        inputChars: rawContent.length,
        outputChars: repairedContent.length,
        inputTokens: repairedResult.inputTokens ?? null,
        outputTokens: repairedResult.outputTokens ?? null,
        result: repairedContent,
        error: null,
      });
      result = parseTurnMaintenanceJson(repairedContent);
    } catch (repairErr) {
      subTasks.push({
        id: 'combined-repair',
        label: 'Planning Repair',
        status: 'failed',
        startedAt: Date.now(),
        finishedAt: Date.now(),
        providerId: config.provider,
        model: config.model,
        temperature: 0.1,
        maxTokens: 8000,
        inputChars: rawContent.length,
        outputChars: 0,
        inputTokens: null,
        outputTokens: null,
        result: '',
        error: repairErr instanceof Error ? repairErr.message : String(repairErr),
      });
      console.warn('[TurnMaintenance] Repair failed:', repairErr);
    }
  }

  if (!result) {
    console.warn('[TurnMaintenance] All attempts failed');
    return null;
  }

  if (!result.narrativeBrief) {
    result.narrativeBrief = composeNarrativeBrief(state, result.storyAuthor, result.director);
  }

  return result;
}

export async function runTurnMaintenance(
  messages: Message[],
  state: SessionAgentState,
  cardType: 'character' | 'world',
  chatConfig?: UserConfig,
  onDiagnostic?: (patch: Partial<StepDiagnostic>) => void,
): Promise<TurnMaintenanceOutput | null> {
  const config = resolveMaintenanceConfig(chatConfig);
  if (!config.enabled) {
    return null;
  }
  if (!config.provider || !config.apiKey || !config.model) {
    console.warn('[TurnMaintenance] No model configured');
    return null;
  }

  const userContent = buildTurnMaintenanceUserContent(messages, state, cardType, config.contextMessages);
  const directorModePrompt = PROMPTS.get(`DIRECTOR_MODE_${config.directorMode.toUpperCase()}`);
  const subTasks: PipelineSubTaskDiagnostic[] = [];

  const emitDiagnostic = (result: TurnMaintenanceOutput | null, error?: string) => {
    onDiagnostic?.({
      providerId: config.provider ?? null,
      model: config.model ?? null,
      temperature: config.temperature ?? null,
      maxTokens: config.maxTokens ?? null,
      timeoutMs: config.timeoutMs ?? null,
      outputChars: result ? JSON.stringify(result).length : 0,
      resultPreview: result?.narrativeBrief ?? '',
      resultFull: result ? JSON.stringify(result, null, 2) : '',
      error: error ?? null,
      subTasks,
    });
  };

  try {
    const [storyAuthorResult, directorResult] = await Promise.all([
      callAgentLLMWithMetadata(PROMPTS.get('STORY_AUTHOR_SYSTEM'), userContent, {
        providerId: config.provider!,
        apiKey: config.apiKey!,
        model: config.model!,
        baseUrl: config.baseUrl,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      }, {
        assistantPrefill: getAgentPrefill('storyAuthor'),
      }),
      callAgentLLMWithMetadata([PROMPTS.get('DIRECTOR_SYSTEM'), directorModePrompt].filter(Boolean).join('\n\n'), userContent, {
        providerId: config.provider!,
        apiKey: config.apiKey!,
        model: config.model!,
        baseUrl: config.baseUrl,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      }, {
        assistantPrefill: getAgentPrefill('director'),
      }),
    ]);
    const storyAuthorRaw = storyAuthorResult.text;
    const directorRaw = directorResult.text;

    subTasks.push({
      id: 'story-author',
      label: 'Story Author',
      status: 'done',
      startedAt: Date.now() - storyAuthorResult.durationMs,
      finishedAt: Date.now(),
      providerId: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      inputChars: userContent.length,
      outputChars: storyAuthorRaw.length,
      inputTokens: storyAuthorResult.inputTokens ?? null,
      outputTokens: storyAuthorResult.outputTokens ?? null,
      result: storyAuthorRaw,
      error: null,
    });
    subTasks.push({
      id: 'director',
      label: 'Director',
      status: 'done',
      startedAt: Date.now() - directorResult.durationMs,
      finishedAt: Date.now(),
      providerId: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      inputChars: userContent.length,
      outputChars: directorRaw.length,
      inputTokens: directorResult.inputTokens ?? null,
      outputTokens: directorResult.outputTokens ?? null,
      result: directorRaw,
      error: null,
    });

    const storyAuthor = parseStoryAuthorJson(storyAuthorRaw);
    const director = parseDirectorJson(directorRaw);

    if (storyAuthor && director) {
      const result = {
        narrativeBrief: composeNarrativeBrief(state, storyAuthor, director),
        correction: {
          shouldCorrect: false,
          reasons: [],
        },
        storyAuthor,
        director,
      };
      emitDiagnostic(result);
      return result;
    }

    console.warn('[TurnMaintenance] Parallel planning parse failed, falling back to combined planner');
  } catch (err) {
    subTasks.push({
      id: 'parallel-planning',
      label: 'Parallel Planning',
      status: 'failed',
      startedAt: Date.now(),
      finishedAt: Date.now(),
      providerId: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      inputChars: userContent.length,
      outputChars: 0,
      inputTokens: null,
      outputTokens: null,
      result: '',
      error: err instanceof Error ? err.message : String(err),
    });
    console.warn('[TurnMaintenance] Parallel planning failed, falling back to combined planner:', err);
  }

  const fallbackResult = await runCombinedTurnMaintenance(userContent, state, config, subTasks);
  emitDiagnostic(fallbackResult, fallbackResult ? undefined : 'Planning returned no usable result');
  return fallbackResult;
}
