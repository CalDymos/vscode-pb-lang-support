# Changelog

## 0.8.0

### Added

- Added pb-lang-support as extensionDependencies for .pbf text mode.

### Changed

- .pbf text mode now prefers the purebasic language (pb-lang-support).
- Switching between text and designer mode now closes the opposite tab type to prevent duplicate editors.

### Internal

- Updated extension.ts to handle language detection and fallback logic.
