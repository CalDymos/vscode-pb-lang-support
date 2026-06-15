/**
 * Diagnostic mapping helpers for PureBasic compiler standby responses.
 *
 * The mapper stays independent from the VS Code API so compiler response
 * handling can be unit-tested without an extension host.
 */

import type {
    CompilerStandbyParseResult,
    CompilerStandbySourceLocation,
    CompilerStandbySyntaxError,
    CompilerStandbyWarning,
} from './compiler-standby-types';

export type CompilerStandbyDiagnosticSeverity = 'error' | 'warning';

export interface CompilerStandbyDiagnosticMappingOptions {
    /** Source file sent to the compiler. This may be a temporary file. */
    sourceFile: string;
    /** Original source file used when SOURCEALIAS is active. */
    sourceAlias?: string;
    /** Project directory used as a fallback for relative compiler paths. */
    projectDir?: string;
}

export interface CompilerStandbyDiagnostic {
    file: string;
    /** Zero-based editor line number. */
    line: number;
    severity: CompilerStandbyDiagnosticSeverity;
    message: string;
    source: string;
    rawLines: string[];
}

const DIAGNOSTIC_SOURCE = 'PureBasic compiler';

/**
 * Converts parsed standby compiler responses into editor diagnostics.
 */
export function buildCompilerStandbyDiagnostics(
    parseResult: CompilerStandbyParseResult,
    opt: CompilerStandbyDiagnosticMappingOptions,
): CompilerStandbyDiagnostic[] {
    const diagnostics: CompilerStandbyDiagnostic[] = [];

    for (const warning of parseResult.warnings) {
        const diagnostic = warningToDiagnostic(warning, opt);
        if (diagnostic) diagnostics.push(diagnostic);
    }

    const terminal = parseResult.terminal;
    if (terminal?.kind === 'syntaxError') {
        const diagnostic = syntaxErrorToDiagnostic(terminal, opt);
        if (diagnostic) diagnostics.push(diagnostic);
    }

    return diagnostics;
}

function warningToDiagnostic(
    warning: CompilerStandbyWarning,
    opt: CompilerStandbyDiagnosticMappingOptions,
): CompilerStandbyDiagnostic | null {
    const file = resolveCompilerLocationFile(warning.location, opt);
    if (!file) return null;

    return {
        file,
        line: toZeroBasedLine(warning.location.line),
        severity: 'warning',
        message: warning.message || 'PureBasic compiler warning.',
        source: DIAGNOSTIC_SOURCE,
        rawLines: warning.rawLines,
    };
}

function syntaxErrorToDiagnostic(
    error: CompilerStandbySyntaxError,
    opt: CompilerStandbyDiagnosticMappingOptions,
): CompilerStandbyDiagnostic | null {
    const location = error.includeLocation ?? { line: error.line } satisfies CompilerStandbySourceLocation;
    const file = resolveCompilerLocationFile(location, opt);
    if (!file) return null;

    return {
        file,
        line: toZeroBasedLine(location.line),
        severity: 'error',
        message: error.message || 'PureBasic compiler syntax error.',
        source: DIAGNOSTIC_SOURCE,
        rawLines: error.rawLines,
    };
}

function resolveCompilerLocationFile(
    location: CompilerStandbySourceLocation,
    opt: CompilerStandbyDiagnosticMappingOptions,
): string {
    const reported = (location.file ?? '').trim();
    if (reported) {
        return resolveReportedFile(reported, opt);
    }

    const sourceAlias = (opt.sourceAlias ?? '').trim();
    if (sourceAlias) {
        return normalizeFilePath(sourceAlias);
    }

    return normalizeFilePath(opt.sourceFile);
}

function resolveReportedFile(reported: string, opt: CompilerStandbyDiagnosticMappingOptions): string {
    if (looksLikeAbsolutePath(reported)) {
        return normalizeFilePath(reported);
    }

    const sourceDir = getDirectoryName(opt.sourceAlias || opt.sourceFile);
    if (sourceDir) {
        return normalizeFilePath(joinPath(sourceDir, reported));
    }

    const projectDir = (opt.projectDir ?? '').trim();
    if (projectDir) {
        return normalizeFilePath(joinPath(projectDir, reported));
    }

    return normalizeFilePath(reported);
}

function toZeroBasedLine(line: number | undefined): number {
    if (typeof line !== 'number' || !Number.isFinite(line) || line <= 0) {
        return 0;
    }
    return line - 1;
}

function normalizeFilePath(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';

    const separator = getPreferredPathSeparator(trimmed);

    if (separator === '\\' && trimmed.startsWith('\\\\')) {
        const rest = trimmed.slice(2).replace(/[\\/]+/g, separator);
        return `\\\\${rest}`;
    }

    if (separator === '/' && trimmed.startsWith('/')) {
        const rest = trimmed.slice(1).replace(/[\\/]+/g, separator);
        return `/${rest}`;
    }

    return trimmed.replace(/[\\/]+/g, separator);
}

function joinPath(baseDir: string, fileName: string): string {
    const separator = getPreferredPathSeparator(baseDir || fileName);
    const base = normalizePathPart(baseDir, separator).replace(/[\\/]+$/, '');
    const file = normalizePathPart(fileName, separator).replace(/^[\\/]+/, '');

    if (!base) return file;
    if (base === '/' || base === '\\') return `${base}${file}`;
    return `${base}${separator}${file}`;
}

function normalizePathPart(value: string, separator: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';

    if (separator === '\\' && trimmed.startsWith('\\\\')) {
        const rest = trimmed.slice(2).replace(/[\\/]+/g, separator);
        return `\\\\${rest}`;
    }

    if (separator === '/' && trimmed.startsWith('/')) {
        const rest = trimmed.slice(1).replace(/[\\/]+/g, separator);
        return `/${rest}`;
    }

    return trimmed.replace(/[\\/]+/g, separator);
}

function getPreferredPathSeparator(value: string): '\\' | '/' {
    const trimmed = value.trim();

    if (/^[A-Za-z]:\\/.test(trimmed) || trimmed.startsWith('\\\\')) {
        return '\\';
    }

    if (/^[A-Za-z]:\//.test(trimmed) || trimmed.startsWith('/')) {
        return '/';
    }

    const firstForwardSlash = trimmed.indexOf('/');
    const firstBackslash = trimmed.indexOf('\\');

    if (firstForwardSlash < 0 && firstBackslash >= 0) return '\\';
    if (firstBackslash < 0 && firstForwardSlash >= 0) return '/';
    if (firstForwardSlash >= 0 && firstBackslash >= 0) {
        return firstBackslash < firstForwardSlash ? '\\' : '/';
    }

    return '/';
}

function getDirectoryName(filePath: string): string {
    const normalized = filePath.replace(/[\\/]+$/, '');
    const slashIndex = Math.max(normalized.lastIndexOf('/'), normalized.lastIndexOf('\\'));

    if (slashIndex > 0) {
        return normalized.slice(0, slashIndex);
    }

    if (slashIndex === 0) {
        return normalized.slice(0, 1);
    }

    return '';
}

function looksLikeAbsolutePath(value: string): boolean {
    return value.startsWith('/') || value.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(value);
}
