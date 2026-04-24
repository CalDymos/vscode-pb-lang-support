import type { DesignerOsSkin, WarningPresenceMode, WarningVersionUpgradeMode } from "../../shared/designer-settings";
import type { FormHeaderInfo, FormIssue } from "../model";

export type PreviewPlatform = "windows" | "linux" | "macos";
export type PreviewOsSkin = DesignerOsSkin;

export const PB_FORM_DESIGNER_SUPPORTED_VERSION = "6.30";
export const PB_FORM_DESIGNER_BREAKING_UPGRADE_VERSIONS = [610, 621] as const;
export const MISSING_FORM_DESIGNER_HEADER_ISSUE = "Missing Form Designer header ('; Form Designer for PureBasic - x.xx').";

export function resolvePreviewPlatformFromOsSkin(osSkin: PreviewOsSkin): PreviewPlatform {
  switch (osSkin) {
    case "windows7":
    case "windows8":
      return "windows";
    case "linux":
      return "linux";
    case "macos":
      return "macos";
  }
}

export function applyConfiguredFormVersionWarnings(
  issues: readonly FormIssue[],
  header: FormHeaderInfo | undefined,
  settings: { warningUnrecognizedFile: WarningPresenceMode; warningVersionUpgrade: WarningVersionUpgradeMode; warningVersionDowngrade: WarningPresenceMode }
): FormIssue[] {
  const nextIssues = issues.filter((issue) => {
    if (issue.message !== MISSING_FORM_DESIGNER_HEADER_ISSUE) {
      return true;
    }

    return settings.warningUnrecognizedFile === "always";
  });

  if (!header?.version) {
    return nextIssues;
  }

  const fileVersion = parseDesignerVersion(header.version);
  const supportedVersion = parseDesignerVersion(PB_FORM_DESIGNER_SUPPORTED_VERSION);
  if (fileVersion === undefined || supportedVersion === undefined || fileVersion === supportedVersion) {
    return nextIssues;
  }

  if (fileVersion > supportedVersion) {
    if (settings.warningVersionDowngrade === "always") {
      nextIssues.push({
        severity: "warning",
        message: `Form header version is '${header.version}'. The extension currently targets '${PB_FORM_DESIGNER_SUPPORTED_VERSION}', so loading this file is a downgrade and may not patch correctly.`,
        line: header.line
      });
    }
    return nextIssues;
  }

  if (settings.warningVersionUpgrade === "never") {
    return nextIssues;
  }

  const mayAffectBackwardCompatibility = hasBackwardCompatibilityBreak(fileVersion);
  if (settings.warningVersionUpgrade === "ifBackwardCompatibilityIsAffected" && !mayAffectBackwardCompatibility) {
    return nextIssues;
  }

  nextIssues.push({
    severity: "warning",
    message: mayAffectBackwardCompatibility
      ? `Form header version is '${header.version}'. Upgrading to the extension target '${PB_FORM_DESIGNER_SUPPORTED_VERSION}' may affect backward compatibility.`
      : `Form header version is '${header.version}'. The extension currently targets '${PB_FORM_DESIGNER_SUPPORTED_VERSION}', so loading this file is an upgrade.`,
    line: header.line
  });

  return nextIssues;
}

export function parseDesignerVersion(version: string | undefined): number | undefined {
  const trimmed = version?.trim();
  if (!trimmed?.length) return undefined;
  const parsed = Math.round(Number.parseFloat(trimmed) * 100);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function hasBackwardCompatibilityBreak(fileVersion: number): boolean {
  return PB_FORM_DESIGNER_BREAKING_UPGRADE_VERSIONS.some((breakVersion) => fileVersion < breakVersion);
}

export type GadgetCaptionVariableRuntimeLike = {
  id: string;
  textRaw?: string;
  textVariable?: boolean;
};

export function isAmbiguousEmptyTextLiteral(raw: string | undefined): boolean {
  return (raw?.trim() ?? "") === '""';
}

export function applyGadgetCaptionVariableSessionOverrides<T extends GadgetCaptionVariableRuntimeLike>(
  gadgets: readonly T[],
  overrides: ReadonlyMap<string, boolean>
): string[] {
  const activeIds = new Set<string>();
  const seenIds = new Set<string>();

  for (const gadget of gadgets) {
    seenIds.add(gadget.id);
    const override = overrides.get(gadget.id);
    if (typeof override !== "boolean") {
      continue;
    }

    if (!isAmbiguousEmptyTextLiteral(gadget.textRaw)) {
      continue;
    }

    gadget.textVariable = override;
    activeIds.add(gadget.id);
  }

  const staleIds: string[] = [];
  for (const id of overrides.keys()) {
    if (!activeIds.has(id)) {
      staleIds.push(id);
    }
  }

  return staleIds;
}
