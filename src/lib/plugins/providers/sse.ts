/**
 * Generic Server-Sent Events (SSE) stream parser.
 * Reads a ReadableStream<Uint8Array> and yields the data payload
 * of each `data:` line as a string.
 */

export async function* parseSSE(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          if (data) yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
