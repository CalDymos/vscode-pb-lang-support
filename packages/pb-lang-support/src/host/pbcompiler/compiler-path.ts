/**
 * Shared PureBasic compiler path resolution for host-side compiler commands.
 */

import { CompilerLauncher } from '../../debug/compiler/CompilerLauncher';
import { readHostSettings } from '../config/settings';

/**
 * Resolves the PureBasic command-line compiler path from user settings,
 * automatic discovery and finally the PATH-based fallback name.
 */
export async function resolvePbCompilerPath(platform: NodeJS.Platform = process.platform): Promise<string | null> {
    const configured = readHostSettings().build.compiler ?? '';
    if (configured) {
        return configured;
    }

    const found = await CompilerLauncher.findCompiler(platform);
    if (found) {
        return found;
    }

    return 'pbcompiler';
}
