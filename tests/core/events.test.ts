import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '$lib/core/events';
import type { TriggerEvent } from '$lib/types';

describe('EventEmitter', () => {
  it('calls handler when event is emitted', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('on_message', handler);
    emitter.emit('on_message', { message: 'hello' });
    expect(handler).toHaveBeenCalledWith('on_message', { message: 'hello' });
  });

  it('does not call handler for different event', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('on_message', handler);
    emitter.emit('on_chat_start');
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple handlers for same event', () => {
    const emitter = new EventEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    emitter.on('on_message', handler1);
    emitter.on('on_message', handler2);
    emitter.emit('on_message');
    expect(handler1).toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it('unsubscribe returns function removes handler', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    const unsub = emitter.on('on_message', handler);
    unsub();
    emitter.emit('on_message');
    expect(handler).not.toHaveBeenCalled();
  });

  it('off removes specific handler', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('on_message', handler);
    emitter.off('on_message', handler);
    emitter.emit('on_message');
    expect(handler).not.toHaveBeenCalled();
  });

  it('removeAllListeners clears all handlers for an event', () => {
    const emitter = new EventEmitter();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    emitter.on('on_message', handler1);
    emitter.on('on_user_message', handler2);
    emitter.removeAllListeners('on_message');
    emitter.emit('on_message');
    emitter.emit('on_user_message');
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();
  });

  it('removeAllListeners with no arg clears all events', () => {
    const emitter = new EventEmitter();
    const handler = vi.fn();
    emitter.on('on_message', handler);
    emitter.on('on_chat_start', handler);
    emitter.removeAllListeners();
    emitter.emit('on_message');
    emitter.emit('on_chat_start');
    expect(handler).not.toHaveBeenCalled();
  });

  it('emit with no handlers does nothing', () => {
    const emitter = new EventEmitter();
    expect(() => emitter.emit('on_timer')).not.toThrow();
  });
});
