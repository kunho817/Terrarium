import { describe, it, expect } from 'vitest';
import { parseSSE } from '$lib/plugins/providers/sse';

function createMockStream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(chunk));
      }
      controller.close();
    },
  });
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const items: T[] = [];
  for await (const item of gen) {
    items.push(item);
  }
  return items;
}

describe('parseSSE', () => {
  it('parses single SSE data event', async () => {
    const stream = createMockStream(['data: {"text":"hello"}\n\n']);
    const result = await collect(parseSSE(stream));
    expect(result).toEqual(['{"text":"hello"}']);
  });

  it('parses multiple SSE events', async () => {
    const stream = createMockStream([
      'data: {"text":"hello"}\n\ndata: {"text":"world"}\n\n',
    ]);
    const result = await collect(parseSSE(stream));
    expect(result).toEqual(['{"text":"hello"}', '{"text":"world"}']);
  });

  it('stops at [DONE]', async () => {
    const stream = createMockStream([
      'data: {"text":"hi"}\n\ndata: [DONE]\n\ndata: {"text":"ignored"}\n\n',
    ]);
    const result = await collect(parseSSE(stream));
    expect(result).toEqual(['{"text":"hi"}']);
  });

  it('handles events split across chunks', async () => {
    const stream = createMockStream([
      'data: {"text":"hel',
      'lo"}\n\ndata: {"text":"world"}\n\n',
    ]);
    const result = await collect(parseSSE(stream));
    expect(result).toEqual(['{"text":"hello"}', '{"text":"world"}']);
  });

  it('ignores non-data lines', async () => {
    const stream = createMockStream([
      'event: message_start\ndata: {"type":"start"}\n\ndata: {"type":"delta"}\n\n',
    ]);
    const result = await collect(parseSSE(stream));
    expect(result).toEqual(['{"type":"start"}', '{"type":"delta"}']);
  });

  it('returns empty for empty stream', async () => {
    const stream = createMockStream([]);
    const result = await collect(parseSSE(stream));
    expect(result).toEqual([]);
  });
});
