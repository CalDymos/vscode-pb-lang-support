/*
 * @caldymos/pb-project-core
 *
 * PureBasic Project (.pbp) validation helpers.
 */

import * as fs from 'fs';

import type { PbpProject, PbpTarget } from './model';
import { pickTarget } from './targetPick';

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
    severity: ValidationSeverity;
    code: string;
    message: string;
    targetName?: string;
    fsPath?: string;
}

export interface ValidateOptions {
    /** Check filesystem existence for referenced files/paths. Default: false */
    checkExists?: boolean;
}

export function validatePbpProject(project: PbpProject, options: ValidateOptions = {}): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const checkExists = options.checkExists === true;

    if (!project.projectFile) {
        issues.push({
            severity: 'warning',
            code: 'PROJECT_FILE_EMPTY',
            message: 'Project file path is empty.',
        });
    }

    if (!project.projectDir) {
        issues.push({
            severity: 'error',
            code: 'PROJECT_DIR_EMPTY',
            message: 'Project directory is empty.',
        });
    }

    if (!project.targets || project.targets.length === 0) {
        issues.push({
            severity: 'error',
            code: 'NO_TARGETS',
            message: 'Project has no targets.',
        });
    } else {
        const enabledCount = project.targets.filter(t => t.enabled).length;
        if (enabledCount === 0) {
            issues.push({
                severity: 'warning',
                code: 'NO_ENABLED_TARGETS',
                message: 'Project has no enabled targets.',
            });
        }

        const picked = pickTarget(project);
        if (!picked) {
            issues.push({
                severity: 'error',
                code: 'NO_PICKABLE_TARGET',
                message: 'No suitable target could be selected.',
            });
        }

        for (const t of project.targets) {
            validateTarget(t, checkExists, issues);
        }
    }

    if (project.files) {
        for (const f of project.files) {
            if (!f.rawPath) {
                issues.push({
                    severity: 'warning',
                    code: 'FILE_RAWPATH_EMPTY',
                    message: 'A file entry has an empty rawPath.',
                    fsPath: f.fsPath,
                });
            }
            if (checkExists && f.fsPath && !existsSafe(f.fsPath)) {
                issues.push({
                    severity: 'warning',
                    code: 'FILE_NOT_FOUND',
                    message: 'Referenced file does not exist.',
                    fsPath: f.fsPath,
                });
            }
        }
    }

    return issues;
}

function validateTarget(target: PbpTarget, checkExists: boolean, issues: ValidationIssue[]): void {
    const targetName = (target.name ?? '').trim();

    if (!targetName) {
        issues.push({
            severity: 'warning',
            code: 'TARGET_NAME_EMPTY',
            message: 'A target has an empty name.',
        });
    }

    const input = target.inputFile?.fsPath ?? '';
    if (!input) {
        issues.push({
            severity: 'error',
            code: 'TARGET_INPUT_EMPTY',
            message: 'Target input file is empty.',
            targetName,
        });
    } else if (checkExists && !existsSafe(input)) {
        issues.push({
            severity: 'error',
            code: 'TARGET_INPUT_NOT_FOUND',
            message: 'Target input file does not exist.',
            targetName,
            fsPath: input,
        });
    }

    const out = target.outputFile?.fsPath ?? '';
    if (checkExists && out && !existsSafe(out)) {
        issues.push({
            severity: 'warning',
            code: 'TARGET_OUTPUT_NOT_FOUND',
            message: 'Target output file does not exist (yet).',
            targetName,
            fsPath: out,
        });
    }
}

function existsSafe(p: string): boolean {
    try {
        return fs.existsSync(p);
    } catch {
        return false;
    }
}
