/**
 * Template variable substitution engine.
 *
 * Replaces `{{placeholder}}` tokens in prompt text with runtime values.
 * Longer / more-specific patterns are replaced first to prevent partial
 * overlaps (e.g. `{{char.name}}` before `{{char}}`).
 */

export interface TemplateVariables {
  char: string;
  user: string;
  description: string;
  personality: string;
  scenario: string;
  exampleMessages: string;
  slot: string;
  sceneLocation: string;
  sceneTime: string;
  sceneMood: string;
  variables: Record<string, unknown>;
}

/** Named replacements ordered from longest key to shortest (avoids partial matches). */
function buildReplacements(
  vars: TemplateVariables,
): Array<{ pattern: RegExp; value: string }> {
  return [
    // Dot-notation scene variables (must come before bare counterparts)
    { pattern: /\{\{char\.name\}\}/g, value: vars.char },
    { pattern: /\{\{scene\.location\}\}/g, value: vars.sceneLocation },
    { pattern: /\{\{scene\.time\}\}/g, value: vars.sceneTime },
    { pattern: /\{\{scene\.mood\}\}/g, value: vars.sceneMood },
    { pattern: /\{\{example_messages\}\}/g, value: vars.exampleMessages },

    // Simple variables
    { pattern: /\{\{description\}\}/g, value: vars.description },
    { pattern: /\{\{personality\}\}/g, value: vars.personality },
    { pattern: /\{\{scenario\}\}/g, value: vars.scenario },
    { pattern: /\{\{char\}\}/g, value: vars.char },
    { pattern: /\{\{user\}\}/g, value: vars.user },
    { pattern: /\{\{slot\}\}/g, value: vars.slot },
  ];
}

export function substituteVariables(
  text: string,
  vars: TemplateVariables,
): string {
  let result = text;

  // 1. Named replacements (longest-first)
  for (const { pattern, value } of buildReplacements(vars)) {
    result = result.replace(pattern, value);
  }

  // 2. Dynamic {{var.X}} replacements (supports dotted keys like player.hp)
  result = result.replace(/\{\{var\.([A-Za-z0-9_.]+)\}\}/g, (_match, key: string) => {
    const val = vars.variables[key];
    return val !== undefined ? String(val) : '';
  });

  // 3. Any remaining unknown {{...}} tokens become empty string
  result = result.replace(/\{\{[^}]+\}\}/g, '');

  return result;
}
