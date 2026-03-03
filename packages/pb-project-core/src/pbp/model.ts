/*
 * @caldymos/pb-project-core
 *
 * PureBasic Project (.pbp) data models.
 */

type integer = number;

export interface PbpProject {
    /** Absolute filesystem path to the .pbp file */
    projectFile: string;
    /** Absolute filesystem path to the project directory */
    projectDir: string;

    /** Optional metadata extracted from the root <project ...> element */
    meta?: PbpProjectMeta;

    config: PbpConfig;
    data: PbpData;
    files: PbpFileEntry[];
    /** Project libraries (best-effort; may be empty if not specified in the .pbp) */
    libraries: string[];
    targets: PbpTarget[];
}

export interface PbpProjectMeta {
    /** Attributes from the root <project ...> element (eg. xmlns/version/creator). */
    projectAttrs: Record<string, string>;

    /** Section presence information to keep writer output close to the original file. */
    presentSections?: Record<string, boolean>;
}

export interface PbpConfig {
    closefiles: boolean;
    openmode: integer;
    /** Project name (from <section name="config"><options name="..."/>) */
    name: string;
    /** Project comment (from <section name="config"><comment>...</comment>) */
    comment: string;

    /** Raw attributes from <section name="config"><options .../> to preserve unknown fields. */
    optionsAttrs?: Record<string, string>;

    /** True if the source file contained a <comment> element (even if empty). */
    commentPresent?: boolean;
}

export interface PbpData {
    explorer?: {
        view?: string;
        pattern?: integer;
    };
    log?: {
        show?: boolean;
    };
    lastopen?: {
        date?: string;
        user?: string;
        host?: string;
    };
}

export interface PbpFileEntry {
    /** File name/path as stored in the .pbp (usually relative to the project file) */
    rawPath: string;
    /** Resolved absolute filesystem path */
    fsPath: string;

    /** Optional file flags as stored in the project */
    config?: {
        load?: boolean;
        scan?: boolean;
        panel?: boolean;
        warn?: boolean;
    };

    /** Additional, non-modeled file information preserved for display/editing */
    meta?: {
        /** Raw attributes from the <config .../> element (includes non-boolean fields like sortindex/panelstate). */
        configAttrs?: Record<string, string>;
        /** Raw attributes from the <fingerprint .../> element (eg. md5). */
        fingerprintAttrs?: Record<string, string>;
    };
}

export interface PbpTarget {
    name: string;
    enabled: boolean;
    isDefault: boolean;
    inputFile: PbpTargetValue;
    outputFile: PbpTargetValue;
    executable: PbpTargetValue;
    directory?: string;

    /** Raw attributes from the <target ...> start tag to preserve unknown fields. */
    targetAttrs?: Record<string, string>;

    /** Boolean options extracted from <options .../> (best-effort). */
    options: Record<string, boolean>;
    /** Raw <options .../> attributes as strings (includes non-boolean enumerations/values). */
    optionAttrs?: Record<string, string>;

    /** Compiler version string as stored in <compiler version="..."/> */
    compilerVersion?: string;
    /** Optional additional command line args as stored in the project file (best-effort). */
    commandLine?: string;
    /** Subsystem name as stored in <subsystem value="..."/> */
    subsystem?: string;
    purifier?: {
        enabled: boolean;
        granularity?: string;
    };

    warnings?: {
        custom?: boolean;
        type?: string;
        attrs?: Record<string, string>;
    };

    /** Value from <temporaryexe value="..."/> (eg. "source"). */
    temporaryExe?: string;

    /** From <compilecount enable="..." value="..."/> */
    compileCount?: {
        enabled: boolean;
        value?: integer;
    };

    /** From <buildcount enable="..." value="..."/> */
    buildCount?: {
        enabled: boolean;
        value?: integer;
    };

    format?: Record<string, string>;
    icon?: {
        enabled: boolean;
        rawPath: string;
        fsPath: string;
    };

    versionInfo?: {
        enabled: boolean;
        /** Ordered list of version info fields, eg. field0..field16. */
        fields: Array<{ id: string; value: string }>;
    };

    resources?: {
        /** Ordered list of resource file references from <resources><resource value="..."/>. */
        items: string[];
    };

    watchList?: string;
    constants: Array<{
        enabled: boolean;
        value: string;
    }>;
}

export interface PbpTargetValue {
    rawPath: string;
    fsPath: string;
}

export interface ParsePbpOptions {
    /** If true, compiler ist SpiderBasic */
    isSpiderBasic?: boolean;
}
