/**
 * Shared utility: collectSearchDocuments
 *
 * Builds the set of TextDocuments that providers (definition, reference,
 * rename) should search.  The set includes:
 *   1. The trigger document itself.
 *   2. All transitively included files (XIncludeFile / IncludeFile),
 *      respecting IncludePath directives and the project's active input-file
 *      directory when a ProjectManager is available.
 *   3. All files listed in the associated .pbp project (via ProjectManager).
 */

import * as path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ProjectManager } from '../managers/project-manager';
import { resolveIncludePath, fsPathToUri, normalizeDirPath } from '../utils/fs-utils';
import { readFileCached } from '../utils/file-cache';
import { getWorkspaceRootForUri } from '../indexer/workspace-index';

/**
 * Collect all documents relevant for a provider operation on `document`.
 *
 * @param document       - The document the user triggered the operation on.
 * @param allDocuments   - All currently open documents (language-server cache).
 * @param projectManager - Optional ProjectManager for .pbp project support.
 * @param maxDepth       - Maximum XIncludeFile recursion depth (default: 3).
 * @param projectScope   - Which project-file set to include (default: 'all').
 *   - `'all'`  → `getAllProjectFilesForDocument`  (all files in the .pbp project)
 *   - `'scan'` → `getProjectFilesForDocument`     (only files flagged for scanning)
 * @returns A Map keyed by document URI containing every document to search.
 */
export function collectSearchDocuments(
    document: TextDocument,
    allDocuments: Map<string, TextDocument>,
    projectManager?: ProjectManager,
    maxDepth = 3,
    projectScope: 'all' | 'scan' = 'all'
): Map<string, TextDocument> {
    const workspaceRoot = getWorkspaceRootForUri(document.uri);
    const result = new Map<string, TextDocument>();
    const visited = new Set<string>();

    const addDoc = (doc: TextDocument): void => {
        if (!result.has(doc.uri)) {
            result.set(doc.uri, doc);
        }
    };

    addDoc(document);

    const rootDocUri = document.uri;
    const queue: Array<{ uri: string; depth: number }> = [
        { uri: rootDocUri, depth: 0 },
    ];

    while (queue.length > 0) {
        const { uri, depth } = queue.shift()!;
        if (visited.has(uri) || depth > maxDepth) {
            continue;
        }
        visited.add(uri);

        const baseDoc = result.get(uri);
        if (!baseDoc) {
            continue;
        }

        const lines = baseDoc.getText().split('\n');

        // Active target's input-file directory for project-relative paths.
        const target = projectManager?.getActiveTarget(uri);
        const inputFileDir = target?.inputFile?.fsPath
            ? path.dirname(target.inputFile.fsPath)
            : undefined;

        // IncludePath search directories, newest first.
        const includeDirs: string[] = [];

        for (const line of lines) {
            // IncludePath directive
            const ip = line.match(/^\s*IncludePath\s+"([^"]+)"/i);
            if (ip) {
                const dir = normalizeDirPath(uri, ip[1]);
                if (!includeDirs.includes(dir)) {
                    includeDirs.unshift(dir);
                }
                continue;
            }

            // XIncludeFile / IncludeFile directives
            const m = line.match(/^\s*(?:X?IncludeFile)\s+"([^"]+)"/i);
            if (!m) {
                continue;
            }

            const fsPath = resolveIncludePath(
                uri,
                m[1],
                includeDirs,
                workspaceRoot,
                inputFileDir
            );
            if (!fsPath) {
                continue;
            }

            const incUri = fsPathToUri(fsPath);
            if (result.has(incUri)) {
                if (!visited.has(incUri)) {
                    queue.push({ uri: incUri, depth: depth + 1 });
                }
                continue;
            }

            const opened = allDocuments.get(incUri);
            if (opened) {
                addDoc(opened);
                queue.push({ uri: incUri, depth: depth + 1 });
                continue;
            }

            const content = readFileCached(fsPath);
            if (content != null) {
                const tempDoc = TextDocument.create(incUri, 'purebasic', 0, content);
                addDoc(tempDoc);
                queue.push({ uri: incUri, depth: depth + 1 });
            }
        }
    }

    // Add files from the associated .pbp project (if available).
    try {
        const getter =
            projectScope === 'scan'
                ? projectManager?.getProjectFilesForDocument?.bind(projectManager)
                : projectManager?.getAllProjectFilesForDocument?.bind(projectManager);

        if (typeof getter === 'function') {
            const projectFiles = getter(rootDocUri);
            if (Array.isArray(projectFiles)) {
                for (const fsPath of projectFiles) {
                    const incUri = fsPathToUri(fsPath);
                    if (result.has(incUri)) {
                        continue;
                    }
                    const content = readFileCached(fsPath);
                    if (content != null) {
                        result.set(
                            incUri,
                            TextDocument.create(incUri, 'purebasic', 0, content)
                        );
                    }
                }
            }
        }
    } catch {
        // Errors during project-file scanning must not abort the operation.
    }

    return result;
}