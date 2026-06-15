export function parseGlobalVarNames(line: string): string[] {
  const match = /^\s*Global\s+(.+?)\s*$/.exec(line);
  if (!match) return [];

  return match[1]
    .split(",")
    .map(part => part.trim())
    .filter(Boolean);
}
