/**
 * Code formatting provider
 * Provides code formatting functionality for PureBasic
 */

import {
    DocumentFormattingParams,
    DocumentRangeFormattingParams,
    TextEdit,
    Range,
    Position
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

/**
 * Formatting options
 */
export interface FormattingOptions {
    /** Indentation size */
    tabSize: number;
    /** Whether to use spaces instead of tabs */
    insertSpaces: boolean;
    /** Add space after keywords (currently disabled) */
    spaceAfterKeywords: boolean;
    /** Add space around operators (currently disabled) */
    spaceAroundOperators: boolean;
    /** Automatically format procedure bodies (logic not currently implemented) */
    formatProcedureBody: boolean;
}

const DEFAULT_OPTIONS: FormattingOptions = {
    tabSize: 4,
    insertSpaces: true,
    // To avoid breaking pointer syntax, comparison operators, etc., these are off by default; conservative indentation only
    spaceAfterKeywords: false,
    spaceAroundOperators: false,
    formatProcedureBody: true
};

/**
 * Handle document formatting
 */
export function handleDocumentFormatting(
    params: DocumentFormattingParams,
    document: TextDocument
): TextEdit[] {
    const text = document.getText();
    const fullRange = Range.create(
        Position.create(0, 0),
        document.positionAt(text.length)
    );

    const options = mergeOptions(params.options);
    const formattedText = formatPureBasicCode(text, options);

    if (formattedText === text) {
        return [];
    }

    return [TextEdit.replace(fullRange, formattedText)];
}

/**
 * Handle range formatting
 */
export function handleDocumentRangeFormatting(
    params: DocumentRangeFormattingParams,
    document: TextDocument
): TextEdit[] {
    const text = document.getText();
    const range = params.range;

    const options = mergeOptions(params.options);

    // Expand range to full lines
    const expandedRange = expandToFullLines(document, range);
    const expandedText = document.getText(expandedRange);

    // Compute initial indentation context: scan from document start up to line before range start
    const linesBefore = text.split('\n').slice(0, expandedRange.start.line);
    const initialState = computeInitialFormatterState(linesBefore);

    const formattedText = formatPureBasicCode(expandedText, options, initialState);

    if (formattedText === expandedText) {
        return [];
    }

    return [TextEdit.replace(expandedRange, formattedText)];
}

/**
 * Format PureBasic code (indentation only, do not modify inline code)
 */
function formatPureBasicCode(text: string, options: FormattingOptions, initialState?: FormatterState): string {
    const lines = text.split('\n');
    const out: string[] = [];

    // Block-level indentation state
    let indentLevel = initialState?.indentLevel ?? 0;
    let inSelect = initialState?.inSelect ?? false;
    let selectBaseIndent = initialState?.selectBaseIndent ?? 0;
    let caseActive = initialState?.caseActive ?? false;

    const isClosing = (l: string): boolean => /^(EndProcedure|EndModule|EndStructure|EndIf|Next|Wend|Until|ForEver|EndWith|EndDeclareModule|EndInterface|EndEnumeration|EndMacro|EndDataSection|CompilerEndIf|CompilerEndSelect)\b/i.test(l);
    const isOpening = (l: string): boolean => /^(Procedure(?:C|DLL|CDLL)?\b|Module\b|Structure\b|If\b|For\b|ForEach\b|While\b|Repeat\b|With\b|DeclareModule\b|Interface\b|Enumeration(?:Binary)?\b|Macro\b|DataSection\b|CompilerIf\b|CompilerSelect\b)/i.test(l);
    const isEndSelect = (l: string): boolean => /^EndSelect\b/i.test(l);
    const isSelect = (l: string): boolean => /^Select\b/i.test(l);
    const isCase = (l: string): boolean => /^(Case\b|Default\b)/i.test(l);
    const isMiddle = (l: string): boolean => /^(Else\b|ElseIf\b|CompilerElse\b|CompilerElseIf\b)/i.test(l);

    // Determine inline start/end net-zero (after stripping strings and comments)
    const hasInlineNetZero = (code: string): boolean => {
        const contains = (re: RegExp) => re.test(code);
        return (
            (contains(/\bIf\b/i) && contains(/\bEndIf\b/i)) ||
            ((contains(/\bFor\b/i) || contains(/\bForEach\b/i)) && contains(/\bNext\b/i)) ||
            (contains(/\bWhile\b/i) && contains(/\bWend\b/i)) ||
            (contains(/\bRepeat\b/i) && (contains(/\bUntil\b/i) || contains(/\bForEver\b/i))) ||
            (contains(/\bSelect\b/i) && contains(/\bEndSelect\b/i)) ||
            (contains(/\bWith\b/i) && contains(/\bEndWith\b/i)) ||
            (contains(/\bProcedure(?:C|DLL|CDLL)?\b/i) && contains(/\bEndProcedure\b/i)) ||
            (contains(/\bModule\b/i) && contains(/\bEndModule\b/i)) ||
            (contains(/\bDeclareModule\b/i) && contains(/\bEndDeclareModule\b/i)) ||
            (contains(/\bStructure\b/i) && contains(/\bEndStructure\b/i)) ||
            (contains(/\bInterface\b/i) && contains(/\bEndInterface\b/i)) ||
            (contains(/\bEnumeration(?:Binary)?\b/i) && contains(/\bEndEnumeration\b/i)) ||
            (contains(/\bMacro\b/i) && contains(/\bEndMacro\b/i)) ||
            (contains(/\bDataSection\b/i) && contains(/\bEndDataSection\b/i)) ||
            (contains(/\bCompilerIf\b/i) && contains(/\bCompilerEndIf\b/i)) ||
            (contains(/\bCompilerSelect\b/i) && contains(/\bCompilerEndSelect\b/i))
        );
    };

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();
        const code = stripStringsAndComments(raw).trim();

        // Blank line: keep empty
        if (trimmed === '') { out.push(''); continue; }

        // Comment line: output with current indent
        if (trimmed.startsWith(';')) {
            const indent = createIndent(Math.max(0, indentLevel), options);
            out.push(indent + trimmed);
            continue;
        }

        let lineIndent = indentLevel;

        // Single-line If ... : ... : EndIf mode: do not change indent level
        const inlineIf = /^If\b/i.test(code) && /\bEndIf\b/i.test(code);
        const inlineAny = hasInlineNetZero(code);

        // Special handling for EndSelect (render at Select base indent)
        if (!inlineAny && isEndSelect(code)) {
            lineIndent = Math.max(0, indentLevel);
            if (inSelect) {
                lineIndent = Math.max(0, selectBaseIndent);
                indentLevel = selectBaseIndent;
                inSelect = false;
                caseActive = false;
            } else {
                // In illegal case, treat as a normal closing
                lineIndent = Math.max(0, indentLevel - 1);
                indentLevel = lineIndent;
            }
        } else if (!inlineAny && isSelect(code)) {
            // Select line itself uses current indent, then enter select block
            lineIndent = indentLevel;
        } else if (!inlineAny && inSelect && isCase(code)) {
            // Case/Default line: inside Select at +1 level
            lineIndent = selectBaseIndent + 1;
        } else {
            // Closing statements take effect on current line: decrease indent first
            if (!inlineAny && isClosing(code)) {
                lineIndent = Math.max(0, indentLevel - 1);
                indentLevel = lineIndent; // following lines at same level
            }
        }

        // Middle statements (Else/ElseIf): decrease then restore level (net-zero)
        let restoreAfter = false;
        if (!inlineAny && !isSelect(code) && !isEndSelect(code) && isMiddle(code)) {
            lineIndent = Math.max(0, lineIndent - 1);
            indentLevel = lineIndent;
            restoreAfter = true;
        }

        // Only adjust indentation, do not alter inline content (avoid breaking *ptr, <=, <>, etc.)
        const indent = createIndent(Math.max(0, lineIndent), options);
        out.push(indent + trimmed);

        // Post-line processing
        if (inlineAny) {
            // Net-zero on same line: do not change indent state or enter/exit blocks
        } else if (isSelect(code)) {
            // Enter Select block: Case lines expect +1, case content +2
            inSelect = true;
            selectBaseIndent = lineIndent;
            caseActive = false;
            indentLevel = selectBaseIndent + 1; // to align when Case appears
        } else if (!inlineIf && inSelect && isCase(code)) {
            // A specific Case selected: following content enters +2
            caseActive = true;
            indentLevel = selectBaseIndent + 2;
        } else if (!inlineAny && isOpening(code)) {
            indentLevel++;
        }
        if (!inlineAny && restoreAfter) {
            indentLevel++;
        }

        // If inside Select block and haven't seen a Case yet, maintain indentation level expecting next Case
        if (!inlineAny && inSelect && !caseActive && !isEndSelect(code) && !isCase(code) && !isSelect(code)) {
            indentLevel = Math.max(indentLevel, selectBaseIndent + 1);
        }
    }

    return out.join('\n');
}

/**
 * Indentation state (used for range formatting)
 */
interface FormatterState {
    indentLevel: number;
    inSelect: boolean;
    selectBaseIndent: number;
    caseActive: boolean;
}

/**
 * Compute indentation context before a line (initial state for range formatting)
 */
function computeInitialFormatterState(linesBefore: string[]): FormatterState {
    const isClosing = (l: string): boolean => /^(EndProcedure|EndModule|EndStructure|EndIf|Next|Wend|Until|ForEver|EndWith|EndDeclareModule|EndInterface|EndEnumeration|EndMacro|EndDataSection|CompilerEndIf|CompilerEndSelect)\b/i.test(l);
    const isOpening = (l: string): boolean => /^(Procedure(?:C|DLL|CDLL)?\b|Module\b|Structure\b|If\b|For\b|ForEach\b|While\b|Repeat\b|With\b|DeclareModule\b|Interface\b|Enumeration(?:Binary)?\b|Macro\b|DataSection\b|CompilerIf\b|CompilerSelect\b)/i.test(l);
    const isEndSelect = (l: string): boolean => /^EndSelect\b/i.test(l);
    const isSelect = (l: string): boolean => /^Select\b/i.test(l);
    const isCase = (l: string): boolean => /^(Case\b|Default\b)/i.test(l);
    const isMiddle = (l: string): boolean => /^(Else\b|ElseIf\b|CompilerElse\b|CompilerElseIf\b)/i.test(l);

    const hasInlineNetZero = (code: string): boolean => {
        const contains = (re: RegExp) => re.test(code);
        return (
            (contains(/\bIf\b/i) && contains(/\bEndIf\b/i)) ||
            ((contains(/\bFor\b/i) || contains(/\bForEach\b/i)) && contains(/\bNext\b/i)) ||
            (contains(/\bWhile\b/i) && contains(/\bWend\b/i)) ||
            (contains(/\bRepeat\b/i) && (contains(/\bUntil\b/i) || contains(/\bForEver\b/i))) ||
            (contains(/\bSelect\b/i) && contains(/\bEndSelect\b/i)) ||
            (contains(/\bWith\b/i) && contains(/\bEndWith\b/i)) ||
            (contains(/\bProcedure(?:C|DLL|CDLL)?\b/i) && contains(/\bEndProcedure\b/i)) ||
            (contains(/\bModule\b/i) && contains(/\bEndModule\b/i)) ||
            (contains(/\bDeclareModule\b/i) && contains(/\bEndDeclareModule\b/i)) ||
            (contains(/\bStructure\b/i) && contains(/\bEndStructure\b/i)) ||
            (contains(/\bInterface\b/i) && contains(/\bEndInterface\b/i)) ||
            (contains(/\bEnumeration(?:Binary)?\b/i) && contains(/\bEndEnumeration\b/i)) ||
            (contains(/\bMacro\b/i) && contains(/\bEndMacro\b/i)) ||
            (contains(/\bDataSection\b/i) && contains(/\bEndDataSection\b/i)) ||
            (contains(/\bCompilerIf\b/i) && contains(/\bCompilerEndIf\b/i)) ||
            (contains(/\bCompilerSelect\b/i) && contains(/\bCompilerEndSelect\b/i))
        );
    };

    let indentLevel = 0;
    let inSelect = false;
    let selectBaseIndent = 0;
    let caseActive = false;

    for (let i = 0; i < linesBefore.length; i++) {
        const raw = linesBefore[i];
        const trimmed = raw.trim();
        const code = stripStringsAndComments(raw).trim();
        if (trimmed === '' || trimmed.startsWith(';')) continue;

        const inlineAny = hasInlineNetZero(code);

        if (!inlineAny && isEndSelect(code)) {
            if (inSelect) {
                indentLevel = Math.max(0, selectBaseIndent);
                inSelect = false;
                caseActive = false;
            } else {
                indentLevel = Math.max(0, indentLevel - 1);
            }
        } else if (!inlineAny && isSelect(code)) {
            // Enter Select block
            selectBaseIndent = indentLevel;
            inSelect = true;
            caseActive = false;
            indentLevel = selectBaseIndent + 1; // enter Select block
        } else {
            if (!inlineAny && isClosing(code)) {
                indentLevel = Math.max(0, indentLevel - 1);
            }
        }

        // Handle middle statements Else/ElseIf: net-zero, do not change final indentLevel
        if (inlineAny) {
            // do not change state
        } else if (isSelect(code)) {
            // already handled
        } else if (!inlineAny && inSelect && isCase(code)) {
            // a specific Case selected: following content enters +2
            indentLevel = selectBaseIndent + 2;
        } else if (!inlineAny && isOpening(code)) {
            indentLevel++;
        }

        if (!inlineAny && inSelect && !caseActive && !isEndSelect(code) && !isCase(code) && !isSelect(code)) {
            indentLevel = Math.max(indentLevel, selectBaseIndent + 1);
        }
    }

    return { indentLevel, inSelect, selectBaseIndent, caseActive };
}

/**
 * Strip string literals and trailing comments, returning only code tokens
 * for keyword matching.
 *
 * PureBasic string literals are delimited exclusively by double quotes (").
 * Single quotes (') are NOT string delimiters in PureBasic – removing the
 * previous 'inSq' toggle prevents mis-stripping when an apostrophe appears
 * inside a double-quoted string such as  Pos("'", text$).
 * PureBasic escape-strings ( ~"text\n" ) are handled correctly: the leading
 * tilde is emitted as code, then the "…" block is stripped as usual.
 */
function stripStringsAndComments(line: string): string {
    let out = '';
    let inDq = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        // ';' outside a string = line comment → stop
        if (!inDq && ch === ';') {
            break;
        }
        // '"' toggles double-quote string state
        if (ch === '"') {
            inDq = !inDq;
            continue; // quote character itself is not emitted
        }
        // Emit only characters that are outside a string literal
        if (!inDq) {
            out += ch;
        }
    }
    return out;
}

/**
 * Create indent string
 */
function createIndent(level: number, options: FormattingOptions): string {
    const indentChar = options.insertSpaces ? ' ' : '\t';
    const indentSize = options.insertSpaces ? options.tabSize : 1;
    return indentChar.repeat(level * indentSize);
}

/**
 * Expand range to full lines
 */
function expandToFullLines(document: TextDocument, range: Range): Range {
    const startLine = range.start.line;
    const endLine = range.end.line;

    return Range.create(
        Position.create(startLine, 0),
        Position.create(endLine, document.getText(
            Range.create(Position.create(endLine, 0), Position.create(endLine + 1, 0))
        ).length)
    );
}

/**
 * Merge formatting options
 */
function mergeOptions(options: any): FormattingOptions {
    return {
        tabSize: options?.tabSize ?? DEFAULT_OPTIONS.tabSize,
        insertSpaces: options?.insertSpaces ?? DEFAULT_OPTIONS.insertSpaces,
        spaceAfterKeywords: options?.spaceAfterKeywords ?? DEFAULT_OPTIONS.spaceAfterKeywords,
        spaceAroundOperators: options?.spaceAroundOperators ?? DEFAULT_OPTIONS.spaceAroundOperators,
        formatProcedureBody: options?.formatProcedureBody ?? DEFAULT_OPTIONS.formatProcedureBody
    };
}
