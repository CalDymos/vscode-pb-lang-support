/*
 * @caldymos/pb-project-core
 *
 * PureBasic Project (.pbp) data models.
 */

type integer = number;

type StringMap = Record<string, string>;

type BooleanMap = Record<string, boolean>;

export interface PbpProjectMeta {
    /** Attributes from the root <project ...> node (e.g. xmlns, version, creator). */
    projectAttrs?: StringMap;
    /** Original section order as found in the .pbp. */
    sectionOrder?: string[];
    /** True/false per section name if it was present in the source file. */
    presentSections?: Record<string, boolean>;
    /** Raw XML of sections not modeled by this library (full <section ...>...</section> block). */
    unknownSections?: Record<string, string>;
}

export interface PbpProject {
    /** Absolute filesystem path to the .pbp file */
    projectFile: string;
    /** Absolute filesystem path to the project directory */
    projectDir: string;
    config: PbpConfig;
    data: PbpData;
    files: PbpFileEntry[];
    /** Project libraries (best-effort; may be empty if not specified in the .pbp) */
    libraries: string[];
    targets: PbpTarget[];

    /** Optional metadata used to preserve non-modeled XML sections/attributes on write. */
    meta?: PbpProjectMeta;
}

export interface PbpConfigMeta {
    /** Raw attributes from <options .../> inside the config section. */
    optionsAttrs?: StringMap;
    /** True if a <comment> tag existed in the original file. */
    hasComment?: boolean;
    /** Raw XML nodes inside <section name="config"> which are not modeled. */
    extraXml?: string;
}

export interface PbpConfig {
    closefiles: boolean;
    openmode: integer;
    /** Project name (from <section name="config"><options name="..."/>) */
    name: string;
    /** Project comment (from <section name="config"><comment>...</comment>) */
    comment: string;

    meta?: PbpConfigMeta;
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

    meta?: {
        /** Raw XML nodes inside <section name=\"data\"> which are not modeled. */
        extraXml?: string;
    };
}

export interface PbpFileConfig {
    load?: boolean;
    scan?: boolean;
    panel?: boolean;
    warn?: boolean;

    // Additional flags/values observed in PB 6.x project files.
    lastopen?: boolean;
    sortindex?: integer;
    panelstate?: string;

    /** Raw attributes from <config .../> to preserve additional values. */
    attrs?: StringMap;
}

export interface PbpFileEntryMeta {
    /** Raw XML nodes inside <file> which are not modeled. */
    extraXml?: string;
}

export interface PbpFileEntry {
    /** File name/path as stored in the .pbp (usually relative to the project file) */
    rawPath: string;
    /** Resolved absolute filesystem path (restricted to project root; may be empty if outside). */
    fsPath: string;
    /** Optional file flags as stored in the project */
    config?: PbpFileConfig;
    /** Optional fingerprint information (e.g. md5). */
    fingerprint?: StringMap;

    meta?: PbpFileEntryMeta;
}

export interface PbpTargetMeta {
    /** Raw attributes from the opening <target ...> tag (excluding name/enabled/default when possible). */
    targetAttrs?: StringMap;

    /** True/false per node name if it was present in the source file. */
    presentNodes?: Record<string, boolean>;

    /** Raw XML nodes inside <target> which are not modeled. */
    extraXml?: string;
}

export interface PbpTarget {
    name: string;
    enabled: boolean;
    isDefault: boolean;

    inputFile: PbpTargetValue;
    outputFile: PbpTargetValue;
    /** Executable to run (may be empty if not specified). */
    executable: PbpTargetValue;

    /** Working directory (from <directory value="..."/> or target attribute). */
    directory: string;

    /** Raw attributes from <options .../> inside target. */
    optionsAttrs?: StringMap;
    /** Boolean view of optionsAttrs (best-effort). */
    options: BooleanMap;

    /** Compiler version string as stored in <compiler version="..."/> */
    compilerVersion?: string;

    /** Optional additional command line args as stored in the project file (best-effort). */
    commandLine?: string;

    /** Subsystem name as stored in <subsystem value="..."/> */
    subsystem?: string;

    purifier?: {
        enabled: boolean;
        granularity?: string;
        attrs?: StringMap;
    };

    /** Temporary executable mode (from <temporaryexe value="..."/>). */
    temporaryExe?: string;

    /** Linker options file (from <linker value="..."/>). */
    linker?: PbpTargetValue;

    /** Executable format attributes (from <format .../>). */
    format?: StringMap;

    icon?: {
        enabled: boolean;
        rawPath: string;
        fsPath: string;
        attrs?: StringMap;
    };

    debugger?: {
        custom?: boolean;
        type?: string;
        attrs?: StringMap;
    };

    warnings?: {
        custom?: boolean;
        type?: string;
        attrs?: StringMap;
    };

    compileCount?: {
        enabled: boolean;
        value?: integer;
        attrs?: StringMap;
    };

    buildCount?: {
        enabled: boolean;
        value?: integer;
        attrs?: StringMap;
    };

    exeConstant?: {
        enabled: boolean;
        attrs?: StringMap;
    };

    constants: Array<{
        enabled: boolean;
        value: string;
    }>;

    versionInfo?: {
        enabled: boolean;
        attrs?: StringMap;
        fields: Array<{ id: string; value: string }>;
    };

    resources?: string[];

    watchList?: string;

    meta?: PbpTargetMeta;
}

export interface PbpTargetValue {
    rawPath: string;
    fsPath: string;
}

export interface ParsePbpOptions {
    /** If true, compiler ist SpiderBasic */
    isSpiderBasic?: boolean;
}
