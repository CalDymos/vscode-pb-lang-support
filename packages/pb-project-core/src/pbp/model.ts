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
    config: PbpConfig;
    data: PbpData;
    files: PbpFileEntry[];
    /** Project libraries (best-effort; may be empty if not specified in the .pbp) */
    libraries: string[];
    targets: PbpTarget[];
}

export interface PbpConfig {
    closefiles: boolean;
    openmode: integer;
    /** Project name (from <section name="config"><options name="..."/>) */
    name: string;
    /** Project comment (from <section name="config"><comment>...</comment>) */
    comment: string;
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
}

export interface PbpTarget {
    name: string;
    enabled: boolean;
    isDefault: boolean;
    inputFile: PbpTargetValue;
    outputFile: PbpTargetValue;
    executable: PbpTargetValue;
    directory: string;
    options: Record<string, boolean>;
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
    format?: Record<string, string>;
    icon?: {
        enabled: boolean;
        rawPath: string;
        fsPath: string;
    };
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