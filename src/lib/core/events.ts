/**
 * Typed event emitter for scripting events.
 * Used to subscribe to and emit TriggerEvents across the application.
 */

import type { TriggerEvent } from '$lib/types';

type EventHandler = (event: TriggerEvent, data?: unknown) => void;

export class EventEmitter {
  private handlers = new Map<TriggerEvent, Set<EventHandler>>();

  on(event: TriggerEvent, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: TriggerEvent, handler: EventHandler): void {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: TriggerEvent, data?: unknown): void {
    this.handlers.get(event)?.forEach((handler) => handler(event, data));
  }

  removeAllListeners(event?: TriggerEvent): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }
}
