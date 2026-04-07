/**
 * Trigger types — event-script bindings.
 * Spec reference: Section 7.2.1 — Trigger (Event-Script Binding)
 */

export type TriggerEvent =
  | 'on_message'
  | 'on_user_message'
  | 'on_ai_message'
  | 'on_chat_start'
  | 'on_chat_end'
  | 'on_character_enter'
  | 'on_character_leave'
  | 'on_scene_change'
  | 'on_variable_change'
  | 'on_timer'
  | 'on_regex_match'
  | 'on_manual';

export type TriggerMatchOn = 'user_input' | 'ai_output' | 'both';

export interface Trigger {
  id: string;
  name: string;
  enabled: boolean;

  event: TriggerEvent;

  pattern?: string;
  matchOn?: TriggerMatchOn;

  script: string;

  blockScriptId?: string;
}
