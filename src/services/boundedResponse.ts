export class ResponseTooLargeError extends Error {
  constructor() {
    super('Response is too large.');
    this.name = 'ResponseTooLargeError';
  }
}

async function consumeResponse(response: Response, maxBytes: number, consume: (chunk: Uint8Array) => void, signal?: AbortSignal): Promise<number> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new RangeError('Invalid response byte limit.');
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new ResponseTooLargeError();
  }
  if (!response.body) { signal?.throwIfAborted(); return 0; }
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancel, { once: true });
  let size = 0, complete = false;
  try {
    while (true) {
      signal?.throwIfAborted();
      const chunk = await reader.read();
      signal?.throwIfAborted();
      if (chunk.done) { complete = true; break; }
      size += chunk.value.byteLength;
      // Count the fetch stream's decoded bytes, regardless of Content-Length.
      if (size > maxBytes) throw new ResponseTooLargeError();
      if (chunk.value.byteLength) consume(chunk.value);
    }
    return size;
  } finally {
    signal?.removeEventListener('abort', cancel);
    if (!complete) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export async function readBytesWithLimit(response: Response, maxBytes: number, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Uint8Array[] = [];
  const size = await consumeResponse(response, maxBytes, chunk => chunks.push(chunk), signal);
  signal?.throwIfAborted();
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function readTextWithLimit(response: Response, maxBytes: number, signal?: AbortSignal, maxCharacters?: number): Promise<string> {
  const decoder = new TextDecoder(), parts: string[] = [];
  let characters = 0;
  const append = (text: string) => {
    characters += text.length;
    if (maxCharacters !== undefined && characters > maxCharacters) throw new ResponseTooLargeError();
    if (text) parts.push(text);
  };
  // Streaming decode preserves multibyte characters crossing chunk boundaries.
  await consumeResponse(response, maxBytes, chunk => append(decoder.decode(chunk, { stream: true })), signal);
  signal?.throwIfAborted();
  append(decoder.decode());
  return parts.join('');
}

export async function readJsonWithLimit(response: Response, maxBytes: number, signal?: AbortSignal, maxCharacters?: number): Promise<unknown> {
  const text = await readTextWithLimit(response, maxBytes, signal, maxCharacters);
  signal?.throwIfAborted();
  try { return JSON.parse(text); }
  catch { throw new Error('Endpoint returned invalid JSON.'); }
}
