export type DesignerLayoutNumericField = "x" | "y" | "w" | "h" | "min" | "max" | "state";

const TOP_LEVEL_Y_ZERO_TERM_RE = /(?:MenuHeight\(\)|FormWindowTop|ToolBarHeight\(\s*[^)]*\)|StatusBarHeight\(\s*[^)]*\))/gi;
const HEIGHT_REFERENCE_RE = /FormWindowHeight|WindowHeight|GadgetHeight|GetGadgetAttribute/i;
const WIDTH_REFERENCE_RE = /FormWindowWidth|WindowWidth|GadgetWidth|GetGadgetAttribute/i;

function isIntegerLiteral(raw: string | undefined): raw is string {
  return /^-?\d+$/.test((raw ?? "").trim());
}

function parseTrailingExpressionInteger(raw: string): number | undefined {
  const matches = [...raw.matchAll(/-?\d+/g)];
  const last = matches.length ? matches[matches.length - 1]?.[0] : undefined;
  if (!last) return undefined;
  return Number(last);
}

function parseSignedIntegerExpression(raw: string): number | undefined {
  if (!raw) return undefined;

  const expr = raw.replace(/\s+/g, "");
  if (!/^[\d+-]+$/.test(expr)) return undefined;

  let total = 0;
  let index = 0;
  const length = expr.length;

  while (index < length) {
    let sign = 1;
    while (index < length && (expr[index] === "+" || expr[index] === "-")) {
      if (expr[index] === "-") sign *= -1;
      index += 1;
    }

    let numStr = "";
    while (index < length && /\d/.test(expr[index])) {
      numStr += expr[index];
      index += 1;
    }

    if (!numStr) return undefined;
    total += sign * Number(numStr);
  }

  return total;
}

function stripTopLevelYZeroTerms(raw: string): string {
  return raw.replace(TOP_LEVEL_Y_ZERO_TERM_RE, " ").trim();
}

export function parseUnscaledLayoutRaw(raw: string | undefined): number | undefined {
  const trimmed = raw?.trim();
  if (!isIntegerLiteral(trimmed)) return undefined;
  return Number(trimmed);
}

export function parseDesignerLayoutRaw(raw: string | undefined, field: DesignerLayoutNumericField): number | undefined {
  const trimmed = raw?.trim();
  if (!trimmed?.length) return undefined;

  const direct = parseUnscaledLayoutRaw(trimmed);
  if (typeof direct === "number") return direct;

  if (field === "y" || field === "h") {
    const stripped = stripTopLevelYZeroTerms(trimmed);

    const signed = parseSignedIntegerExpression(stripped);
    if (typeof signed === "number") return signed;

    if (HEIGHT_REFERENCE_RE.test(stripped)) {
      return parseTrailingExpressionInteger(stripped);
    }
  }

  if ((field === "x" || field === "w") && WIDTH_REFERENCE_RE.test(trimmed)) {
    return parseTrailingExpressionInteger(trimmed);
  }

  return undefined;
}
