export const PBP_EDITOR_VIEW_TYPE = 'pbProjectFiles.pbpEditor';

export const DEFAULT_PBP_GLOB = '**/*.pbp';
export const DEFAULT_EXCLUDE_GLOB = '**/{node_modules,.git}/**';

export const WSKEY_ACTIVE_PROJECT = 'pbProjectFiles.activeProjectFile';
export const WSKEY_ACTIVE_TARGET = 'pbProjectFiles.activeTargetName';

// Sentinels
export const NO_PROJECT_SENTINEL = '__NO_PROJECT__'; // the user has explicitly selected "No Project."
export const NEW_PROJECT_SENTINEL = '__NEW_PROJECT__'; // the user has selected "New Project."

export const PB_CODE_EXTENSION = '.pb';
export const PB_INCLUDE_EXTENSION = '.pbi';
export const PB_PROJECT_EXTENSION = '.pbp';
export const PB_FORM_EXTENSION = '.pbf';

export const PB_SOURCE_EXTENSIONS = [PB_CODE_EXTENSION, PB_INCLUDE_EXTENSION] as const;
export const PB_ALL_FILE_EXTENSIONS = [
    PB_CODE_EXTENSION,
    PB_INCLUDE_EXTENSION,
    PB_PROJECT_EXTENSION,
    PB_FORM_EXTENSION
] as const;

export const IMAGE_FILE_EXTENSIONS = ['.bmp', '.png', '.jpg', '.jpeg', '.tga', '.ico'] as const;
export const HTML_FILE_EXTENSIONS = ['.html', '.htm'] as const;
export const TEXT_FILE_EXTENSIONS = ['.txt'] as const;

