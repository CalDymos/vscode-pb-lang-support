# Changelog

## 0.8.0

### Added

- Command **“PureBasic: New Project”** to create new PureBasic projects.
- Setting **`purebasicProjectEditor.newProject.templateFile`** to define a `.pbp` template used when creating new projects.
- Dedicated **icon for `.pbp` PureBasic project files**.

### Changed

- `.pbp` files are now registered as language **`purebasic-project`**.
- Improved Raw XML editor customization options for project files.

### Fixed

- Minor configuration handling issues in the project editor.

### Internal

- Internal refactoring of project editor constants and file-type handling.
- General code cleanup and maintenance.

## 0.7.0

### Changed

- Updated the public extension API to version `3`.
- Simplified exported project context payloads by removing `includeDirs`.
- Simplified cached project metadata to keep only project-related source and include files.
- Adjusted active context payload generation to expose project file lists without include directory data.