import {PB_SOURCE_EXTENSIONS} from './constants'

export function hasAnyExtension(filePath: string, exts: readonly string[]): boolean {
    const lowerPath = filePath.toLowerCase();
    return exts.some(ext => lowerPath.endsWith(ext.toLowerCase()));
}

export function toDialogExtensions(exts: readonly string[]): string[] {
    return exts.map(ext => ext.startsWith('.') ? ext.slice(1) : ext);
}