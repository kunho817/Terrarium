/**
 * Lorebook matching — scans messages for keyword matches against lorebook entries.
 * Returns matched entries sorted by priority within the token budget.
 */

import type { Message, LorebookEntry, LorebookSettings } from '$lib/types';

export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

function matchesKeywords(
  text: string,
  keywords: string[],
  caseSensitive: boolean,
): boolean {
  const search = caseSensitive ? text : text.toLowerCase();
  return keywords.some((kw) => {
    const k = caseSensitive ? kw : kw.toLowerCase();
    return search.includes(k);
  });
}

export function matchLorebook(
  messages: Message[],
  entries: LorebookEntry[],
  settings: LorebookSettings,
): LorebookEntry[] {
  const recent = messages.slice(-settings.scanDepth);
  const text = recent.map((m) => m.content).join(' ');

  const matched: LorebookEntry[] = [];

  for (const entry of entries) {
    if (!entry.enabled) continue;

    // Constant entries always match
    if (entry.constant) {
      matched.push(entry);
      continue;
    }

    // Non-constant entries need keywords
    if (entry.keywords.length === 0) continue;

    if (matchesKeywords(text, entry.keywords, entry.caseSensitive)) {
      // Apply activationPercent (stochastic activation)
      if (entry.activationPercent !== undefined && entry.activationPercent < 100) {
        if (Math.random() * 100 > entry.activationPercent) continue;
      }
      matched.push(entry);
    }
  }

  // Sort by priority (higher first)
  matched.sort((a, b) => b.priority - a.priority);

  // Enforce token budget
  let used = 0;
  const result: LorebookEntry[] = [];
  for (const entry of matched) {
    const cost = entry.tokenLimit ?? estimateTokens(entry.content);
    if (used + cost > settings.tokenBudget) continue;
    used += cost;
    result.push(entry);
  }

  return result;
}
