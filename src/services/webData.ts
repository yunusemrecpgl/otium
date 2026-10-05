import { externalGet } from './externalSources';
import { normalizeUrl } from '../utils/url';
import { EXTERNAL_RESPONSE_LIMITS } from '../constants/externalSources';
import { readJsonWithLimit } from './boundedResponse';

export function publicJsonEndpoint(input: string): string | null {
  const url = normalizeUrl(input);
  return url?.startsWith('https://') ? url : null;
}

export function resolveJsonDotPath(value: unknown, path: string): unknown {
  const trimmed = path.trim();
  if (!trimmed) return value;
  const parts = trimmed.split('.');
  if (parts.some(part => !/^[a-zA-Z0-9_$-]+$/.test(part) || ['__proto__', 'prototype', 'constructor'].includes(part))) {
    throw new Error('Use a simple dot-path, such as data.price.');
  }
  for (const key of parts) {
    if (value === null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error('JSON path was not found.');
    }
    value = (value as Record<string, unknown>)[key];
  }
  return value;
}

export function previewJsonValue(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value) ?? 'null';
  return text.length > 200 ? `${text.slice(0, 197)}…` : text;
}

export async function fetchPublicJsonResponse(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await externalGet(url, signal, 'error');
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (type && type !== 'application/json' && !type.endsWith('+json')) throw new Error('Endpoint must return JSON.');
  return readJsonWithLimit(response, EXTERNAL_RESPONSE_LIMITS.json, signal);
}

export async function fetchPublicJson(url: string, path: string, signal: AbortSignal): Promise<string> {
  return previewJsonValue(resolveJsonDotPath(await fetchPublicJsonResponse(url, signal), path));
}
