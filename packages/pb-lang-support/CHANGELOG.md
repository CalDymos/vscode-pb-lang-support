# Changelog

## 0.18.0

### Added

- Added purebasic language support for .pbf text mode used by pb-forms-editor.

## 0.17.2

### Fixed

-Fixed: Error handlers are now registered directly in launch() before proc is returned, closing a potential timing window where spawn errors could be missed.
-Fixed: Debuggee spawn error logging is now sanitized. Absolute paths are no longer logged; only the basename of the path is included.

## 0.17.1

### Fixed

- Debug builds no longer fail with "no executable found" when `compilerArgs` and `output` are both set in `launch.json`

## 0.17.0

### Added

- Added the new setting `purebasic.run.mode` with `spawn` and `terminal` modes for running the active PureBasic target.
- Added host-side settings reading for shared access to build and run configuration.
- Added shared constants for the PureBasic language ID and diagnostic source.

### Changed

- Changed `runActiveTarget` to support two execution strategies:
  - `spawn`: runs the executable as a child process and streams stdout/stderr to the Output channel.
  - `terminal`: runs the executable in the integrated terminal with shell-aware argument quoting.
- Changed host-side configuration access to use a centralized settings reader instead of repeated direct lookups.
- Changed fallback project-context notifications so `projectFiles` are sent in scan-aware object form.
- Changed temporary document creation and host/server registration code to use the shared language ID constant consistently.
- Changed server-side configuration reload handling to refresh the full global settings object before reloading the API function listing.
- Changed fallback launch configuration detection to use the shared settings section constant.
- Changed validator diagnostics to use a shared diagnostic source constant instead of hardcoded string literals.

### Fixed

- Fixed execution of active targets so interactive programs can be started through the integrated terminal when needed.
- Fixed argument handling for terminal-based execution by splitting command lines into argv tokens and re-quoting them for the active shell.
- Fixed compiler setting resolution in build/debug host paths by routing it through the shared host settings reader.
- Fixed several garbled comments and type utility definitions in `src/types/utils/*`.

### Internal

- Refactored host and server settings access into dedicated shared modules.
- Refactored repeated `purebasic` string literals to shared constants.
- Cleaned up cache and generic utility type files for readability and consistency.

## 0.16.3

### Fixed

data-structure-validator.ts
- Add /i flag to all keyword tests (PureBasic is case-insensitive)
- Deduplicate structMatch regex (was evaluated twice per branch)
- Check EnumerationBinary before Enumeration to avoid prefix match

module-validator.ts
- Add /i flag to all keyword tests
- Replace startsWith() with /^Keyword\s/i.test() for consistency

procedure-validator.ts
- Remove redundant stripInlineComment calls; line is already
  comment-stripped by the caller in validator.ts

variable-validator.ts
- Remove outer isInStringLiteral guard (too broad: drops valid lines
  like `x.Type = "str"`); isPositionInString per match is sufficient
- Fix diagnostics parameter type: any[] -> Diagnostic[]

generic-validator.ts
- Remove redundant empty-line and comment guards; validator.ts
  already skips those before dispatching to sub-validators
- Remove unnecessary .trim() calls on already-trimmed line

control-structure-validator.ts
- Pass line (comment-stripped) to splitStatements instead of
  originalLine to stay consistent with all other validators

## 0.16.2

### Fixed

- repair the indentationRules, extend folding (Macro, EndMacro, CompilerIf, CompilerEndIf ...)

## 0.16.1

### Fixed

- show pointer type in outline symbols

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