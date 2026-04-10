/**
 * Lorebook matching — scans messages for keyword/regex matches against lorebook entries.
 * Returns matched entries sorted by priority within the token budget.
 *
 * Features: selective mode, regex matching, scope filtering,
 * recursive scanning, full-word matching.
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
  fullWord: boolean,
): boolean {
  const search = caseSensitive ? text : text.toLowerCase();
  return keywords.some((kw) => {
    const k = caseSensitive ? kw : kw.toLowerCase();
    if (fullWord) {
      // Word boundary matching
      const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flags = caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(`\\b${escaped}\\b`, flags);
      return regex.test(search);
    }
    return search.includes(k);
  });
}

function matchesRegex(text: string, pattern: string, caseSensitive: boolean): boolean {
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(pattern, flags);
    return regex.test(text);
  } catch {
    return false;
  }
}

function entryMatches(
  text: string,
  entry: LorebookEntry,
  fullWord: boolean,
): boolean {
  // Selective mode: require both primary AND secondary keywords
  if (entry.mode === 'selective') {
    const primaryMatch = entry.keywords.length > 0
      && matchesKeywords(text, entry.keywords, entry.caseSensitive, fullWord);
    const secondaryMatch = !!(entry.secondaryKeywords && entry.secondaryKeywords.length > 0
      && matchesKeywords(text, entry.secondaryKeywords, entry.caseSensitive, fullWord));
    return primaryMatch && secondaryMatch;
  }

  // Normal/other modes: keyword OR regex match
  const keywordMatch = entry.keywords.length > 0
    && matchesKeywords(text, entry.keywords, entry.caseSensitive, fullWord);

  if (keywordMatch) return true;

  // Try regex pattern if present
  if (entry.regex) {
    return matchesRegex(text, entry.regex, entry.caseSensitive);
  }

  return false;
}

function isInScope(entry: LorebookEntry, characterId?: string): boolean {
  if (entry.scope === 'global') return true;
  if (entry.scope === 'character') {
    if (!characterId || !entry.characterIds?.length) return false;
    return entry.characterIds.includes(characterId);
  }
  // 'scenario' scope is always included (scenario filtering done at higher level)
  return true;
}

export function matchLorebook(
  messages: Message[],
  entries: LorebookEntry[],
  settings: LorebookSettings,
  characterId?: string,
): LorebookEntry[] {
  const recent = messages.slice(-settings.scanDepth);
  const text = recent.map((m) => m.content).join(' ');

  const matched: LorebookEntry[] = [];
  const matchedIds = new Set<string>();

  function scan(scanText: string): void {
    for (const entry of entries) {
      if (!entry.enabled) continue;
      if (matchedIds.has(entry.id)) continue;
      if (!isInScope(entry, characterId)) continue;

      // Constant entries always match
      if (entry.constant) {
        matchedIds.add(entry.id);
        matched.push(entry);
        continue;
      }

      // Non-constant entries need keywords or regex
      if (entry.keywords.length === 0 && !entry.regex) continue;

      if (entryMatches(scanText, entry, settings.fullWordMatching)) {
        // Apply activationPercent (stochastic activation)
        if (entry.activationPercent !== undefined && entry.activationPercent < 100) {
          if (Math.random() * 100 > entry.activationPercent) continue;
        }
        matchedIds.add(entry.id);
        matched.push(entry);

        // Recursive scanning: scan matched content for more entries
        if (settings.recursiveScanning && entry.content) {
          scan(entry.content);
        }
      }
    }
  }

  scan(text);

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
