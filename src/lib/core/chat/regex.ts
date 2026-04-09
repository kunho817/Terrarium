/**
 * Regex script executor — applies RegexScript entries at a given pipeline stage.
 */

import type { RegexScript, RegexStage } from '$lib/types';

export function applyRegexScripts(
  text: string,
  scripts: RegexScript[],
  stage: RegexStage,
): string {
  let result = text;
  for (const script of scripts) {
    if (!script.enabled || script.stage !== stage) continue;
    try {
      const flags = script.flag ?? 'g';
      const regex = new RegExp(script.pattern, flags);
      result = result.replace(regex, script.replacement);
    } catch {
      // Skip invalid regex patterns
    }
  }
  return result;
}
