# Changelog

## 0.8.0

### Added

- Fallback language support for .pbf text mode when pb-lang-support is not installed.
- Lightweight fallback grammar providing basic PureBasic-like syntax highlighting.
- Language configuration for fallback mode including comments, brackets, and auto-closing pairs.

### Changed

- .pbf text mode now prefers the purebasic language when pb-lang-support is available.
- Automatic fallback to purebasic-form when the PureBasic language extension is not installed.
- Switching between text and designer mode now closes the opposite tab type to prevent duplicate editors.

### Fixed

- .pbf text mode now works correctly even without the pb-lang-support extension installed.

### Internal

- Updated extension.ts to handle language detection and fallback logic.
- Added fallback language contribution and grammar registration in package.json.
- Added language-configuration.json for editor behavior in fallback mode.
- Added syntaxes/purebasic-form.tmLanguage.json with minimal syntax rules.
