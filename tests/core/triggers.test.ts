import { describe, it, expect } from 'vitest';
import { matchTriggers } from '$lib/core/triggers';
import type { Trigger, TriggerEvent } from '$lib/types';

function makeTrigger(overrides: Partial<Trigger> & { event: TriggerEvent }): Trigger {
  return {
    id: overrides.id || crypto.randomUUID(),
    name: overrides.name || 'test trigger',
    enabled: overrides.enabled ?? true,
    event: overrides.event,
    pattern: overrides.pattern,
    matchOn: overrides.matchOn,
    script: overrides.script || '',
    blockScriptId: overrides.blockScriptId,
  };
}

describe('matchTriggers', () => {
  it('matches trigger by event type', () => {
    const triggers = [
      makeTrigger({ event: 'on_user_message' }),
      makeTrigger({ event: 'on_ai_message' }),
    ];
    const result = matchTriggers(triggers, 'on_user_message', {});
    expect(result).toHaveLength(1);
    expect(result[0].event).toBe('on_user_message');
  });

  it('skips disabled triggers', () => {
    const triggers = [
      makeTrigger({ event: 'on_user_message', enabled: false }),
    ];
    const result = matchTriggers(triggers, 'on_user_message', {});
    expect(result).toHaveLength(0);
  });

  it('matches trigger with pattern against message text', () => {
    const triggers = [
      makeTrigger({ event: 'on_user_message', pattern: '\\[attack.*\\]' }),
    ];
    const result = matchTriggers(triggers, 'on_user_message', { message: '[attack] dragon with sword' });
    expect(result).toHaveLength(1);
  });

  it('does not match when pattern does not match message', () => {
    const triggers = [
      makeTrigger({ event: 'on_user_message', pattern: '\\[attack.*\\]' }),
    ];
    const result = matchTriggers(triggers, 'on_user_message', { message: 'hello there' });
    expect(result).toHaveLength(0);
  });

  it('skips pattern check when no message provided', () => {
    const triggers = [
      makeTrigger({ event: 'on_chat_start', pattern: 'test' }),
    ];
    const result = matchTriggers(triggers, 'on_chat_start', {});
    expect(result).toHaveLength(0);
  });

  it('matches without pattern regardless of message', () => {
    const triggers = [
      makeTrigger({ event: 'on_chat_start' }),
    ];
    const result = matchTriggers(triggers, 'on_chat_start', {});
    expect(result).toHaveLength(1);
  });

  it('filters by matchOn=user_input for user message events', () => {
    const triggers = [
      makeTrigger({ event: 'on_message', pattern: 'test', matchOn: 'user_input' }),
    ];
    const result = matchTriggers(triggers, 'on_message', {
      message: 'this is a test',
      isUserMessage: true,
    });
    expect(result).toHaveLength(1);
  });

  it('excludes matchOn=user_input for AI message events', () => {
    const triggers = [
      makeTrigger({ event: 'on_message', pattern: 'test', matchOn: 'user_input' }),
    ];
    const result = matchTriggers(triggers, 'on_message', {
      message: 'this is a test',
      isUserMessage: false,
    });
    expect(result).toHaveLength(0);
  });

  it('filters by matchOn=ai_output for AI message events', () => {
    const triggers = [
      makeTrigger({ event: 'on_message', pattern: 'dragon', matchOn: 'ai_output' }),
    ];
    const result = matchTriggers(triggers, 'on_message', {
      message: 'the dragon appears',
      isUserMessage: false,
    });
    expect(result).toHaveLength(1);
  });

  it('excludes matchOn=ai_output for user message events', () => {
    const triggers = [
      makeTrigger({ event: 'on_message', pattern: 'dragon', matchOn: 'ai_output' }),
    ];
    const result = matchTriggers(triggers, 'on_message', {
      message: 'the dragon appears',
      isUserMessage: true,
    });
    expect(result).toHaveLength(0);
  });

  it('matchOn=both matches regardless of message source', () => {
    const triggers = [
      makeTrigger({ event: 'on_message', pattern: 'test', matchOn: 'both' }),
    ];

    const userResult = matchTriggers(triggers, 'on_message', {
      message: 'a test message',
      isUserMessage: true,
    });
    expect(userResult).toHaveLength(1);

    const aiResult = matchTriggers(triggers, 'on_message', {
      message: 'a test response',
      isUserMessage: false,
    });
    expect(aiResult).toHaveLength(1);
  });

  it('no matchOn matches regardless of message source', () => {
    const triggers = [
      makeTrigger({ event: 'on_message', pattern: 'test' }),
    ];

    const userResult = matchTriggers(triggers, 'on_message', {
      message: 'a test',
      isUserMessage: true,
    });
    expect(userResult).toHaveLength(1);

    const aiResult = matchTriggers(triggers, 'on_message', {
      message: 'a test',
      isUserMessage: false,
    });
    expect(aiResult).toHaveLength(1);
  });

  it('handles invalid regex patterns gracefully', () => {
    const triggers = [
      makeTrigger({ event: 'on_user_message', pattern: '[invalid' }),
    ];
    const result = matchTriggers(triggers, 'on_user_message', { message: 'hello' });
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty triggers', () => {
    const result = matchTriggers([], 'on_message', {});
    expect(result).toEqual([]);
  });

  it('returns multiple matching triggers', () => {
    const triggers = [
      makeTrigger({ event: 'on_user_message', id: 't1' }),
      makeTrigger({ event: 'on_user_message', id: 't2' }),
      makeTrigger({ event: 'on_ai_message', id: 't3' }),
    ];
    const result = matchTriggers(triggers, 'on_user_message', {});
    expect(result).toHaveLength(2);
  });
});
