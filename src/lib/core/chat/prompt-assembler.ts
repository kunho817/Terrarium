/**
 * Prompt assembler — preset-driven prompt assembly system.
 *
 * Takes a PromptPreset (ordered list of typed PromptItems) and an AssemblyContext
 * (card, scene, messages, lorebook matches) and resolves them into a final
 * Message[] + prefill string for the AI provider.
 */

import type { PromptItem, PromptPreset } from '$lib/types/prompt-preset';
import type { Message, CharacterCard, SceneState, LorebookEntry } from '$lib/types';
import type { UserPersona } from '$lib/types/persona';
import { parseExampleMessages, groupLoreByPosition } from './pipeline';
import { substituteVariables, type TemplateVariables } from './template-engine';

export interface AssemblyContext {
  card: CharacterCard;
  scene: SceneState;
  messages: Message[];
  lorebookMatches: LorebookEntry[];
  persona?: UserPersona;
}

function buildTemplateVars(card: CharacterCard, scene: SceneState, slot: string, persona?: UserPersona): TemplateVariables {
  return {
    char: card.name,
    user: persona?.name || 'User',
    description: card.description,
    personality: card.personality,
    scenario: card.scenario,
    exampleMessages: card.exampleMessages,
    slot,
    sceneLocation: scene.location || '',
    sceneTime: scene.time || '',
    sceneMood: scene.mood || '',
    variables: scene.variables || {},
    userPersona: persona?.shortDescription || '',
    userDescription: persona?.detailedSettings || '',
    userExampleDialogue: persona?.exampleDialogue || '',
  };
}

function sysMsg(content: string): Message {
  return { role: 'system', content, type: 'system', timestamp: 0 };
}

/**
 * Build the fallback system prompt when card.systemPrompt is empty.
 * In the preset system, description/personality/scenario have their own items,
 * so the fallback only includes the identity line and scene info.
 */
function buildFallbackSystemPrompt(card: CharacterCard, scene: SceneState, persona?: UserPersona): string {
  const parts: string[] = [];
  parts.push(`You are ${card.name}.`);

  if (scene.location || scene.time || scene.mood) {
    const sceneParts: string[] = [];
    if (scene.location) sceneParts.push(`Current location: ${scene.location}`);
    if (scene.time) sceneParts.push(`Time: ${scene.time}`);
    if (scene.mood) sceneParts.push(`Mood: ${scene.mood}`);
    parts.push(sceneParts.join('. ') + '.');
  }

  return substituteVariables(parts.join('\n\n'), buildTemplateVars(card, scene, '', persona));
}

/**
 * Resolve a single PromptItem into Message(s) or null.
 *
 * Returns null when the item is disabled or its source data is empty.
 * Returns a single Message for most types, an array for exampleMessages/chatHistory.
 */
export function resolveItem(
  item: PromptItem,
  ctx: AssemblyContext,
): Message | Message[] | null {
  if (!item.enabled) return null;

  const { card, scene, messages, lorebookMatches } = ctx;

  switch (item.type) {
    case 'system': {
      const text = card.systemPrompt
        ? substituteVariables(card.systemPrompt, buildTemplateVars(card, scene, '', ctx.persona))
        : buildFallbackSystemPrompt(card, scene, ctx.persona);
      return sysMsg(text);
    }

    case 'description': {
      if (!card.description) return null;
      const raw = resolveSlotContent(item.content, card.description);
      return sysMsg(substituteVariables(raw, buildTemplateVars(card, scene, card.description, ctx.persona)));
    }

    case 'persona': {
      const p = ctx.persona;
      if (!p || (!p.shortDescription && !p.detailedSettings && !p.exampleDialogue)) return null;
      const parts: string[] = [];
      parts.push(`[${p.name}'s Persona]`);
      if (p.shortDescription) parts.push(p.shortDescription);
      if (p.detailedSettings) parts.push(p.detailedSettings);
      if (p.exampleDialogue) {
        parts.push(`<example_dialogue>`);
        parts.push(p.exampleDialogue);
        parts.push(`</example_dialogue>`);
      }
      return sysMsg(parts.join('\n'));
    }

    case 'personality': {
      if (!card.personality) return null;
      const defaultFormat = 'Personality: {{slot}}';
      const raw = resolveSlotContent(item.content || defaultFormat, card.personality);
      return sysMsg(substituteVariables(raw, buildTemplateVars(card, scene, card.personality, ctx.persona)));
    }

    case 'scenario': {
      if (!card.scenario) return null;
      const defaultFormat = 'Scenario: {{slot}}';
      const raw = resolveSlotContent(item.content || defaultFormat, card.scenario);
      return sysMsg(substituteVariables(raw, buildTemplateVars(card, scene, card.scenario, ctx.persona)));
    }

    case 'exampleMessages': {
      if (!card.exampleMessages) return null;
      return parseExampleMessages(card.exampleMessages);
    }

    case 'chatHistory': {
      const result: Message[] = [];
      const depth = card.depthPrompt?.depth ?? 0;
      for (let i = 0; i < messages.length; i++) {
        if (depth > 0 && i === Math.max(0, messages.length - depth) && card.depthPrompt) {
          result.push(sysMsg(card.depthPrompt.prompt));
        }
        result.push(messages[i]);
      }
      return result;
    }

    case 'lorebook': {
      const loreByPos = groupLoreByPosition(lorebookMatches);
      const position = item.lorebookPosition;
      if (!position) return null;
      const group = loreByPos.get(position);
      if (!group) return null;
      if (item.content) {
        const wrapped = item.content.replace(/\{\{slot\}\}/g, group);
        return sysMsg(substituteVariables(wrapped, buildTemplateVars(card, scene, group, ctx.persona)));
      }
      return sysMsg(group);
    }

    case 'authornote':
    case 'postHistoryInstructions': {
      if (!card.postHistoryInstructions) return null;
      return sysMsg(
        substituteVariables(card.postHistoryInstructions, buildTemplateVars(card, scene, '', ctx.persona)),
      );
    }

    case 'depthPrompt': {
      if (!card.depthPrompt?.prompt) return null;
      return sysMsg(
        substituteVariables(card.depthPrompt.prompt, buildTemplateVars(card, scene, '', ctx.persona)),
      );
    }

    case 'jailbreak': {
      if (!item.content) return null;
      return sysMsg(substituteVariables(item.content, buildTemplateVars(card, scene, '', ctx.persona)));
    }

    case 'prefill': {
      // Prefills are extracted separately in assembleWithPreset
      return null;
    }

    case 'plain': {
      if (!item.content) return null;
      return sysMsg(substituteVariables(item.content, buildTemplateVars(card, scene, '', ctx.persona)));
    }

    default:
      return null;
  }
}

/**
 * If innerFormat has a {{slot}} placeholder, substitute the value into it.
 * Otherwise return the value as-is.
 */
function resolveSlotContent(innerFormat: string, value: string): string {
  if (innerFormat.includes('{{slot}}')) {
    return innerFormat.replace(/\{\{slot\}\}/g, value);
  }
  return value;
}

/**
 * Assemble the final prompt using a preset and context.
 *
 * Walks preset.items in order, resolves each item, and collects the results.
 * Extracts the prefill text separately.
 *
 * Returns `{ messages, prefill }` where prefill is a string or null.
 */
export function assembleWithPreset(
  preset: PromptPreset,
  ctx: AssemblyContext,
): { messages: Message[]; prefill: string | null } {
  const messages: Message[] = [];
  let prefill: string | null = null;

  for (const item of preset.items) {
    if (item.type === 'prefill' && item.enabled && item.content) {
      prefill = substituteVariables(
        item.content,
        buildTemplateVars(ctx.card, ctx.scene, '', ctx.persona),
      );
      continue;
    }

    const resolved = resolveItem(item, ctx);
    if (resolved === null) continue;

    if (Array.isArray(resolved)) {
      messages.push(...resolved);
    } else {
      messages.push(resolved);
    }
  }

  return { messages, prefill };
}
