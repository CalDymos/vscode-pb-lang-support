/*
    Webview script for the PureBasic .pbp project editor.

    Runs in the VS Code webview renderer (browser context, NOT Node.js).
    Bundled separately via webviewConfig in webpack.config.js.

    The extension host injects initial state via:
        window.__PBPEDITOR_INITIAL__ = { ... };
    in a small nonce'd bootstrap script before this bundle is loaded.
*/

import type { PbpProject, PbpTarget } from '@caldymos/pb-project-core';

// ---------------------------------------------------------------------------
// VS Code webview API — available at runtime via the webview host.
// ---------------------------------------------------------------------------
declare function acquireVsCodeApi(): {
    postMessage(msg: unknown): void;
    getState(): unknown;
    setState(state: unknown): void;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PbpFileEntry {
    rawPath: string;
    fsPath: string;
    config?: {
        load?: boolean;
        scan?: boolean;
        warn?: boolean;
        panel?: boolean;
        attrs?: Record<string, string>;
    };
}

interface WebviewInitialState {
    uri: string;
    fsPath: string;
    xml: string;
    project: PbpProject | null;
    errorText: string | null;
}

interface EditorState {
    project: PbpProject | null;
    xml: string;
    errorText: string | null;
    dirtyModel: boolean;
    dirtyXml: boolean;
    activeTab: string;
    activeTargetIndex: number;
    activeTargetTab: string;
    activeFileIndex: number;
}

declare global {
    interface Window {
        __PBPEDITOR_INITIAL__: WebviewInitialState;
        _filePickedHandler?: (rawPath: string, fsPath: string) => void;
    }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const vscode = acquireVsCodeApi();
const initial: WebviewInitialState = window.__PBPEDITOR_INITIAL__;

let state: EditorState = {
    project: initial.project,
    xml: initial.xml,
    errorText: initial.errorText,
    dirtyModel: false,
    dirtyXml: false,
    activeTab: 'project',
    activeTargetIndex: 0,
    activeTargetTab: 'compiler',
    activeFileIndex: -1,
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function $(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Element not found: #${id}`);
    return el;
}

function setStatus(text: string): void {
    $('status').textContent = text || '';
}

function setDirtyModel(v: boolean): void {
    state.dirtyModel = v;
    ($('btnSave') as HTMLButtonElement).disabled = !v;
    renderStatus();
}

function setDirtyXml(v: boolean): void {
    state.dirtyXml = v;
    ($('btnSaveXml') as HTMLButtonElement).disabled = !v;
    renderStatus();
}

function renderStatus(): void {
    const parts: string[] = [];
    if (state.dirtyModel) parts.push('Model changed');
    if (state.dirtyXml) parts.push('XML changed');
    if (state.errorText) parts.push('Parse error');
    setStatus(parts.join(' • '));
}

function esc(s: unknown): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function setActiveTab(name: string): void {
    state.activeTab = name;
    for (const btn of document.querySelectorAll<HTMLElement>('.tabs .tabbtn')) {
        btn.classList.toggle('active', (btn as HTMLElement & { dataset: DOMStringMap }).dataset.tab === name);
    }
    for (const p of document.querySelectorAll('.page')) {
        p.classList.toggle('active', p.id === 'page-' + name);
    }
}

function bindTabs(): void {
    for (const btn of document.querySelectorAll<HTMLElement>('.tabs .tabbtn')) {
        btn.addEventListener('click', () => {
            setActiveTab((btn as HTMLElement & { dataset: DOMStringMap }).dataset.tab ?? '');
        });
    }
}

function ensureProject(): boolean {
    return state.project !== null;
}

function updateConfigField(key: string, value: unknown): void {
    if (!ensureProject() || !state.project) return;
    (state.project.config as unknown as Record<string, unknown>)[key] = value;
    setDirtyModel(true);
}

function parseIntSafe(v: unknown): number {
    const n = parseInt(String(v ?? '').trim(), 10);
    return Number.isFinite(n) ? n : 0;
}

function getTargets(): PbpTarget[] {
    if (!state.project) return [];
    return Array.isArray(state.project.targets) ? state.project.targets : [];
}

function getActiveTarget(): PbpTarget | undefined {
    const targets = getTargets();
    const idx = Math.max(0, Math.min(state.activeTargetIndex, targets.length - 1));
    return targets[idx];
}

function ensureTargetOptions(t: PbpTarget): void {
    if (!t.options) t.options = {};
    if (!t.optionsAttrs) t.optionsAttrs = {};
}

function setTargetOptionFlag(t: PbpTarget, key: string, enabled: boolean, opts: { forceZero?: boolean } = {}): void {
    ensureTargetOptions(t);
    (t.options as Record<string, unknown>)[key] = !!enabled;

    const forceZero = opts.forceZero === true;

    if (enabled) {
        (t.optionsAttrs as Record<string, string>)[key] = '1';
    } else {
        if (forceZero) {
            (t.optionsAttrs as Record<string, string>)[key] = '0';
        } else {
            delete (t.optionsAttrs as Record<string, string>)[key];
        }
    }

    // admin/user mutual exclusion
    if (key === 'admin' && enabled) {
        (t.options as Record<string, unknown>)['user'] = false;
        delete (t.optionsAttrs as Record<string, string>)['user'];
    }
    if (key === 'user' && enabled) {
        (t.options as Record<string, unknown>)['admin'] = false;
        delete (t.optionsAttrs as Record<string, string>)['admin'];
    }

    setDirtyModel(true);
}

function setTargetValueTag(t: PbpTarget, tagName: string, raw: string): void {
    if (!t.meta) t.meta = {};
    if (!t.meta.presentNodes) t.meta.presentNodes = {};
    (t.meta.presentNodes as Record<string, boolean>)[tagName] = true;

    if (tagName === 'directory') {
        t.directory = raw;
    } else if (tagName === 'commandline') {
        t.commandLine = raw;
    } else if (tagName === 'temporaryexe') {
        t.temporaryExe = raw;
    }
    setDirtyModel(true);
}

// ---------------------------------------------------------------------------
// Render: Project Options
// ---------------------------------------------------------------------------

function renderProjectOptions(): void {
    const el = $('page-project');
    el.innerHTML = '';

    if (state.errorText) {
        el.innerHTML = `<div class="error"><strong>Parse error:</strong> ${esc(state.errorText)}</div>`;
    }

    if (!ensureProject() || !state.project) {
        el.innerHTML += `<div class="panel">No project model available.</div>`;
        return;
    }

    const cfg = state.project.config as unknown as Record<string, unknown>;

    const infoPanel = document.createElement('fieldset');
    infoPanel.innerHTML = `
      <legend>Project Info</legend>
      <div class="grid2">
        <label>Project File</label>
        <input type="text" value="${esc(initial.fsPath)}" readonly style="opacity:0.65;" />

        <label>Project Name</label>
        <input id="cfgName" type="text" />

        <label>Comments</label>
        <textarea id="cfgComment"></textarea>
      </div>
    `;
    el.appendChild(infoPanel);

    const loadPanel = document.createElement('fieldset');
    loadPanel.style.marginTop = '12px';
    loadPanel.innerHTML = `
      <legend>Loading Options</legend>

      <div style="margin-bottom:6px;">
        <label><input id="cfgCloseFiles" type="checkbox" style="margin-right:6px;">Close all sources when closing the project</label>
      </div>

      <div style="margin-top:10px; margin-bottom:4px;">When opening the project…</div>
      <div id="openModeRadios">
        ${[
            'load all sources that were open last time',
            'load all sources of the project',
            "load only sources marked in 'Project Files'",
            'load only the main file of the default target',
            'load no files',
        ].map((label, i) => `<div><label><input type="radio" name="openmode" value="${i}" style="margin-right:6px;">${label}</label></div>`).join('')}
      </div>
    `;
    el.appendChild(loadPanel);

    ($('cfgName') as HTMLInputElement).value = String(cfg.name ?? '');
    ($('cfgComment') as HTMLTextAreaElement).value = String(cfg.comment ?? '');
    ($('cfgCloseFiles') as HTMLInputElement).checked = !!cfg.closefiles;

    const currentMode = String(cfg.openmode ?? 0);
    for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="openmode"]')) {
        radio.checked = radio.value === currentMode;
        radio.addEventListener('change', (e) => updateConfigField('openmode', parseIntSafe((e.target as HTMLInputElement).value)));
    }

    $('cfgName').addEventListener('input', (e) => updateConfigField('name', (e.target as HTMLInputElement).value));
    $('cfgComment').addEventListener('input', (e) => updateConfigField('comment', (e.target as HTMLTextAreaElement).value));
    $('cfgCloseFiles').addEventListener('change', (e) => updateConfigField('closefiles', (e.target as HTMLInputElement).checked));
}

// ---------------------------------------------------------------------------
// Render: Project Files
// ---------------------------------------------------------------------------

function renderFiles(): void {
    const el = $('page-files');
    el.innerHTML = '';

    if (!ensureProject() || !state.project) {
        el.innerHTML = `<div class="panel">No project model available.</div>`;
        return;
    }

    const files: PbpFileEntry[] = (state.project.files ?? []) as PbpFileEntry[];

    const toolbar = document.createElement('div');
    toolbar.className = 'btnrow';
    toolbar.style.marginBottom = '8px';
    toolbar.innerHTML = `
      <button class="btn" id="fileAdd">Add</button>
      <button class="btn" id="fileRemove">Remove</button>
    `;
    el.appendChild(toolbar);

    const listPanel = document.createElement('div');
    listPanel.className = 'panel';
    listPanel.style.cssText = 'min-height:160px; max-height:320px; overflow-y:auto; padding:4px;';

    const ul = document.createElement('ul');
    ul.id = 'fileList';
    ul.style.cssText = 'list-style:none; margin:0; padding:0;';
    listPanel.appendChild(ul);
    el.appendChild(listPanel);

    const detail = document.createElement('div');
    detail.id = 'fileDetail';
    detail.className = 'panel';
    detail.style.marginTop = '8px';
    el.appendChild(detail);

    function renderList(): void {
        ul.innerHTML = '';

        if (files.length === 0) {
            const li = document.createElement('li');
            li.style.cssText = 'padding:4px 8px; opacity:0.6;';
            li.textContent = 'No files listed.';
            ul.appendChild(li);
            return;
        }

        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            const li = document.createElement('li');
            li.textContent = f.rawPath;
            li.title = f.fsPath || f.rawPath;
            li.dataset.idx = String(i);
            li.style.cssText = 'padding:4px 8px; cursor:pointer; border-radius:3px;';

            if (i === state.activeFileIndex) {
                li.style.background = 'var(--vscode-list-activeSelectionBackground)';
                li.style.color = 'var(--vscode-list-activeSelectionForeground)';
            }

            li.addEventListener('click', () => {
                state.activeFileIndex = i;
                renderList();
                renderDetail();
            });
            ul.appendChild(li);
        }
    }

    function renderDetail(): void {
        detail.innerHTML = '';
        const idx = state.activeFileIndex;

        if (idx < 0 || idx >= files.length) {
            detail.innerHTML = `<span class="muted">Select a file to edit its options.</span>`;
            return;
        }

        const f = files[idx];
        if (!f.config) f.config = {};

        detail.innerHTML = `
        <div style="margin-bottom:10px; font-weight:600; word-break:break-all;">${esc(f.rawPath)}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <label><input type="checkbox" id="fLoad" style="margin-right:6px;">Load file when opening the project</label>
          <label><input type="checkbox" id="fScan" style="margin-right:6px;">Scan file for Autocomplete</label>
          <label><input type="checkbox" id="fWarn" style="margin-right:6px;">Display a warning if file changed</label>
          <label><input type="checkbox" id="fPanel" style="margin-right:6px;">Show file in the Project panel</label>
        </div>
      `;

        ($('fLoad') as HTMLInputElement).checked  = !!f.config.load;
        ($('fScan') as HTMLInputElement).checked  = !!f.config.scan;
        ($('fWarn') as HTMLInputElement).checked  = !!f.config.warn;
        ($('fPanel') as HTMLInputElement).checked = !!f.config.panel;

        function updateFlag(key: string, val: boolean): void {
            if (!f.config) f.config = {};
            if (!f.config.attrs) f.config.attrs = {};
            (f.config as Record<string, unknown>)[key] = val;
            f.config.attrs[key] = val ? '1' : '0';
            setDirtyModel(true);
        }

        $('fLoad').addEventListener('change',  (e) => updateFlag('load',  (e.target as HTMLInputElement).checked));
        $('fScan').addEventListener('change',  (e) => updateFlag('scan',  (e.target as HTMLInputElement).checked));
        $('fWarn').addEventListener('change',  (e) => updateFlag('warn',  (e.target as HTMLInputElement).checked));
        $('fPanel').addEventListener('change', (e) => updateFlag('panel', (e.target as HTMLInputElement).checked));
    }

    $('fileAdd').addEventListener('click', () => {
        vscode.postMessage({ type: 'pickFile' });
    });

    $('fileRemove').addEventListener('click', () => {
        const idx = state.activeFileIndex;
        if (idx < 0 || idx >= files.length) return;
        files.splice(idx, 1);
        state.activeFileIndex = Math.min(idx, files.length - 1);
        if (files.length === 0) state.activeFileIndex = -1;
        setDirtyModel(true);
        renderList();
        renderDetail();
    });

    window._filePickedHandler = (rawPath: string, fsPath: string) => {
        if (!state.project!.files) (state.project as PbpProject).files = [];
        (state.project!.files as PbpFileEntry[]).push({ rawPath, fsPath: fsPath ?? '' });
        state.activeFileIndex = (state.project!.files as PbpFileEntry[]).length - 1;
        setDirtyModel(true);
        renderFiles();
    };

    renderList();
    renderDetail();
}

// ---------------------------------------------------------------------------
// Render: Libraries
// ---------------------------------------------------------------------------

function renderLibraries(): void {
    const el = $('page-libraries');
    el.innerHTML = '';

    if (!ensureProject() || !state.project) {
        el.innerHTML = `<div class="panel">No project model available.</div>`;
        return;
    }

    const libs: string[] = (state.project.libraries ?? []) as string[];

    const panel = document.createElement('div');
    panel.className = 'panel';

    panel.innerHTML = `
      <div class="btnrow" style="margin-bottom:8px;">
        <button class="btn" id="libAdd">Add</button>
      </div>
      <table>
        <thead><tr><th>Library</th><th style="width:80px"></th></tr></thead>
        <tbody id="libRows"></tbody>
      </table>
    `;

    el.appendChild(panel);

    function rebuild(): void {
        const tbody = $('libRows');
        tbody.innerHTML = '';
        for (let i = 0; i < libs.length; i++) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
          <td><input type="text" data-idx="${i}" value="${esc(libs[i])}"></td>
          <td><button class="btn" data-del="${i}">Remove</button></td>`;
            tbody.appendChild(tr);
        }
        if (libs.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="2"><em>No libraries.</em></td>`;
            tbody.appendChild(tr);
        }

        for (const inp of tbody.querySelectorAll<HTMLInputElement>('input[type="text"]')) {
            inp.addEventListener('input', (e) => {
                const idx = parseInt((e.target as HTMLInputElement).dataset.idx ?? '0', 10);
                libs[idx] = (e.target as HTMLInputElement).value;
                setDirtyModel(true);
            });
        }
        for (const btn of tbody.querySelectorAll<HTMLButtonElement>('button[data-del]')) {
            btn.addEventListener('click', (e) => {
                const idx = parseInt((e.target as HTMLButtonElement).dataset.del ?? '0', 10);
                libs.splice(idx, 1);
                setDirtyModel(true);
                rebuild();
            });
        }
    }

    $('libAdd').addEventListener('click', () => {
        libs.push('');
        setDirtyModel(true);
        rebuild();
    });

    rebuild();
}

// ---------------------------------------------------------------------------
// Render: Targets — sub-tab dispatch
// ---------------------------------------------------------------------------

function renderTargetSubTabs(container: HTMLElement, t: PbpTarget): void {
    const subtabs = document.createElement('div');
    subtabs.className = 'subtabs';
    const names = [
        { id: 'compiler', label: 'Compiler Options' },
        { id: 'run', label: 'Compile/Run' },
        { id: 'constants', label: 'Constants' },
        { id: 'version', label: 'Version Info' },
        { id: 'resources', label: 'Resources' },
        { id: 'watch', label: 'Watchlist' },
    ];

    for (const n of names) {
        const b = document.createElement('button');
        b.className = 'tabbtn' + (state.activeTargetTab === n.id ? ' active' : '');
        b.textContent = n.label;
        b.addEventListener('click', () => {
            state.activeTargetTab = n.id;
            renderTargets();
        });
        subtabs.appendChild(b);
    }

    container.appendChild(subtabs);

    const content = document.createElement('div');
    container.appendChild(content);

    if (state.activeTargetTab === 'compiler') {
        renderTargetCompiler(content, t);
    } else if (state.activeTargetTab === 'run') {
        renderTargetRun(content, t);
    } else if (state.activeTargetTab === 'constants') {
        renderTargetConstants(content, t);
    } else if (state.activeTargetTab === 'version') {
        renderTargetVersionInfo(content, t);
    } else if (state.activeTargetTab === 'resources') {
        renderTargetResources(content, t);
    } else if (state.activeTargetTab === 'watch') {
        renderTargetWatchlist(content, t);
    }
}

// ---------------------------------------------------------------------------
// Render: Targets — Compiler Options
// ---------------------------------------------------------------------------

function renderTargetCompiler(container: HTMLElement, t: PbpTarget): void {
    container.innerHTML = `
      <div class="grid2">
        <label>Input source file</label>
        <input id="tInput" type="text" />

        <label>Output executable</label>
        <input id="tOutput" type="text" />

        <label>Use compiler (version)</label>
        <input id="tCompiler" type="text" />

        <label>Executable (run)</label>
        <input id="tExecutable" type="text" />

        <label>Use icon</label>
        <div style="display:flex; gap:10px; align-items:center;">
          <input id="tIconEnable" type="checkbox" />
          <input id="tIconPath" type="text" placeholder="path" />
        </div>

        <label>Linker options file</label>
        <input id="tLinker" type="text" />

        <label>Library subsystem</label>
        <input id="tSubsystem" type="text" />

        <label>Executable format / OS</label>
        <select id="tFmtExe">
          <option value="">(none)</option>
          <option value="default">default</option>
          <option value="console">console</option>
          <option value="dll">dll</option>
        </select>

        <label>Executable format / CPU</label>
        <select id="tFmtCpu">
          <option value="">(none)</option>
          <option value="0">0 - All CPU</option>
          <option value="1">1 - Dynamic CPU</option>
          <option value="2">2 - CPU with MMX</option>
          <option value="3">3 - CPU with 3DNOW</option>
          <option value="4">4 - CPU with SSE</option>
          <option value="5">5 - CPU with SSE2</option>
        </select>
      </div>

      <div style="margin-top:14px;" class="panel">
        <div class="muted" style="margin-bottom:6px;">Compiler option flags (from &lt;options .../&gt;)</div>
        <div class="check-list">
        <label><input id="opt_optimizer"     type="checkbox" /> Optimize generated code</label>
        <label><input id="opt_asm"           type="checkbox" /> Enable inline ASM syntax coloring</label>
        <label><input id="opt_thread"        type="checkbox" /> Create threadsafe executable</label>
        <label><input id="opt_onerror"       type="checkbox" /> Enable OnError lines support</label>
        <label><input id="opt_dpiaware"      type="checkbox" /> Enable DPI aware executable</label>
        <label><input id="opt_xpskin"        type="checkbox" /> Enable modern theme support (XP skin)</label>
        <label><input id="opt_admin"         type="checkbox" /> Request Administrator mode</label>
        <label><input id="opt_user"          type="checkbox" /> Request User mode (no virtualization)</label>
        <label><input id="opt_dllprotection" type="checkbox" /> Enable DLL preloading protection</label>
        <label><input id="opt_shareducrt"    type="checkbox" /> Use shared UCRT</label>
        <label><input id="opt_wayland"       type="checkbox" /> Enable Wayland support</label>
        </div>
      </div>
    `;

    const opts = (t.optionsAttrs ?? {}) as Record<string, string>;
    const flags = (t.options ?? {}) as Record<string, unknown>;

    ($('tInput') as HTMLInputElement).value = t.inputFile?.rawPath ?? '';
    ($('tOutput') as HTMLInputElement).value = t.outputFile?.rawPath ?? '';
    ($('tCompiler') as HTMLInputElement).value = t.compilerVersion ?? '';
    ($('tExecutable') as HTMLInputElement).value = t.executable?.rawPath ?? '';
    ($('tSubsystem') as HTMLInputElement).value = t.subsystem ?? '';
    ($('tLinker') as HTMLInputElement).value = t.linker?.rawPath ?? '';
    ($('tIconEnable') as HTMLInputElement).checked = !!t.icon?.enabled;
    ($('tIconPath') as HTMLInputElement).value = t.icon?.rawPath ?? '';
    ($('tFmtExe') as HTMLSelectElement).value = t.format?.exe ?? '';
    ($('tFmtCpu') as HTMLSelectElement).value = t.format?.cpu ?? '';

    function markNode(node: string): void {
        if (!t.meta) t.meta = {};
        if (!t.meta.presentNodes) t.meta.presentNodes = {};
        (t.meta.presentNodes as Record<string, boolean>)[node] = true;
    }

    $('tInput').addEventListener('input', (e) => { t.inputFile!.rawPath = (e.target as HTMLInputElement).value; setDirtyModel(true); });
    $('tOutput').addEventListener('input', (e) => { t.outputFile!.rawPath = (e.target as HTMLInputElement).value; setDirtyModel(true); });
    $('tCompiler').addEventListener('input', (e) => { t.compilerVersion = (e.target as HTMLInputElement).value; markNode('compiler'); setDirtyModel(true); });
    $('tExecutable').addEventListener('input', (e) => { t.executable!.rawPath = (e.target as HTMLInputElement).value; markNode('executable'); setDirtyModel(true); });
    $('tSubsystem').addEventListener('input', (e) => { t.subsystem = (e.target as HTMLInputElement).value; markNode('subsystem'); setDirtyModel(true); });
    $('tLinker').addEventListener('input', (e) => { t.linker = { rawPath: (e.target as HTMLInputElement).value, fsPath: '' }; markNode('linker'); setDirtyModel(true); });

    $('tIconEnable').addEventListener('change', (e) => {
        if (!t.icon) t.icon = { enabled: false, rawPath: '', fsPath: '' };
        t.icon.enabled = (e.target as HTMLInputElement).checked;
        markNode('icon');
        setDirtyModel(true);
    });
    $('tIconPath').addEventListener('input', (e) => {
        if (!t.icon) t.icon = { enabled: false, rawPath: '', fsPath: '' };
        t.icon.rawPath = (e.target as HTMLInputElement).value;
        markNode('icon');
        setDirtyModel(true);
    });

    $('tFmtExe').addEventListener('change', (e) => { if (!t.format) t.format = {}; t.format.exe = (e.target as HTMLSelectElement).value; markNode('format'); setDirtyModel(true); });
    $('tFmtCpu').addEventListener('change', (e) => { if (!t.format) t.format = {}; t.format.cpu = (e.target as HTMLSelectElement).value; markNode('format'); setDirtyModel(true); });

    ensureTargetOptions(t);
    ($('opt_optimizer') as HTMLInputElement).checked = opts.optimizer === '1' || flags.optimizer === true;
    ($('opt_asm') as HTMLInputElement).checked = opts.asm === '1' || flags.asm === true;
    ($('opt_thread') as HTMLInputElement).checked = opts.thread === '1' || flags.thread === true;
    ($('opt_onerror') as HTMLInputElement).checked = opts.onerror === '1' || flags.onerror === true;
    ($('opt_dpiaware') as HTMLInputElement).checked = opts.dpiaware === '1' || flags.dpiaware === true;
    ($('opt_xpskin') as HTMLInputElement).checked = opts.xpskin === '1' || flags.xpskin === true;
    ($('opt_admin') as HTMLInputElement).checked = opts.admin === '1' || flags.admin === true;
    ($('opt_user') as HTMLInputElement).checked = opts.user === '1' || flags.user === true;
    ($('opt_dllprotection') as HTMLInputElement).checked = opts.dllprotection === '1' || flags.dllprotection === true;
    ($('opt_shareducrt') as HTMLInputElement).checked = opts.shareducrt === '1' || flags.shareducrt === true;
    ($('opt_wayland') as HTMLInputElement).checked = opts.wayland === '1' || flags.wayland === true;

    $('opt_optimizer').addEventListener('change', (e) => setTargetOptionFlag(t, 'optimizer', (e.target as HTMLInputElement).checked, { forceZero: true }));
    $('opt_asm').addEventListener('change', (e) => setTargetOptionFlag(t, 'asm', (e.target as HTMLInputElement).checked));
    $('opt_thread').addEventListener('change', (e) => setTargetOptionFlag(t, 'thread', (e.target as HTMLInputElement).checked));
    $('opt_onerror').addEventListener('change', (e) => setTargetOptionFlag(t, 'onerror', (e.target as HTMLInputElement).checked));
    $('opt_dpiaware').addEventListener('change', (e) => setTargetOptionFlag(t, 'dpiaware', (e.target as HTMLInputElement).checked));
    $('opt_xpskin').addEventListener('change', (e) => setTargetOptionFlag(t, 'xpskin', (e.target as HTMLInputElement).checked));
    $('opt_admin').addEventListener('change', (e) => setTargetOptionFlag(t, 'admin', (e.target as HTMLInputElement).checked));
    $('opt_user').addEventListener('change', (e) => setTargetOptionFlag(t, 'user', (e.target as HTMLInputElement).checked));
    $('opt_dllprotection').addEventListener('change', (e) => setTargetOptionFlag(t, 'dllprotection', (e.target as HTMLInputElement).checked));
    $('opt_shareducrt').addEventListener('change', (e) => setTargetOptionFlag(t, 'shareducrt', (e.target as HTMLInputElement).checked));
    $('opt_wayland').addEventListener('change', (e) => setTargetOptionFlag(t, 'wayland', (e.target as HTMLInputElement).checked));
}

// ---------------------------------------------------------------------------
// Render: Targets — Compile/Run
// ---------------------------------------------------------------------------

function renderTargetRun(container: HTMLElement, t: PbpTarget): void {
    container.innerHTML = `
      <div class="grid2">
        <label>Enable Debugger</label>
        <input id="run_debug" type="checkbox" />

        <label>Enable Purifier</label>
        <div style="display:flex; gap:10px; align-items:center;">
          <input id="run_purifier" type="checkbox" />
          <input id="run_granularity" type="text" placeholder="granularity" />
        </div>

        <label>Use selected Debugger</label>
        <div style="display:flex; gap:10px; align-items:center;">
          <input id="run_dbg_custom" type="checkbox" />
          <input id="run_dbg_type" type="text" placeholder="type" />
        </div>

        <label>Use Warning mode</label>
        <div style="display:flex; gap:10px; align-items:center;">
          <input id="run_warn_custom" type="checkbox" />
          <input id="run_warn_type" type="text" placeholder="type" />
        </div>

        <label>Executable Commandline</label>
        <input id="run_cmd" type="text" />

        <label>Current directory</label>
        <input id="run_dir" type="text" />

        <label>Create temporary executable in source directory</label>
        <input id="run_temp" type="text" placeholder="source" />

      </div>
    `;

    function markNode(node: string): void {
        if (!t.meta) t.meta = {};
        if (!t.meta.presentNodes) t.meta.presentNodes = {};
        (t.meta.presentNodes as Record<string, boolean>)[node] = true;
    }

    ensureTargetOptions(t);
    const opts = (t.optionsAttrs ?? {}) as Record<string, string>;
    const flags = (t.options ?? {}) as Record<string, unknown>;

    ($('run_debug') as HTMLInputElement).checked = opts.debug === '1' || flags.debug === true;
    $('run_debug').addEventListener('change', (e) => setTargetOptionFlag(t, 'debug', (e.target as HTMLInputElement).checked));

    ($('run_purifier') as HTMLInputElement).checked = !!t.purifier?.enabled;
    ($('run_granularity') as HTMLInputElement).value = t.purifier?.granularity ?? '';

    $('run_purifier').addEventListener('change', (e) => {
        if (!t.purifier) t.purifier = { enabled: false };
        t.purifier.enabled = (e.target as HTMLInputElement).checked;
        markNode('purifier');
        setDirtyModel(true);
    });
    $('run_granularity').addEventListener('input', (e) => {
        if (!t.purifier) t.purifier = { enabled: false };
        t.purifier.granularity = (e.target as HTMLInputElement).value;
        markNode('purifier');
        setDirtyModel(true);
    });

    ($('run_dbg_custom') as HTMLInputElement).checked = !!t.debugger?.custom;
    ($('run_dbg_type') as HTMLInputElement).value = t.debugger?.type ?? '';
    $('run_dbg_custom').addEventListener('change', (e) => {
        if (!t.debugger) t.debugger = {};
        t.debugger.custom = (e.target as HTMLInputElement).checked;
        markNode('debugger');
        setDirtyModel(true);
    });
    $('run_dbg_type').addEventListener('input', (e) => {
        if (!t.debugger) t.debugger = {};
        t.debugger.type = (e.target as HTMLInputElement).value;
        markNode('debugger');
        setDirtyModel(true);
    });

    ($('run_warn_custom') as HTMLInputElement).checked = !!t.warnings?.custom;
    ($('run_warn_type') as HTMLInputElement).value = t.warnings?.type ?? '';
    $('run_warn_custom').addEventListener('change', (e) => {
        if (!t.warnings) t.warnings = {};
        t.warnings.custom = (e.target as HTMLInputElement).checked;
        markNode('warnings');
        setDirtyModel(true);
    });
    $('run_warn_type').addEventListener('input', (e) => {
        if (!t.warnings) t.warnings = {};
        t.warnings.type = (e.target as HTMLInputElement).value;
        markNode('warnings');
        setDirtyModel(true);
    });

    ($('run_cmd') as HTMLInputElement).value = t.commandLine ?? '';
    $('run_cmd').addEventListener('input', (e) => { setTargetValueTag(t, 'commandline', (e.target as HTMLInputElement).value); });

    ($('run_dir') as HTMLInputElement).value = t.directory ?? '';
    $('run_dir').addEventListener('input', (e) => { setTargetValueTag(t, 'directory', (e.target as HTMLInputElement).value); });

    ($('run_temp') as HTMLInputElement).value = t.temporaryExe ?? '';
    $('run_temp').addEventListener('input', (e) => { setTargetValueTag(t, 'temporaryexe', (e.target as HTMLInputElement).value); });

}

// ---------------------------------------------------------------------------
// Render: Targets — Constants
// ---------------------------------------------------------------------------

function renderTargetConstants(container: HTMLElement, t: PbpTarget): void {
    if (!t.constants) t.constants = [];

    container.innerHTML = `
      <fieldset style="margin-bottom:12px;">
        <legend>Editor constants:</legend>
        <div class="grid2" style="grid-template-columns: auto 1fr;">
          <label style="display:flex; align-items:center; gap:6px;">
            <input type="checkbox" id="ec_cc_enable">
            #PB_Editor_CompileCount:
          </label>
          <input id="ec_cc_value" type="number" step="1" style="width:80px;" />

          <label style="display:flex; align-items:center; gap:6px;">
            <input type="checkbox" id="ec_bc_enable">
            #PB_Editor_BuildCount:
          </label>
          <input id="ec_bc_value" type="number" step="1" style="width:80px;" />

          <label style="display:flex; align-items:center; gap:6px; grid-column: 1 / -1;">
            <input type="checkbox" id="ec_exe_enable">
            #PB_Editor_CreateExecutable
          </label>
        </div>
      </fieldset>
      <div class="muted" style="margin-bottom:6px;">Custom constants:</div>
      <div class="btnrow" style="margin-bottom:8px;">
        <button class="btn" id="constAdd">Add</button>
      </div>
      <table>
        <thead><tr><th>Enabled</th><th>Value</th><th style="width:80px"></th></tr></thead>
        <tbody id="constRows"></tbody>
      </table>
    `;

    // --- Editor constants ---
    function markEditorConst(node: string): void {
        if (!t.meta) t.meta = {};
        if (!t.meta.presentNodes) t.meta.presentNodes = {};
        (t.meta.presentNodes as Record<string, boolean>)[node] = true;
    }

    ($('ec_cc_enable') as HTMLInputElement).checked = !!t.compileCount?.enabled;
    ($('ec_cc_value') as HTMLInputElement).value = String(t.compileCount?.value ?? 0);
    $('ec_cc_enable').addEventListener('change', (e) => {
        if (!t.compileCount) t.compileCount = { enabled: false };
        t.compileCount.enabled = (e.target as HTMLInputElement).checked;
        markEditorConst('compilecount');
        setDirtyModel(true);
    });
    $('ec_cc_value').addEventListener('input', (e) => {
        if (!t.compileCount) t.compileCount = { enabled: false };
        t.compileCount.value = parseIntSafe((e.target as HTMLInputElement).value);
        markEditorConst('compilecount');
        setDirtyModel(true);
    });

    ($('ec_bc_enable') as HTMLInputElement).checked = !!t.buildCount?.enabled;
    ($('ec_bc_value') as HTMLInputElement).value = String(t.buildCount?.value ?? 0);
    $('ec_bc_enable').addEventListener('change', (e) => {
        if (!t.buildCount) t.buildCount = { enabled: false };
        t.buildCount.enabled = (e.target as HTMLInputElement).checked;
        markEditorConst('buildcount');
        setDirtyModel(true);
    });
    $('ec_bc_value').addEventListener('input', (e) => {
        if (!t.buildCount) t.buildCount = { enabled: false };
        t.buildCount.value = parseIntSafe((e.target as HTMLInputElement).value);
        markEditorConst('buildcount');
        setDirtyModel(true);
    });

    ($('ec_exe_enable') as HTMLInputElement).checked = !!t.exeConstant?.enabled;
    $('ec_exe_enable').addEventListener('change', (e) => {
        if (!t.exeConstant) t.exeConstant = { enabled: false };
        t.exeConstant.enabled = (e.target as HTMLInputElement).checked;
        markEditorConst('execonstant');
        setDirtyModel(true);
    });

    function markNode(): void {
        if (!t.meta) t.meta = {};
        if (!t.meta.presentNodes) t.meta.presentNodes = {};
        (t.meta.presentNodes as Record<string, boolean>).constants = true;
    }

    function rebuild(): void {
        const tbody = $('constRows');
        tbody.innerHTML = '';
        for (let i = 0; i < t.constants!.length; i++) {
            const c = t.constants![i];
            const tr = document.createElement('tr');
            tr.innerHTML = `
          <td><input type="checkbox" data-idx="${i}" data-k="en" ${c.enabled ? 'checked' : ''}></td>
          <td><input type="text" data-idx="${i}" data-k="val" value="${esc(c.value)}"></td>
          <td><button class="btn" data-del="${i}">Remove</button></td>
        `;
            tbody.appendChild(tr);
        }
        if (t.constants!.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="3"><em>No constants.</em></td>`;
            tbody.appendChild(tr);
        }

        for (const inp of tbody.querySelectorAll<HTMLInputElement>('input')) {
            inp.addEventListener('change', (e) => {
                const idx = parseInt((e.target as HTMLInputElement).dataset.idx ?? '0', 10);
                const k = (e.target as HTMLInputElement).dataset.k;
                if (k === 'en') t.constants![idx].enabled = (e.target as HTMLInputElement).checked;
                if (k === 'val') t.constants![idx].value = (e.target as HTMLInputElement).value;
                markNode();
                setDirtyModel(true);
            });
            inp.addEventListener('input', (e) => {
                if ((e.target as HTMLInputElement).dataset.k !== 'val') return;
                const idx = parseInt((e.target as HTMLInputElement).dataset.idx ?? '0', 10);
                t.constants![idx].value = (e.target as HTMLInputElement).value;
                markNode();
                setDirtyModel(true);
            });
        }

        for (const btn of tbody.querySelectorAll<HTMLButtonElement>('button[data-del]')) {
            btn.addEventListener('click', (e) => {
                const idx = parseInt((e.target as HTMLButtonElement).dataset.del ?? '0', 10);
                t.constants!.splice(idx, 1);
                markNode();
                setDirtyModel(true);
                rebuild();
            });
        }
    }

    $('constAdd').addEventListener('click', () => {
        t.constants!.push({ enabled: true, value: '' });
        if (!t.meta) t.meta = {};
        if (!t.meta.presentNodes) t.meta.presentNodes = {};
        (t.meta.presentNodes as Record<string, boolean>).constants = true;
        setDirtyModel(true);
        rebuild();
    });

    rebuild();
}

// ---------------------------------------------------------------------------
// Render: Targets — Version Info
// ---------------------------------------------------------------------------

interface VersionField {
    id: string;
    label: string;
    type: 'text' | 'version' | 'select';
    options?: string[];
}

function renderTargetVersionInfo(container: HTMLElement, t: PbpTarget): void {
    if (!t.versionInfo) t.versionInfo = { enabled: false, fields: [] };
    if (!t.versionInfo.fields) t.versionInfo.fields = [];

    const FIXED_FIELDS: VersionField[] = [
        { id: 'field0',  label: 'File Version (n,n,n,n) *',    type: 'version' },
        { id: 'field1',  label: 'Product Version (n,n,n,n) *', type: 'version' },
        { id: 'field2',  label: 'Company Name *',               type: 'text' },
        { id: 'field3',  label: 'Product Name *',               type: 'text' },
        { id: 'field4',  label: 'Product Version *',            type: 'text' },
        { id: 'field5',  label: 'File Version *',               type: 'text' },
        { id: 'field6',  label: 'File Description *',           type: 'text' },
        { id: 'field7',  label: 'Internal Name *',              type: 'text' },
        { id: 'field8',  label: 'Original FileName *',          type: 'text' },
        { id: 'field9',  label: 'Legal Copyright',              type: 'text' },
        { id: 'field10', label: 'Legal Trademarks',             type: 'text' },
        { id: 'field11', label: 'Private Build',                type: 'text' },
        { id: 'field12', label: 'Special Build',                type: 'text' },
        { id: 'field13', label: 'Email',                        type: 'text' },
        { id: 'field14', label: 'Website',                      type: 'text' },
        { id: 'field15', label: 'File OS',                      type: 'select',
            options: [ 'VOS_UNKNOWN', 'VOS_DOS_WINDOWS32', 'VOS_NT_WINDOWS32', 'VOS_NT'] },
        { id: 'field16', label: 'File Type',                    type: 'select',
            options: [ 'VFT_UNKNOWN', 'VFT_APP', 'VFT_DLL', 'VFT_DRV', 'VFT_FONT', 'VFT_VXD', 'VFT_STATIC_LIB'] },
        { id: 'field17', label: 'Language',                     type: 'select',
            options: ['0000 Language Neutral',
                '007f Invariant locale',
                '0400 Process Or User Default Language',
                '0800 System Default Language',
                '0436 Afrikaans',
                '041c Albanian',
                '0401 Arabic (Saudi Arabia)',
                '0801 Arabic (Iraq)',
                '0c01 Arabic (Egypt)',
                '1001 Arabic (Libya)',
                '1401 Arabic (Algeria)',
                '1801 Arabic (Morocco)',
                '1c01 Arabic (Tunisia)',
                '2001 Arabic (Oman)',
                '2401 Arabic (Yemen)',
                '2801 Arabic (Syria)',
                '2c01 Arabic (Jordan)',
                '3001 Arabic (Lebanon)',
                '3401 Arabic (Kuwait)',
                '3801 Arabic (U.A.E.)',
                '3c01 Arabic (Bahrain)',
                '4001 Arabic (Qatar)',
                '042b Armenian',
                '042c Azeri (Latin)',
                '082c Azeri (Cyrillic)',
                '042d Basque',
                '0423 Belarusian',
                '0445 Bengali (India)',
                '141a Bosnian (Bosnia And Herzegovina)',
                '0402 Bulgarian',
                '0455 Burmese',
                '0403 Catalan',
                '0404 Chinese (Taiwan)',
                '0804 Chinese (PRC)',
                '0c04 Chinese (Hong Kong SAR, PRC)',
                '1004 Chinese (Singapore)',
                '1404 Chinese (Macao SAR)',
                '041a Croatian',
                '101a Croatian (Bosnia And Herzegovina)',
                '0405 Czech',
                '0406 Danish',
                '0465 Divehi',
                '0413 Dutch (Netherlands)',
                '0813 Dutch (Belgium)',
                '0409 English (United States)',
                '0809 English (United Kingdom)',
                '0c09 English (Australian)',
                '1009 English (Canadian)',
                '1409 English (New Zealand)',
                '1809 English (Ireland)',
                '1c09 English (South Africa)',
                '2009 English (Jamaica)',
                '2409 English (Caribbean)',
                '2809 English (Belize)',
                '2c09 English (Trinidad)',
                '3009 English (Zimbabwe)',
                '3409 English (Philippines)',
                '0425 Estonian',
                '0438 Faeroese',
                '0429 Farsi',
                '040b Finnish',
                '040c French (Standard)',
                '080c French (Belgian)',
                '0c0c French (Canadian)',
                '100c French (Switzerland)',
                '140c French (Luxembourg)',
                '180c French (Monaco)',
                '0456 Galician',
                '0437 Georgian',
                '0407 German (Standard)',
                '0807 German (Switzerland)',
                '0c07 German (Austria)',
                '1007 German (Luxembourg)',
                '1407 German (Liechtenstein)',
                '0408 Greek',
                '0447 Gujarati',
                '040d Hebrew',
                '0439 Hindi',
                '040e Hungarian',
                '040f Icelandic',
                '0421 Indonesian',
                '0434 isiXhosa/Xhosa (South Africa)',
                '0435 isiZulu/Zulu (South Africa)',
                '0410 Italian (Standard)',
                '0810 Italian (Switzerland)',
                '0411 Japanese',
                '044b Kannada',
                '0457 Konkani',
                '0412 Korean',
                '0812 Korean (Johab)',
                '0440 Kyrgyz',
                '0426 Latvian',
                '0427 Lithuanian',
                '0827 Lithuanian (Classic)',
                '042f Macedonian (FYROM)',
                '043e Malay (Malaysian)',
                '083e Malay (Brunei Darussalam)',
                '044c Malayalam (India)',
                '0481 Maori (New Zealand)',
                '043a Maltese (Malta)',
                '044e Marathi',
                '0450 Mongolian',
                '0414 Norwegian (Bokmal)',
                '0814 Norwegian (Nynorsk)',
                '0415 Polish',
                '0416 Portuguese (Brazil)',
                '0816 Portuguese (Portugal)',
                '0446 Punjabi',
                '046b Quechua (Bolivia)',
                '086b Quechua (Ecuador)',
                '0c6b Quechua (Peru)',
                '0418 Romanian',
                '0419 Russian',
                '044f Sanskrit',
                '043b Sami, Northern (Norway)',
                '083b Sami, Northern (Sweden)',
                '0c3b Sami, Northern (Finland)',
                '103b Sami, Lule (Norway)',
                '143b Sami, Lule (Sweden)',
                '183b Sami, Southern (Norway)',
                '1c3b Sami, Southern (Sweden)',
                '203b Sami, Skolt (Finland)',
                '243b Sami, Inari (Finland)',
                '0c1a Serbian (Cyrillic)',
                '1c1a Serbian (Cyrillic, Bosnia, And Herzegovina)',
                '081a Serbian (Latin)',
                '181a Serbian (Latin, Bosnia, And Herzegovina)',
                '046c Sesotho sa Leboa/Northern Sotho (South Africa)',
                '0432 Setswana/Tswana (South Africa)',
                '041b Slovak',
                '0424 Slovenian',
                '040a Spanish (Spain, Traditional Sort)',
                '080a Spanish (Mexican)',
                '0c0a Spanish (Spain, Modern Sort)',
                '100a Spanish (Guatemala)',
                '140a Spanish (Costa Rica)',
                '180a Spanish (Panama)',
                '1c0a Spanish (Dominican Republic)',
                '200a Spanish (Venezuela)',
                '240a Spanish (Colombia)',
                '280a Spanish (Peru)',
                '2c0a Spanish (Argentina)',
                '300a Spanish (Ecuador)',
                '340a Spanish (Chile)',
                '380a Spanish (Uruguay)',
                '3c0a Spanish (Paraguay)',
                '400a Spanish (Bolivia)',
                '440a Spanish (El Salvador)',
                '480a Spanish (Honduras)',
                '4c0a Spanish (Nicaragua)',
                '500a Spanish (Puerto Rico)',
                '0430 Sutu',
                '0441 Swahili (Kenya)',
                '041d Swedish',
                '081d Swedish (Finland)',
                '045a Syriac',
                '0449 Tamil',
                '0444 Tatar (Tatarstan)',
                '044a Telugu',
                '041e Thai',
                '041f Turkish',
                '0422 Ukrainian',
                '0420 Urdu (Pakistan)',
                '0820 Urdu (India)',
                '0443 Uzbek (Latin)',
                '0843 Uzbek (Cyrillic)',
                '042a Vietnamese',
                '0452 Welsh (United Kingdom)',
            ] },
    ];

    const SELECT_DEFAULTS: Record<string, string> = {};
    for (const fd of FIXED_FIELDS) {
        if (fd.type === 'select' && fd.options) SELECT_DEFAULTS[fd.id] = fd.options[0];
    }

    type ViField = { id: string; value: string };

    function getFieldValue(id: string): string {
        const f = t.versionInfo!.fields.find((x: ViField) => x.id === id);
        return f ? (f.value || '') : '';
    }

    function setFieldValue(id: string, value: string): void {
        if (!value && SELECT_DEFAULTS[id]) {
            value = SELECT_DEFAULTS[id];
        }
        const existing = t.versionInfo!.fields.find((x: ViField) => x.id === id);
        if (!value) {
            t.versionInfo!.fields = t.versionInfo!.fields.filter((x: ViField) => x.id !== id);
        } else if (existing) {
            (existing as ViField).value = value;
        } else {
            t.versionInfo!.fields.push({ id, value });
        }
        markViDirty();
    }

    function markViDirty(): void {
        if (!t.meta) t.meta = {};
        if (!t.meta.presentNodes) t.meta.presentNodes = {};
        (t.meta.presentNodes as Record<string, boolean>).versioninfo = true;
        setDirtyModel(true);
    }

    const enabled  = !!t.versionInfo.enabled;
    const chk      = enabled ? 'checked' : '';
    const dis      = enabled ? '' : 'disabled';

    let html = '';
    html += '<div class="check-list" style="margin-bottom:10px;">';
    html += `<label><input id="viEnable" type="checkbox" ${chk} /> Enable Version Info</label>`;
    html += '</div>';

    if (!enabled) {
        html += '<div class="muted" style="margin-bottom:8px;">Enable Version Info to edit fields.</div>';
    } else {
        html += '<div class="muted" style="margin-bottom:6px; font-size:0.9em;">';
        html += 'Tokens: %OS %SOURCE %EXECUTABLE %COMPILECOUNT %BUILDCOUNT';
        html += ' and FormatDate() tokens (%yy %mm %dd ...)';
        html += '</div>';
    }

    html += '<div class="grid2" id="viFixedGrid" style="max-width:900px;">';
    for (const fd of FIXED_FIELDS) {
        const val = esc(getFieldValue(fd.id));
        html += '<label>' + esc(fd.label) + '</label>';
        if (fd.type === 'select' && fd.options) {
            html += '<select id="vi_' + fd.id + '" ' + dis + '>';
            for (const opt of fd.options) {
                const currentVal = getFieldValue(fd.id) || SELECT_DEFAULTS[fd.id] || '';
                const selAttr = currentVal === opt ? 'selected' : '';
                const optLabel = opt || '(none)';
                html += '<option value="' + esc(opt) + '" ' + selAttr + '>' + esc(optLabel) + '</option>';
            }
            html += '</select>';
        } else {
            html += '<input type="text" id="vi_' + fd.id + '" value="' + val + '" ' + dis + ' />';
        }
    }
    html += '</div>';

    html += '<hr style="margin:14px 0; border:none; border-top:1px solid var(--vscode-editorWidget-border);" />';
    html += '<div class="muted" style="margin-bottom:6px;">Custom fields</div>';
    html += '<div class="btnrow" style="margin-bottom:8px;">';
    html += '<button class="btn" id="viAddCustom" ' + dis + '>Add custom field</button>';
    html += '</div>';
    html += '<table>';
    html += '<thead><tr>';
    html += '<th style="width:140px;">Field ID</th>';
    html += '<th>Value</th>';
    html += '<th style="width:80px;"></th>';
    html += '</tr></thead>';
    html += '<tbody id="viCustomRows"></tbody>';
    html += '</table>';

    container.innerHTML = html;

    $('viEnable').addEventListener('change', function(e) {
        t.versionInfo!.enabled = (e.target as HTMLInputElement).checked;
        markViDirty();
        renderTargetVersionInfo(container, t);
    });

    for (const fd of FIXED_FIELDS) {
        (function(fdInner: VersionField) {
            const el = document.getElementById('vi_' + fdInner.id);
            if (!el) return;
            const evtName = fdInner.type === 'select' ? 'change' : 'input';
            el.addEventListener(evtName, function(e) {
                setFieldValue(fdInner.id, (e.target as HTMLInputElement | HTMLSelectElement).value);
            });
        })(fd);
    }

    function isCustomField(f: ViField): boolean {
        const m = f.id.match(/^field(\d+)$/);
        return !m || parseInt(m[1], 10) >= 18;
    }

    function rebuildCustom(): void {
        const tbody = $('viCustomRows');
        tbody.innerHTML = '';
        const custom = t.versionInfo!.fields.filter(isCustomField) as ViField[];

        if (custom.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="3"><em>No custom fields.</em></td>';
            tbody.appendChild(tr);
        }

        for (const cf of custom) {
            const gidx     = t.versionInfo!.fields.indexOf(cf);
            const disAttr  = enabled ? '' : 'disabled';
            const tr       = document.createElement('tr');
            tr.innerHTML =
                '<td><input type="text" data-gidx="' + gidx + '" data-k="id"  value="' + esc(cf.id)    + '" ' + disAttr + ' /></td>' +
                '<td><input type="text" data-gidx="' + gidx + '" data-k="val" value="' + esc(cf.value) + '" ' + disAttr + ' /></td>' +
                '<td><button class="btn" data-gidx="' + gidx + '" ' + disAttr + '>Remove</button></td>';
            tbody.appendChild(tr);
        }

        for (const inp of tbody.querySelectorAll<HTMLInputElement>('input[type="text"]')) {
            inp.addEventListener('input', function(e) {
                const gidx = parseInt((e.target as HTMLInputElement).dataset.gidx ?? '0', 10);
                const k    = (e.target as HTMLInputElement).dataset.k;
                if (k === 'id')  (t.versionInfo!.fields[gidx] as ViField).id    = (e.target as HTMLInputElement).value;
                if (k === 'val') (t.versionInfo!.fields[gidx] as ViField).value = (e.target as HTMLInputElement).value;
                markViDirty();
            });
        }

        for (const btn of tbody.querySelectorAll<HTMLButtonElement>('button[data-gidx]')) {
            btn.addEventListener('click', function(e) {
                const gidx = parseInt((e.target as HTMLButtonElement).dataset.gidx ?? '0', 10);
                t.versionInfo!.fields.splice(gidx, 1);
                markViDirty();
                rebuildCustom();
            });
        }
    }

    $('viAddCustom').addEventListener('click', function() {
        let nextId = 18;
        while (t.versionInfo!.fields.some((f: ViField) => f.id === 'field' + nextId)) {
            nextId++;
        }
        t.versionInfo!.fields.push({ id: 'field' + nextId, value: '' });
        markViDirty();
        rebuildCustom();
    });

    rebuildCustom();
}

// ---------------------------------------------------------------------------
// Render: Targets — Resources
// ---------------------------------------------------------------------------

function renderTargetResources(container: HTMLElement, t: PbpTarget): void {
    if (!t.resources) t.resources = [];

    container.innerHTML = `
      <div class="btnrow" style="margin-bottom:8px;">
        <button class="btn" id="resAdd">Add</button>
      </div>
      <table>
        <thead><tr><th>Resource</th><th style="width:80px"></th></tr></thead>
        <tbody id="resRows"></tbody>
      </table>
    `;

    function markNode(): void {
        if (!t.meta) t.meta = {};
        if (!t.meta.presentNodes) t.meta.presentNodes = {};
        (t.meta.presentNodes as Record<string, boolean>).resources = true;
    }

    function rebuild(): void {
        const tbody = $('resRows');
        tbody.innerHTML = '';
        for (let i = 0; i < t.resources!.length; i++) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
          <td><input type="text" data-idx="${i}" value="${esc(t.resources![i])}"></td>
          <td><button class="btn" data-del="${i}">Remove</button></td>
        `;
            tbody.appendChild(tr);
        }
        if (t.resources!.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="2"><em>No resources.</em></td>`;
            tbody.appendChild(tr);
        }

        for (const inp of tbody.querySelectorAll<HTMLInputElement>('input')) {
            inp.addEventListener('input', (e) => {
                const idx = parseInt((e.target as HTMLInputElement).dataset.idx ?? '0', 10);
                t.resources![idx] = (e.target as HTMLInputElement).value;
                markNode();
                setDirtyModel(true);
            });
        }

        for (const btn of tbody.querySelectorAll<HTMLButtonElement>('button[data-del]')) {
            btn.addEventListener('click', (e) => {
                const idx = parseInt((e.target as HTMLButtonElement).dataset.del ?? '0', 10);
                t.resources!.splice(idx, 1);
                markNode();
                setDirtyModel(true);
                rebuild();
            });
        }
    }

    $('resAdd').addEventListener('click', () => {
        t.resources!.push('');
        markNode();
        setDirtyModel(true);
        rebuild();
    });

    rebuild();
}

// ---------------------------------------------------------------------------
// Render: Targets — Watchlist
// ---------------------------------------------------------------------------

function renderTargetWatchlist(container: HTMLElement, t: PbpTarget): void {
    container.innerHTML = `
      <div class="grid2">
        <label>Watchlist</label>
        <textarea id="watchText"></textarea>
      </div>
    `;

    ($('watchText') as HTMLTextAreaElement).value = t.watchList ?? '';
    $('watchText').addEventListener('input', (e) => {
        t.watchList = (e.target as HTMLTextAreaElement).value;
        if (!t.meta) t.meta = {};
        if (!t.meta.presentNodes) t.meta.presentNodes = {};
        (t.meta.presentNodes as Record<string, boolean>).watchlist = true;
        setDirtyModel(true);
    });
}

// ---------------------------------------------------------------------------
// XML Syntax Highlight (minimal tokenizer, no deps)
// ---------------------------------------------------------------------------

function highlightXmlTag(raw: string): string {
    const out: string[] = [];
    let s = raw;
    const tok = (cls: string, r: string) =>
        out.push(cls ? `<span class="${cls}">${esc(r)}</span>` : esc(r));

    const openM = s.match(/^<\/?/);
    if (openM) { tok('xb', openM[0]); s = s.slice(openM[0].length); }

    const nameM = s.match(/^[\w:.-]+/);
    if (nameM) { tok('xt', nameM[0]); s = s.slice(nameM[0].length); }

    while (s.length > 0 && !/^\/?>/.test(s)) {
        let m: RegExpMatchArray | null;
        if ((m = s.match(/^(\s+)([\w:.-]+)(\s*=\s*)("[^"]*"|'[^']*')/))) {
            tok('', m[1]); tok('xa', m[2]); tok('xb', m[3]); tok('xv', m[4]);
            s = s.slice(m[0].length); continue;
        }
        if ((m = s.match(/^(\s+)([\w:.-]+)/))) {
            tok('', m[1]); tok('xa', m[2]);
            s = s.slice(m[0].length); continue;
        }
        if ((m = s.match(/^\s+/))) { tok('', m[0]); s = s.slice(m[0].length); continue; }
        tok('xb', s[0]); s = s.slice(1);
    }
    const closeM = s.match(/^\/?>?/);
    if (closeM?.[0]) tok('xb', closeM[0]);
    return out.join('');
}

function highlightXml(xml: string): string {
    const out: string[] = [];
    let s = xml;
    const push = (cls: string, r: string) =>
        out.push(cls ? `<span class="${cls}">${esc(r)}</span>` : esc(r));

    while (s.length > 0) {
        let m: RegExpMatchArray | null;
        if ((m = s.match(/^<!--[\s\S]*?-->/)))         { push('xc', m[0]); s = s.slice(m[0].length); continue; }
        if ((m = s.match(/^<\?[\s\S]*?\?>/)))          { push('xp', m[0]); s = s.slice(m[0].length); continue; }
        if ((m = s.match(/^<\/?[^>]*(?:>|$)/)))        { out.push(highlightXmlTag(m[0])); s = s.slice(m[0].length); continue; }
        if ((m = s.match(/^[^<]+/)))                   { push('', m[0]); s = s.slice(m[0].length); continue; }
        push('', s[0]); s = s.slice(1);
    }
    return out.join('');
}

// ---------------------------------------------------------------------------
// Render: Targets — outer layout
// ---------------------------------------------------------------------------

function renderTargets(): void {
    const el = $('page-targets');
    el.innerHTML = '';

    if (!ensureProject() || !state.project) {
        el.innerHTML = `<div class="panel">No project model available.</div>`;
        return;
    }

    const targets = getTargets();
    if (targets.length === 0) {
        el.innerHTML = `<div class="panel"><em>No targets found.</em></div>`;
        return;
    }

    const row = document.createElement('div');
    row.className = 'row';

    const left = document.createElement('div');
    left.className = 'panel';
    left.innerHTML = `
      <div class="muted" style="margin-bottom:6px;">Compile targets</div>
      <select id="targetSelect"></select>
      <div style="margin-top:10px;">
        <label><input type="checkbox" id="tIsDefault" style="margin-right:6px;">Set as default target</label>
      </div>
      <div style="margin-top:6px;">
        <label><input type="checkbox" id="tEnabled" style="margin-right:6px;">Enable in 'Build all Targets'</label>
      </div>
    `;

    row.appendChild(left);

    const right = document.createElement('div');
    right.className = 'panel';
    row.appendChild(right);

    el.appendChild(row);

    const sel = $('targetSelect') as HTMLSelectElement;
    sel.innerHTML = '';
    targets.forEach((t, i) => {
        const opt = document.createElement('option');
        const flags = `${t.enabled ? '' : ' (disabled)'}${t.isDefault ? ' [default]' : ''}`;
        opt.value = String(i);
        opt.textContent = (t.name || ('Target ' + (i + 1))) + flags;
        sel.appendChild(opt);
    });

    state.activeTargetIndex = Math.max(0, Math.min(state.activeTargetIndex, targets.length - 1));
    sel.value = String(state.activeTargetIndex);

    sel.addEventListener('change', () => {
        state.activeTargetIndex = parseInt(sel.value, 10);
        renderTargets();
    });

    const t = getActiveTarget();
    if (!t) {
        right.innerHTML = '<em>No target selected.</em>';
        return;
    }

    ($('tIsDefault') as HTMLInputElement).checked = !!t.isDefault;
    ($('tEnabled') as HTMLInputElement).checked = !!t.enabled;

    $('tIsDefault').addEventListener('change', (e) => {
        t.isDefault = (e.target as HTMLInputElement).checked;
        const opt = sel.options[state.activeTargetIndex];
        if (opt) {
            const flags = `${t.enabled ? '' : ' (disabled)'}${t.isDefault ? ' [default]' : ''}`;
            opt.textContent = (t.name || ('Target ' + (state.activeTargetIndex + 1))) + flags;
        }
        setDirtyModel(true);
    });

    $('tEnabled').addEventListener('change', (e) => {
        t.enabled = (e.target as HTMLInputElement).checked;
        const opt = sel.options[state.activeTargetIndex];
        if (opt) {
            const flags = `${t.enabled ? '' : ' (disabled)'}${t.isDefault ? ' [default]' : ''}`;
            opt.textContent = (t.name || ('Target ' + (state.activeTargetIndex + 1))) + flags;
        }
        setDirtyModel(true);
    });

    const head = document.createElement('div');
    head.className = 'muted';
    head.style.marginBottom = '8px';
    head.textContent = `Target: ${t.name}`;
    right.appendChild(head);

    renderTargetSubTabs(right, t);
}

// ---------------------------------------------------------------------------
// Render: Raw XML
// ---------------------------------------------------------------------------

function renderXml(): void {
    const el = $('page-xml');
    el.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `<div class="muted" style="margin-bottom:8px;">Raw XML view is read-only. Use the structured tabs to make changes.</div>`;

    const pre = document.createElement('pre');
    pre.className = 'xml-hl';
    pre.innerHTML = highlightXml(state.xml ?? '');
    panel.appendChild(pre);
    el.appendChild(panel);
}

// ---------------------------------------------------------------------------
// Top-level render
// ---------------------------------------------------------------------------

function renderAll(): void {
    renderStatus();
    renderProjectOptions();
    renderFiles();
    renderTargets();
    renderLibraries();
    renderXml();
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

$('btnSave').addEventListener('click', () => {
    if (!state.project) return;
    vscode.postMessage({ type: 'saveModel', project: state.project });
});
$('btnSaveXml').addEventListener('click', () => {
    vscode.postMessage({ type: 'saveXml', xml: state.xml ?? '' });
});

// ---------------------------------------------------------------------------
// Message bus (extension → webview)
// ---------------------------------------------------------------------------

window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as { type: string; project?: PbpProject; xml?: string; errorText?: string | null };
    if (!msg || !msg.type) return;

    if (msg.type === 'state') {
        if (!state.dirtyModel) {
            state.project = msg.project ?? null;
            state.errorText = msg.errorText ?? null;
        }
        if (!state.dirtyXml) {
            state.xml = msg.xml ?? '';
        }
        renderAll();
    }

    if (msg.type === 'saved') {
        setDirtyModel(false);
        setDirtyXml(false);
        state.errorText = msg.errorText ?? null;
        renderAll();
    }

    if (msg.type === 'filePicked') {
        const m = msg as unknown as { type: string; rawPath: string; fsPath: string };
        if (typeof window._filePickedHandler === 'function') {
            window._filePickedHandler(m.rawPath, m.fsPath);
        }
    }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

bindTabs();
renderAll();