export function roomDirection(id: string) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return ['left', 'right', 'up', 'down'][(hash >>> 0) % 4];
}
