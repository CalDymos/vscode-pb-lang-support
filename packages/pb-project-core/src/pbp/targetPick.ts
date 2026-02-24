/*
 * @caldymos/pb-project-core
 *
 * PureBasic Project (.pbp) target selection.
 */

import type { PbpProject, PbpTarget } from './model';

export interface TargetPickOptions {
    /** Prefer a target by name (case-insensitive). */
    preferredName?: string;
    /** If true, pick disabled targets as a fallback when no enabled targets exist. */
    allowDisabled?: boolean;
}

/**
 * Picks a target using a deterministic rule set.
 *
 * Order:
 *  1) preferredName (enabled)
 *  2) explicit default (enabled)
 *  3) first enabled
 *  4) (optional) preferredName (disabled)
 *  5) (optional) explicit default (disabled)
 *  6) (optional) first target
 */
export function pickTarget(project: PbpProject, options: TargetPickOptions = {}): PbpTarget | null {
    const targets = project.targets ?? [];
    if (targets.length === 0) return null;

    const preferred = (options.preferredName ?? '').trim().toLowerCase();
    if (preferred) {
        const hit = targets.find(t => (t.name ?? '').trim().toLowerCase() === preferred && t.enabled);
        if (hit) return hit;
    }

    const explicitDefault = targets.find(t => t.enabled && t.isDefault);
    if (explicitDefault) return explicitDefault;

    const firstEnabled = targets.find(t => t.enabled);
    if (firstEnabled) return firstEnabled;

    if (!options.allowDisabled) return null;

    if (preferred) {
        const hit = targets.find(t => (t.name ?? '').trim().toLowerCase() === preferred);
        if (hit) return hit;
    }

    const defaultAny = targets.find(t => t.isDefault);
    return defaultAny ?? targets[0] ?? null;
}