import { get } from 'svelte/store';
import { settingsStore } from '$lib/stores/settings';
import { callAgentLLMWithMetadata } from './agent-llm';
import { getAgentPrefill, PROMPTS } from './prompts';
import type { SectionWorldOutput, SessionAgentState } from './types';
import type { UserConfig } from '$lib/types/config';
import { resolveSlotConfig } from '$lib/core/models/slot-resolver';
import type { PipelineSubTaskDiagnostic, StepDiagnostic } from '$lib/types/diagnostics';

function resolveSectionWorldConfig(chatConfig?: Partial<UserConfig>) {
  const settings = get(settingsStore);
  const slot = resolveSlotConfig(settings, ['sectionWorld', 'memory', 'chat'], chatConfig);

  return { provider: slot.provider, apiKey: slot.apiKey, model: slot.model, baseUrl: slot.baseUrl };
}

export function parseSectionWorldJson(content: string): SectionWorldOutput | null {
  if (typeof content !== 'string') return null;
  const match = content.replace(/```(?:json)?\s*\n?/gi, '').replace(/```\s*/g, '').match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.sectionTitle !== 'string' || !parsed.sectionTitle) return null;
    if (typeof parsed.prompt !== 'string' || !parsed.prompt) return null;

    return {
      sectionTitle: parsed.sectionTitle,
      prompt: parsed.prompt,
      activeRules: Array.isArray(parsed.activeRules)
        ? parsed.activeRules.filter((r: unknown) => typeof r === 'string')
        : [],
      scenePressures: Array.isArray(parsed.scenePressures)
        ? parsed.scenePressures.filter((p: unknown) => typeof p === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

export function buildSectionWorldUserContent(state: SessionAgentState): string {
  const parts: string[] = [];

  if (state.lastExtraction) {
    const ext = state.lastExtraction;
    parts.push('=== Current Extraction ===');
    parts.push(`Scene: ${ext.scene.location}`);
    parts.push(`Characters: ${ext.scene.characters.join(', ')}`);
    parts.push(`Atmosphere: ${ext.scene.atmosphere}`);
    if (ext.scene.timeOfDay) parts.push(`Time: ${ext.scene.timeOfDay}`);
    if (ext.events.length > 0) parts.push(`Events: ${ext.events.join('; ')}`);
  }

  if (
    state.narrativeState.currentArc ||
    state.narrativeState.activeTensions.length > 0
  ) {
    parts.push('\n=== Narrative State ===');
    if (state.narrativeState.currentArc)
      parts.push(`Current Arc: ${state.narrativeState.currentArc}`);
    if (state.narrativeState.activeTensions.length > 0)
      parts.push(`Active Tensions: ${state.narrativeState.activeTensions.join('; ')}`);
  }

  const entityList = Object.values(state.entities);
  if (entityList.length > 0) {
    parts.push('\n=== Entities ===');
    for (const ent of entityList) {
      parts.push(`- ${ent.name} (${ent.type}): ${ent.description}`);
    }
  }

  if (state.worldFacts.length > 0) {
    parts.push('\n=== World Facts ===');
    for (const fact of state.worldFacts) {
      parts.push(`- ${fact.content}`);
    }
  }

  return parts.join('\n');
}

export async function runSectionWorld(
  state: SessionAgentState,
  chatConfig: Partial<UserConfig>,
  onDiagnostic?: (patch: Partial<StepDiagnostic>) => void,
): Promise<SectionWorldOutput | null> {
  if (!state.lastExtraction) {
    return null;
  }

  const config = resolveSectionWorldConfig(chatConfig);
  if (!config.provider || !config.apiKey || !config.model) {
    console.warn('[SectionWorld] No model configured');
    return null;
  }

  const systemPrompt = PROMPTS.get('SECTION_WORLD_SYSTEM');
  const userContent = buildSectionWorldUserContent(state);
  const subTasks: PipelineSubTaskDiagnostic[] = [];
  if (!userContent.trim()) {
    return null;
  }

  let rawContent: string;
  try {
    const callResult = await callAgentLLMWithMetadata(systemPrompt, userContent, {
      providerId: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      temperature: 0.5,
      maxTokens: 32000,
    }, {
      assistantPrefill: getAgentPrefill('sectionWorld'),
    });
    rawContent = callResult.text;
    subTasks.push({
      id: 'section-world',
      label: 'Section World',
      status: 'done',
      startedAt: Date.now() - callResult.durationMs,
      finishedAt: Date.now(),
      providerId: config.provider,
      model: config.model,
      temperature: 0.5,
      maxTokens: 32000,
      inputChars: userContent.length,
      outputChars: rawContent.length,
      inputTokens: callResult.inputTokens ?? null,
      outputTokens: callResult.outputTokens ?? null,
      result: rawContent,
      error: null,
    });
  } catch (err) {
    onDiagnostic?.({
      providerId: config.provider ?? null,
      model: config.model ?? null,
      temperature: 0.5,
      maxTokens: 32000,
      resultPreview: '',
      resultFull: '',
      error: err instanceof Error ? err.message : String(err),
      subTasks: [
        {
          id: 'section-world',
          label: 'Section World',
          status: 'failed',
          startedAt: Date.now(),
          finishedAt: Date.now(),
          providerId: config.provider,
          model: config.model,
          temperature: 0.5,
          maxTokens: 32000,
          inputChars: userContent.length,
          outputChars: 0,
          inputTokens: null,
          outputTokens: null,
          result: '',
          error: err instanceof Error ? err.message : String(err),
        },
      ],
    });
    console.warn('[SectionWorld] LLM call failed:', err);
    return null;
  }

  let result = parseSectionWorldJson(rawContent);

  if (!result) {
    console.warn('[SectionWorld] JSON parse failed, attempting repair');
    try {
      const repairedResult = await callAgentLLMWithMetadata(
        'Repair this JSON. Return only valid JSON with keys: sectionTitle, prompt, activeRules, scenePressures.',
        rawContent,
        {
          providerId: config.provider,
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
          temperature: 0.1,
          maxTokens: 8000,
        },
        {
          assistantPrefill: getAgentPrefill('sectionWorld'),
        },
      );
      const repairedContent = repairedResult.text;
      subTasks.push({
        id: 'section-world-repair',
        label: 'Section World Repair',
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
      result = parseSectionWorldJson(repairedContent);
    } catch (repairErr) {
      subTasks.push({
        id: 'section-world-repair',
        label: 'Section World Repair',
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
      console.warn('[SectionWorld] Repair failed:', repairErr);
    }
  }

  if (!result) {
    console.warn('[SectionWorld] All attempts failed');
  }

  onDiagnostic?.({
    providerId: config.provider ?? null,
    model: config.model ?? null,
    temperature: 0.5,
    maxTokens: 32000,
    outputChars: result ? JSON.stringify(result).length : 0,
    resultPreview: result ? `${result.sectionTitle}: ${result.prompt}` : '',
    resultFull: result ? JSON.stringify(result, null, 2) : '',
    error: result ? null : 'Section World returned no usable result',
    subTasks,
  });

  return result;
}
