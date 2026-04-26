/**
 * Prompt assembly pipeline — builds the final Message[] for AI providers.
 * Injects system prompt, lorebook entries, example messages, depth prompt,
 * and post-history instructions at the correct positions.
 */

import type { Message, LorebookEntry, LorebookPosition, CharacterCard } from '$lib/types';
import { buildResponseLengthInstruction } from '$lib/types/chat-settings';

export function groupLoreByPosition(entries: LorebookEntry[]): Map<LorebookPosition, string> {
  const map = new Map<LorebookPosition, string>();
  for (const entry of entries) {
    const existing = map.get(entry.position) || '';
    map.set(entry.position, existing ? existing + '\n\n' + entry.content : entry.content);
  }
  return map;
}

export function parseExampleMessages(raw: string): Message[] {
  if (!raw.trim()) return [];

  const messages: Message[] = [];
  const blocks = raw.split(/<START>/i).filter((b) => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const match = trimmed.match(/^\{\{(user|char)\}\}:\s*(.*)/i);
      if (match) {
        const role = match[1].toLowerCase() === 'user' ? 'user' : 'assistant';
        messages.push({
          role,
          content: match[2],
          type: 'dialogue',
          timestamp: 0,
        });
      }
    }
  }

  return messages;
}

export function assemblePromptMessages(
  systemPrompt: string,
  messages: Message[],
  lorebookMatches: LorebookEntry[],
  card: CharacterCard,
  responseLengthTier?: string,
): Message[] {
  const result: Message[] = [];
  const sys = (content: string): Message => ({ role: 'system', content, type: 'system', timestamp: 0 });

  // 1. System prompt
  result.push(sys(systemPrompt));

  // 2. Lorebook: before_char
  const loreByPos = groupLoreByPosition(lorebookMatches);

  const beforeChar = loreByPos.get('before_char');
  if (beforeChar) result.push(sys(beforeChar));

  // 3. Lorebook: before_scenario
  const beforeScenario = loreByPos.get('before_scenario');
  if (beforeScenario) result.push(sys(beforeScenario));

  // 4. Example messages
  if (card.exampleMessages) {
    const examples = parseExampleMessages(card.exampleMessages);
    result.push(...examples);
  }

  // 5. Lorebook: after_char
  const afterChar = loreByPos.get('after_char');
  if (afterChar) result.push(sys(afterChar));

  // 6. Message history with depth prompt injection
  const depth = card.depthPrompt?.depth ?? 0;
  for (let i = 0; i < messages.length; i++) {
    if (depth > 0 && i === Math.max(0, messages.length - depth) && card.depthPrompt) {
      result.push(sys(card.depthPrompt.prompt));
    }
    result.push(messages[i]);
  }

  // 7. Lorebook: after_messages
  const afterMessages = loreByPos.get('after_messages');
  if (afterMessages) result.push(sys(afterMessages));

  // 8. PostHistoryInstructions
  if (card.postHistoryInstructions) {
    result.push(sys(card.postHistoryInstructions));
  }

  // 9. Lorebook: author_note
  const authorNote = loreByPos.get('author_note');
  if (authorNote) result.push(sys(authorNote));

  if (responseLengthTier) {
    result.push(sys(buildResponseLengthInstruction(responseLengthTier)));
  }

  return result;
}
