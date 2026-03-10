# Changelog

## 0.16.0

### Added

- Added a generated built-in PureBasic function dataset based on the official documentation and integrated it into hover, signature help and completion.
- Added diagnostics for missing `IncludeFile` / `XIncludeFile / IncludeBinary` targets.
- Added diagnostics `IncludeBinary` not in DataSection.
- Added completion support for chained structure member access and `With` blocks.
- Added type completion after `.` for type suffixes, built-in types, structures and interfaces.
- Added a shared document collection utility for cross-file language features.

### Changed

- Improved project context handling to distinguish between all project files and scan-enabled project files.
- Improved include resolution so relative include paths are resolved more reliably against the current document, include paths, workspace root and active project target input directory.
- Updated syntax highlighting rules for more PureBasic language constructs and corrected several token classifications.
- Centralized built-in function lookup so multiple providers use the same source of truth.

### Fixed

- Fixed hover support for module symbols, structure members, macros, prototypes, constants and additional procedure variants such as `ProcedureC`, `ProcedureDLL` and `ProcedureCDLL`.
- Fixed signature help for nested calls and string handling, including more reliable active-parameter detection.
- Fixed parameter parsing in signature help when parameters contain nested parentheses or commas inside expressions.
- Fixed completion so it no longer suggests entries inside string literals.
- Fixed constant completion to insert PureBasic constants with the required `#` prefix.
- Fixed definition, references and rename to work more reliably across include files and associated project files.
- Fixed include parsing for conditional include directives and improved missing-file handling.
- Fixed symbol extraction and document symbol reporting for additional PureBasic constructs.
- Fixed grammar handling for character literals, `$` string suffix variables, `StructureUnion`, `NewMap`, `Threaded`, `Runtime` and several compiler directives.

### Internal

- Refactored shared lexer and symbol utilities to reduce duplicated parsing logic between providers.
- Simplified completion internals by removing duplicated extractor/factory layers in favor of shared utilities.

## 0.15.0

### Added

- Added improved built-in PureBasic function support for hover, signature help and completion through the updated language support package.
- Added diagnostics for missing include files through the updated language support package.
- Added improved completion support for structure member access, `With` blocks and type-related suggestions through the updated language support package.

### Fixed

- Fixed multiple PureBasic language feature issues through the updated language support package, including improvements in hover, signature help, definition, references, rename and syntax highlighting.

## 0.14.0

### Added

- Added include file resolution relative to the active target input file directory to better match PureBasic IDE include path behavior.

### Changed

- Updated the `pb-project-files` integration to API version `3`.
- Simplified project context handling by removing exported `includeDirs` payload usage.
- Adjusted definition search document collection to resolve includes using local `IncludePath` directives together with the active target input file directory.

### Fixed

- Improved cross-file symbol lookup when include files are resolved relative to the project's active target input file.