# npm lib: pb-project-core

Shared library for project file management, without VS Code dependencies.

Contains only logic that must always remain the same and be identical everywhere:

Tasks/content:

- ✅ .pbp parser

- ⏳ .pbp writer (TODO: still need to add this)

- ⏳ Target selection rules (default/enabled/preferred)

- ⏳ Path rules (internal/external, relative/absolute)

- ⏳ Validation  
