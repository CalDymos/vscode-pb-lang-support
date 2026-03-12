# PureBasic Project Core

[![pb-project-core](https://img.shields.io/github/v/tag/CalDymos/vscode-pb-lang-suite?sort=semver&filter=core-v*&label=core)](https://github.com/CalDymos/vscode-pb-lang-suite/tags)

**pb-project-core** is a shared TypeScript library for working with PureBasic project files (`.pbp`) without any VS Code dependencies.
It contains the canonical project parsing and resolution logic used by the PureBasic VS Code tooling (pb-project-files / pb-lang-support).

## Features

### Parse `.pbp` project files

- Parse XML-based PureBasic project files
- Read project config, data, file list, libraries, and targets
- Resolve project-relative source/include paths
- Resolve target paths such as input, output, executable, working directory, icon, and linker files
- Preserve relevant metadata for stable roundtrips

### Write `.pbp` project files

- Serialize parsed or edited project models back to XML
- Deterministic output to keep diffs small
- Stable section ordering
- Preserves unknown sections and extra XML where supported by the model
- Output can be parsed again with the built-in parser

### Target selection

- Deterministic target picking
- Supports preferred target names
- Handles enabled/default target selection rules consistently

### Path resolution helpers

- Resolve project-internal source and include files
- Resolve target paths that may be outside the project directory
- Classify resolved paths as `internal` or `external`
- Build canonical compile/run context for a selected target

### Validation

- Validate project structure
- Detect missing targets or empty input files
- Optionally check referenced filesystem paths

## Included API areas

The library currently exposes helpers for:

- `.pbp` parsing
- `.pbp` writing
- project and target data models
- target selection
- path resolution
- build-entry resolution
- validation

## Example

```ts
import {
    parsePbpProjectText,
    pickTarget,
    resolveBuildEntry,
    validatePbpProject,
    writePbpProjectText,
} from '@caldymos/pb-project-core';

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project>
  <section name="config">
    <options closefiles="1" openmode="0" name="Demo"/>
  </section>
  <section name="files">
    <file name="src/main.pb"/>
  </section>
  <section name="targets">
    <target name="default" enabled="1" default="1">
      <inputfile value="src/main.pb"/>
      <outputfile value="bin/demo.exe"/>
    </target>
  </section>
</project>`;

const project = parsePbpProjectText(xml, '/workspace/demo/demo.pbp');
if (!project) {
    throw new Error('Invalid project');
}

const target = pickTarget(project);
if (!target) {
    throw new Error('No target available');
}

const build = resolveBuildEntry(project, target);
const issues = validatePbpProject(project);
const serializedXml = writePbpProjectText(project);
```

## Main exports

### Parsing

- `parsePbpProjectText()`

### Models

- `PbpProject`
- `PbpTarget`
- `PbpFileEntry`
- `PbpConfig`
- `PbpData`

### Target selection

- `pickTarget()`

### Resolution

- `resolveProjectPath()`
- `resolveTargetPath()`
- `classifyProjectPath()`
- `resolveBuildEntry()`
- `getProjectSourceFiles()`
- `getProjectIncludeFiles()`
- `getProjectIncludeDirectories()`

### Validation

- `validatePbpProject()`

### Writing

- `writePbpProjectText()`

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm test
```

The test suite includes parser/writer roundtrip coverage and checks deterministic writer output.

## Related packages

- **PureBasic Language Services**  
  VS Code language services, debugger integration, and build/run tooling for PureBasic.  
  [**View Repo**](https://github.com/CalDymos/vscode-pb-lang-suite/tree/main/packages/pb-lang-support)

- **PureBasic Project Files**  
  VS Code integration for discovering, editing, and managing `.pbp` files.  
  [**View Repo**](https://github.com/CalDymos/vscode-pb-lang-suite/tree/main/packages/pb-project-files)

## License

MIT License

---

**PureBasic** is a registered trademark of Fantaisie Software.  
This library is not affiliated with or endorsed by Fantaisie Software.
