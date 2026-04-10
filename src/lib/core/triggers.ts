/**
 * Trigger engine — matches triggers against events with pattern filtering.
 * Pure functions for testing. Used by ChatEngine to find matching triggers.
 */

import type { Trigger, TriggerEvent, TriggerMatchOn } from '$lib/types';

export interface TriggerEventData {
  message?: string;
  isUserMessage?: boolean;
  characterId?: string;
  variable?: string;
  pattern?: string;
}

export function matchTriggers(
  triggers: Trigger[],
  event: TriggerEvent,
  data: TriggerEventData,
): Trigger[] {
  return triggers.filter((trigger) => {
    if (!trigger.enabled) return false;
    if (trigger.event !== event) return false;

    // matchOn filter — only applies when isUserMessage is defined
    if (trigger.matchOn && data.isUserMessage !== undefined) {
      if (data.isUserMessage && trigger.matchOn === 'ai_output') return false;
      if (!data.isUserMessage && trigger.matchOn === 'user_input') return false;
    }

    // Pattern filter
    if (trigger.pattern) {
      if (!data.message) return false;
      try {
        const regex = new RegExp(trigger.pattern, 'i');
        return regex.test(data.message);
      } catch {
        return false;
      }
    }

    return true;
  });
}
