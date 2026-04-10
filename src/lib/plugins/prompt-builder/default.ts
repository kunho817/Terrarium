/**
 * Default prompt builder plugin.
 * Assembles system prompts and message context using card fields and template substitution.
 * Spec reference: Section 3.5 — PromptBuilderPlugin
 */

import type { PromptBuilderPlugin } from '$lib/types/plugin';
import type { CharacterCard, Message, SceneState } from '$lib/types';

function substituteTemplates(text: string, card: CharacterCard, scene: SceneState): string {
  return text
    .replace(/\{\{char\.name\}\}/g, card.name)
    .replace(/\{\{char\}\}/g, card.name)
    .replace(/\{\{user\}\}/g, 'User')
    .replace(/\{\{scene\.location\}\}/g, scene.location || '')
    .replace(/\{\{scene\.time\}\}/g, scene.time || '')
    .replace(/\{\{scene\.mood\}\}/g, scene.mood || '')
    .replace(/\{\{var\.([a-zA-Z0-9_.]+)\}\}/g, (_, key: string) => {
      const value = scene.variables[key];
      return value !== undefined ? String(value) : '';
    });
}

export const defaultPromptBuilder: PromptBuilderPlugin = {
  id: 'default',
  name: 'Default',

  buildSystemPrompt(card: CharacterCard, scene: SceneState): string {
    if (card.systemPrompt) {
      return substituteTemplates(card.systemPrompt, card, scene);
    }

    const parts: string[] = [];
    parts.push(`You are ${card.name}.`);
    if (card.description) parts.push(card.description);
    if (card.personality) parts.push(`Personality: ${card.personality}`);
    if (card.scenario) parts.push(`Scenario: ${card.scenario}`);

    if (scene.location || scene.time || scene.mood) {
      const sceneParts: string[] = [];
      if (scene.location) sceneParts.push(`Current location: ${scene.location}`);
      if (scene.time) sceneParts.push(`Time: ${scene.time}`);
      if (scene.mood) sceneParts.push(`Mood: ${scene.mood}`);
      parts.push(sceneParts.join('. ') + '.');
    }

    return substituteTemplates(parts.join('\n\n'), card, scene);
  },

  buildContext(messages: Message[], scene: SceneState): string {
    const parts: string[] = [];

    if (scene.location || scene.time || scene.mood) {
      parts.push(`[Scene: ${[scene.location, scene.time, scene.mood].filter(Boolean).join(', ')}]`);
    }

    for (const msg of messages) {
      const content = substituteTemplates(msg.content, { name: '' } as CharacterCard, scene);
      switch (msg.type) {
        case 'dialogue': {
          const label = msg.role === 'user' ? 'User' : 'Assistant';
          parts.push(`${label}: ${content}`);
          break;
        }
        case 'narrator':
          parts.push(`*${content}*`);
          break;
        case 'action':
          parts.push(`*${content}*`);
          break;
        case 'system':
          parts.push(`[System: ${content}]`);
          break;
      }
    }

    return parts.join('\n\n');
  },
};
