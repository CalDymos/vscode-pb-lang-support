export type ParsedProcedureHeaderLine = {
  name: string;
  nameStart: number;
  nameEnd: number;
};

export type ProcedureLineBlock = {
  startLine: number;
  endLine: number;
};

export function parseProcedureHeaderLine(line: string): ParsedProcedureHeaderLine | undefined {
  const match = /^\s*Procedure(?:C|CDLL|DLL)?(?:\s*\.[A-Za-z_][A-Za-z0-9_]*)?\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/i.exec(line);
  if (!match) return undefined;

  const name = match[1];
  const nameStart = line.indexOf(name);
  if (nameStart < 0) return undefined;

  return {
    name,
    nameStart,
    nameEnd: nameStart + name.length,
  };
}

export function extractProcedureNamesFromText(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);
  let insideMacro = false;

  for (const rawLine of lines) {
    const line = rawLine ?? "";
    const trimmed = line.trim();
    if (!trimmed.length) continue;
    if (/^;/i.test(trimmed)) continue;

    if (/^Macro\b/i.test(trimmed)) {
      insideMacro = true;
      continue;
    }

    if (/^EndMacro\b/i.test(trimmed)) {
      insideMacro = false;
      continue;
    }

    if (insideMacro) continue;

    const parsed = parseProcedureHeaderLine(trimmed);
    if (!parsed) continue;

    const name = parsed.name;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  return names;
}


export function findProcedureBlock(lines: readonly string[], line: number): ProcedureLineBlock | undefined {
  let startLine: number | undefined;

  for (let i = line; i >= 0; i--) {
    const currentLine = lines[i] ?? "";
    if (/^\s*EndProcedure\b/i.test(currentLine)) break;
    if (parseProcedureHeaderLine(currentLine)) {
      startLine = i;
      break;
    }
  }

  if (startLine === undefined) return undefined;

  for (let i = line; i < lines.length; i++) {
    const currentLine = lines[i] ?? "";
    if (/^\s*EndProcedure\b/i.test(currentLine)) {
      return { startLine, endLine: i };
    }
  }

  return undefined;
}

export function findProcedureBlockByName(lines: readonly string[], procName: string): ProcedureLineBlock | undefined {
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseProcedureHeaderLine(lines[i] ?? "");
    if (!parsed || parsed.name !== procName) continue;
    return findProcedureBlock(lines, i);
  }

  return undefined;
}

export function findFirstProcedureLine(lines: readonly string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (parseProcedureHeaderLine(lines[i] ?? "")) return i;
  }

  return lines.length;
}
