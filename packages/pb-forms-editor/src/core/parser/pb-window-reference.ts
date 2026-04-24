export type ParsedPbWindowReference = {
  innerRaw: string;
  normalizedInner: string | undefined;
};

export function parsePbWindowReference(raw?: string): ParsedPbWindowReference | undefined {
  if (typeof raw !== "string") return undefined;
  const match = /^WindowID\((.*)\)$/i.exec(raw);
  if (!match) return undefined;

  const innerRaw = match[1] ?? "";
  const normalizedInner = innerRaw.trim() || undefined;
  return {
    innerRaw,
    normalizedInner,
  };
}
