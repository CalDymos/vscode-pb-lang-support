/*
    Provides an editable custom editor for PureBasic .pbp project files.

    The editor offers structured tabs similar to PureBasic's project dialog,
    plus a Raw XML tab to cover settings not (yet) modeled.
*/

import * as vscode from 'vscode';
import * as path from 'path';

import { parsePbpProjectText, writePbpProjectText, type PbpProject, type PbpTarget } from '@caldymos/pb-project-core';

export const PBP_EDITOR_VIEW_TYPE = 'pbProjectFiles.pbpEditor';

function getNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function renderHtml(webview: vscode.Webview, document: vscode.TextDocument, project: PbpProject | null, xml: string, errorText?: string): string {
    const nonce = getNonce();
    const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;

    const initial = {
        uri: document.uri.toString(),
        fsPath: document.uri.fsPath,
        xml,
        project,
        errorText: errorText ?? null,
    };

    const initialJson = JSON.stringify(initial).replace(/</g, '\\u003c');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PureBasic Project</title>
  <style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 0; margin: 0; }
    .toolbar { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--vscode-editorWidget-border); position: sticky; top: 0; background: var(--vscode-editor-background); z-index: 2; }
    .toolbar button { padding: 4px 10px; }
    .status { opacity: 0.8; }

    .tabs { display: flex; gap: 6px; padding: 8px 10px; border-bottom: 1px solid var(--vscode-editorWidget-border); }
    .tabbtn { padding: 6px 10px; border: 1px solid var(--vscode-editorWidget-border); border-radius: 4px; background: var(--vscode-editorWidget-background); cursor: pointer; }
    .tabbtn.active { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-button-background); }

    .page { display: none; padding: 10px; }
    .page.active { display: block; }

    .grid2 { display: grid; grid-template-columns: 240px 1fr; gap: 10px 14px; align-items: center; max-width: 1100px; }
    .grid2 label { opacity: 0.95; }
    input[type="text"], input[type="number"], textarea, select { width: 100%; box-sizing: border-box; padding: 4px 6px; border: 1px solid var(--vscode-input-border); background: var(--vscode-input-background); color: var(--vscode-input-foreground); border-radius: 3px; }
    textarea { min-height: 90px; resize: vertical; }

    .row { display: grid; grid-template-columns: 280px 1fr; gap: 10px; }
    .panel { border: 1px solid var(--vscode-editorWidget-border); border-radius: 6px; padding: 10px; background: var(--vscode-editorWidget-background); }

    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid var(--vscode-editorWidget-border); padding: 6px 8px; text-align: left; }
    th { background: var(--vscode-editorWidget-background); }

    .subtabs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }

    .muted { opacity: 0.75; }
    .error { margin: 10px 0; padding: 8px 10px; border: 1px solid var(--vscode-inputValidation-errorBorder); background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); border-radius: 4px; }

    .btnrow { display:flex; gap:8px; flex-wrap:wrap; }
    .btn { padding: 4px 10px; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="btnSave" disabled>Save</button>
    <button id="btnSaveXml" disabled>Save XML</button>
    <span id="status" class="status muted"></span>
  </div>

  <div class="tabs">
    <button class="tabbtn active" data-tab="project">Project Options</button>
    <button class="tabbtn" data-tab="files">Project Files</button>
    <button class="tabbtn" data-tab="targets">Targets</button>
    <button class="tabbtn" data-tab="libraries">Libraries</button>
    <button class="tabbtn" data-tab="xml">Raw XML</button>
  </div>

  <div id="page-project" class="page active"></div>
  <div id="page-files" class="page"></div>
  <div id="page-targets" class="page"></div>
  <div id="page-libraries" class="page"></div>
  <div id="page-xml" class="page"></div>

  <script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const initial = ${initialJson};

  let state = {
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

  function $(id) { return document.getElementById(id); }

  function setStatus(text) {
    $('status').textContent = text || '';
  }

  function setDirtyModel(v) {
    state.dirtyModel = v;
    $('btnSave').disabled = !v;
    renderStatus();
  }

  function setDirtyXml(v) {
    state.dirtyXml = v;
    $('btnSaveXml').disabled = !v;
    renderStatus();
  }

  function renderStatus() {
    const parts = [];
    if (state.dirtyModel) parts.push('Model changed');
    if (state.dirtyXml) parts.push('XML changed');
    if (state.errorText) parts.push('Parse error');
    setStatus(parts.join(' • '));
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function setActiveTab(name) {
    state.activeTab = name;
    for (const btn of document.querySelectorAll('.tabs .tabbtn')) {
      btn.classList.toggle('active', btn.dataset.tab === name);
    }
    for (const p of document.querySelectorAll('.page')) {
      p.classList.toggle('active', p.id === 'page-' + name);
    }
  }

  function bindTabs() {
    for (const btn of document.querySelectorAll('.tabs .tabbtn')) {
      btn.addEventListener('click', () => {
        setActiveTab(btn.dataset.tab);
      });
    }
  }

  function ensureProject() {
    if (state.project) return true;
    return false;
  }

  function updateConfigField(key, value) {
    if (!ensureProject()) return;
    state.project.config[key] = value;
    setDirtyModel(true);
  }

  function parseIntSafe(v) {
    const n = parseInt(String(v ?? '').trim(), 10);
    return Number.isFinite(n) ? n : 0;
  }

  function getTargets() {
    if (!state.project) return [];
    return Array.isArray(state.project.targets) ? state.project.targets : [];
  }

  function getActiveTarget() {
    const targets = getTargets();
    const idx = Math.max(0, Math.min(state.activeTargetIndex, targets.length - 1));
    return targets[idx];
  }

  function ensureTargetOptions(t) {
    if (!t.options) t.options = {};
    if (!t.optionsAttrs) t.optionsAttrs = {};
  }

  function setTargetOptionFlag(t, key, enabled, opts = {}) {
    ensureTargetOptions(t);
    t.options[key] = !!enabled;

    // Excel mapping: optimizer uses explicit 0/1, others are commonly omitted when disabled.
    const forceZero = opts.forceZero === true;

    if (enabled) {
      t.optionsAttrs[key] = '1';
    } else {
      if (forceZero) t.optionsAttrs[key] = '0';
      else delete t.optionsAttrs[key];
    }

    // admin/user mutual exclusion (Excel note)
    if (key === 'admin' && enabled) {
      t.options['user'] = false;
      delete t.optionsAttrs['user'];
    }
    if (key === 'user' && enabled) {
      t.options['admin'] = false;
      delete t.optionsAttrs['admin'];
    }

    setDirtyModel(true);
  }

  function setTargetValueTag(t, tagName, raw) {
    if (!t.meta) t.meta = {};
    if (!t.meta.presentNodes) t.meta.presentNodes = {};
    t.meta.presentNodes[tagName] = true;

    if (tagName === 'directory') {
      t.directory = raw;
    } else if (tagName === 'commandline') {
      t.commandLine = raw;
    } else if (tagName === 'temporaryexe') {
      t.temporaryExe = raw;
    }
    setDirtyModel(true);
  }

function renderProjectOptions() {
    const el = $('page-project');
    el.innerHTML = '';

    if (state.errorText) {
      el.innerHTML = \`<div class="error"><strong>Parse error:</strong> \${esc(state.errorText)}</div>\`;
    }

    if (!ensureProject()) {
      el.innerHTML += \`<div class="panel">No project model available.</div>\`;
      return;
    }

    const cfg = state.project.config;

    const infoPanel = document.createElement('fieldset');
    infoPanel.innerHTML = \`
      <legend>Project Info</legend>
      <div class="grid2">
        <label>Project File</label>
        <input type="text" value="\${esc(initial.fsPath)}" readonly style="opacity:0.65;" />

        <label>Project Name</label>
        <input id="cfgName" type="text" />

        <label>Comments</label>
        <textarea id="cfgComment"></textarea>
      </div>
    \`;
    el.appendChild(infoPanel);

    const loadPanel = document.createElement('fieldset');
    loadPanel.style.marginTop = '12px';
    loadPanel.innerHTML = \`
      <legend>Loading Options</legend>

      <div style="margin-bottom:6px;">
        <label><input id="cfgCloseFiles" type="checkbox" style="margin-right:6px;">Close all sources when closing the project</label>
      </div>

      <div style="margin-top:10px; margin-bottom:4px;">When opening the project…</div>
      <div id="openModeRadios">
        \${[
          'load all sources that were open last time',
          'load all sources of the project',
          "load only sources marked in 'Project Files'",
          'load only the main file of the default target',
          'load no files',
        ].map((label, i) => \`<div><label><input type="radio" name="openmode" value="\${i}" style="margin-right:6px;">\${label}</label></div>\`).join('')}
      </div>
    \`;
    el.appendChild(loadPanel);

    $('cfgName').value = cfg.name ?? '';
    $('cfgComment').value = cfg.comment ?? '';
    $('cfgCloseFiles').checked = !!cfg.closefiles;

    const currentMode = String(cfg.openmode ?? 0);
    for (const radio of document.querySelectorAll('input[name="openmode"]')) {
      radio.checked = radio.value === currentMode;
      radio.addEventListener('change', (e) => updateConfigField('openmode', parseIntSafe(e.target.value)));
    }

    $('cfgName').addEventListener('input', (e) => updateConfigField('name', e.target.value));
    $('cfgComment').addEventListener('input', (e) => updateConfigField('comment', e.target.value));
    $('cfgCloseFiles').addEventListener('change', (e) => updateConfigField('closefiles', e.target.checked));
  }

function renderFiles() {
    const el = $('page-files');
    el.innerHTML = '';

    if (!ensureProject()) {
      el.innerHTML = \`<div class="panel">No project model available.</div>\`;
      return;
    }

    const files = state.project.files ?? [];

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'btnrow';
    toolbar.style.marginBottom = '8px';
    toolbar.innerHTML = \`
      <button class="btn" id="fileAdd">Add</button>
      <button class="btn" id="fileRemove">Remove</button>
    \`;
    el.appendChild(toolbar);

    // File list
    const listPanel = document.createElement('div');
    listPanel.className = 'panel';
    listPanel.style.cssText = 'min-height:160px; max-height:320px; overflow-y:auto; padding:4px;';

    const ul = document.createElement('ul');
    ul.id = 'fileList';
    ul.style.cssText = 'list-style:none; margin:0; padding:0;';
    listPanel.appendChild(ul);
    el.appendChild(listPanel);

    // Detail panel
    const detail = document.createElement('div');
    detail.id = 'fileDetail';
    detail.className = 'panel';
    detail.style.marginTop = '8px';
    el.appendChild(detail);

    function renderList() {
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

    function renderDetail() {
      detail.innerHTML = '';
      const idx = state.activeFileIndex;

      if (idx < 0 || idx >= files.length) {
        detail.innerHTML = \`<span class="muted">Select a file to edit its options.</span>\`;
        return;
      }

      const f = files[idx];
      if (!f.config) f.config = {};

      detail.innerHTML = \`
        <div style="margin-bottom:10px; font-weight:600; word-break:break-all;">\${esc(f.rawPath)}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          <label><input type="checkbox" id="fLoad" style="margin-right:6px;">Load file when opening the project</label>
          <label><input type="checkbox" id="fScan" style="margin-right:6px;">Scan file for Autocomplete</label>
          <label><input type="checkbox" id="fWarn" style="margin-right:6px;">Display a warning if file changed</label>
          <label><input type="checkbox" id="fPanel" style="margin-right:6px;">Show file in the Project panel</label>
        </div>
      \`;

      $('fLoad').checked  = !!f.config.load;
      $('fScan').checked  = !!f.config.scan;
      $('fWarn').checked  = !!f.config.warn;
      $('fPanel').checked = !!f.config.panel;

      function updateFlag(key, val) {
        if (!f.config) f.config = {};
        if (!f.config.attrs) f.config.attrs = {};
        f.config[key] = val;
        f.config.attrs[key] = val ? '1' : '0';
        setDirtyModel(true);
      }

      $('fLoad').addEventListener('change',  (e) => updateFlag('load',  e.target.checked));
      $('fScan').addEventListener('change',  (e) => updateFlag('scan',  e.target.checked));
      $('fWarn').addEventListener('change',  (e) => updateFlag('warn',  e.target.checked));
      $('fPanel').addEventListener('change', (e) => updateFlag('panel', e.target.checked));
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

    // Handle filePicked response from extension
    window._filePickedHandler = (rawPath, fsPath) => {
      if (!state.project.files) state.project.files = [];
      state.project.files.push({ rawPath, fsPath: fsPath ?? '' });
      state.activeFileIndex = state.project.files.length - 1;
      setDirtyModel(true);
      renderFiles();
    };

    renderList();
    renderDetail();
  }

  function renderLibraries() {
    const el = $('page-libraries');
    el.innerHTML = '';

    if (!ensureProject()) {
      el.innerHTML = \`<div class="panel">No project model available.</div>\`;
      return;
    }

    const libs = state.project.libraries ?? [];

    const panel = document.createElement('div');
    panel.className = 'panel';

    panel.innerHTML = \`
      <div class="btnrow" style="margin-bottom:8px;">
        <button class="btn" id="libAdd">Add</button>
      </div>
      <table>
        <thead><tr><th>Library</th><th style="width:80px"></th></tr></thead>
        <tbody id="libRows"></tbody>
      </table>
    \`;

    el.appendChild(panel);

    function rebuild() {
      const tbody = $('libRows');
      tbody.innerHTML = '';
      for (let i = 0; i < libs.length; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td><input type="text" data-idx="\${i}" value="\${esc(libs[i])}"></td>
          <td><button class="btn" data-del="\${i}">Remove</button></td>\`;
        tbody.appendChild(tr);
      }
      if (libs.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td colspan="2"><em>No libraries.</em></td>\`;
        tbody.appendChild(tr);
      }

      for (const inp of tbody.querySelectorAll('input[type="text"]')) {
        inp.addEventListener('input', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          libs[idx] = e.target.value;
          setDirtyModel(true);
        });
      }
      for (const btn of tbody.querySelectorAll('button[data-del]')) {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.del, 10);
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

  function renderTargetSubTabs(container, t) {
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

  function renderTargetCompiler(container, t) {
    container.innerHTML = \`
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
        <div class="grid2" style="grid-template-columns: 360px 1fr;">
          <label>Optimize generated code</label><input id="opt_optimizer" type="checkbox" />
          <label>Enable inline ASM syntax coloring</label><input id="opt_asm" type="checkbox" />
          <label>Create threadsafe executable</label><input id="opt_thread" type="checkbox" />
          <label>Enable OnError lines support</label><input id="opt_onerror" type="checkbox" />
          <label>Enable DPI aware executable</label><input id="opt_dpiaware" type="checkbox" />
          <label>Enable modern theme support (XP skin)</label><input id="opt_xpskin" type="checkbox" />
          <label>Request Administrator mode</label><input id="opt_admin" type="checkbox" />
          <label>Request User mode (no virtualization)</label><input id="opt_user" type="checkbox" />
          <label>Enable DLL preloading protection</label><input id="opt_dllprotection" type="checkbox" />
          <label>Use shared UCRT</label><input id="opt_shareducrt" type="checkbox" />
          <label>Enable Wayland support</label><input id="opt_wayland" type="checkbox" />
        </div>
      </div>
    \`;

    // Basic fields
    $('tInput').value = t.inputFile?.rawPath ?? '';
    $('tOutput').value = t.outputFile?.rawPath ?? '';
    $('tCompiler').value = t.compilerVersion ?? '';
    $('tExecutable').value = t.executable?.rawPath ?? '';

    $('tSubsystem').value = t.subsystem ?? '';
    $('tLinker').value = t.linker?.rawPath ?? '';

    $('tIconEnable').checked = !!t.icon?.enabled;
    $('tIconPath').value = t.icon?.rawPath ?? '';

    $('tFmtExe').value = t.format?.exe ?? '';
    $('tFmtCpu').value = t.format?.cpu ?? '';

    $('tInput').addEventListener('input', (e) => { t.inputFile.rawPath = e.target.value; setDirtyModel(true); });
    $('tOutput').addEventListener('input', (e) => { t.outputFile.rawPath = e.target.value; setDirtyModel(true); });
    $('tCompiler').addEventListener('input', (e) => { t.compilerVersion = e.target.value; if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.compiler = true; setDirtyModel(true); });
    $('tExecutable').addEventListener('input', (e) => { t.executable.rawPath = e.target.value; if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.executable = true; setDirtyModel(true); });

    $('tSubsystem').addEventListener('input', (e) => { t.subsystem = e.target.value; if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.subsystem = true; setDirtyModel(true); });
    $('tLinker').addEventListener('input', (e) => { t.linker = { rawPath: e.target.value, fsPath: '' }; if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.linker = true; setDirtyModel(true); });

    $('tIconEnable').addEventListener('change', (e) => {
      if (!t.icon) t.icon = { enabled: false, rawPath: '', fsPath: '' };
      t.icon.enabled = e.target.checked;
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.icon = true;
      setDirtyModel(true);
    });
    $('tIconPath').addEventListener('input', (e) => {
      if (!t.icon) t.icon = { enabled: false, rawPath: '', fsPath: '' };
      t.icon.rawPath = e.target.value;
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.icon = true;
      setDirtyModel(true);
    });

    $('tFmtExe').addEventListener('change', (e) => { if (!t.format) t.format = {}; t.format.exe = e.target.value; if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.format = true; setDirtyModel(true); });
    $('tFmtCpu').addEventListener('change', (e) => { if (!t.format) t.format = {}; t.format.cpu = e.target.value; if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.format = true; setDirtyModel(true); });

    // Options flags
    ensureTargetOptions(t);
    $('opt_optimizer').checked = t.optionsAttrs?.optimizer === '1' || t.options?.optimizer === true;
    $('opt_asm').checked = t.optionsAttrs?.asm === '1' || t.options?.asm === true;
    $('opt_thread').checked = t.optionsAttrs?.thread === '1' || t.options?.thread === true;
    $('opt_onerror').checked = t.optionsAttrs?.onerror === '1' || t.options?.onerror === true;
    $('opt_dpiaware').checked = t.optionsAttrs?.dpiaware === '1' || t.options?.dpiaware === true;
    $('opt_xpskin').checked = t.optionsAttrs?.xpskin === '1' || t.options?.xpskin === true;
    $('opt_admin').checked = t.optionsAttrs?.admin === '1' || t.options?.admin === true;
    $('opt_user').checked = t.optionsAttrs?.user === '1' || t.options?.user === true;
    $('opt_dllprotection').checked = t.optionsAttrs?.dllprotection === '1' || t.options?.dllprotection === true;
    $('opt_shareducrt').checked = t.optionsAttrs?.shareducrt === '1' || t.options?.shareducrt === true;
    $('opt_wayland').checked = t.optionsAttrs?.wayland === '1' || t.options?.wayland === true;

    $('opt_optimizer').addEventListener('change', (e) => setTargetOptionFlag(t, 'optimizer', e.target.checked, { forceZero: true }));
    $('opt_asm').addEventListener('change', (e) => setTargetOptionFlag(t, 'asm', e.target.checked));
    $('opt_thread').addEventListener('change', (e) => setTargetOptionFlag(t, 'thread', e.target.checked));
    $('opt_onerror').addEventListener('change', (e) => setTargetOptionFlag(t, 'onerror', e.target.checked));
    $('opt_dpiaware').addEventListener('change', (e) => setTargetOptionFlag(t, 'dpiaware', e.target.checked));
    $('opt_xpskin').addEventListener('change', (e) => setTargetOptionFlag(t, 'xpskin', e.target.checked));
    $('opt_admin').addEventListener('change', (e) => setTargetOptionFlag(t, 'admin', e.target.checked));
    $('opt_user').addEventListener('change', (e) => setTargetOptionFlag(t, 'user', e.target.checked));
    $('opt_dllprotection').addEventListener('change', (e) => setTargetOptionFlag(t, 'dllprotection', e.target.checked));
    $('opt_shareducrt').addEventListener('change', (e) => setTargetOptionFlag(t, 'shareducrt', e.target.checked));
    $('opt_wayland').addEventListener('change', (e) => setTargetOptionFlag(t, 'wayland', e.target.checked));
  }

  function renderTargetRun(container, t) {
    container.innerHTML = \`
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

        <label>Compile count</label>
        <div style="display:flex; gap:10px; align-items:center;">
          <input id="run_cc_enable" type="checkbox" />
          <input id="run_cc_value" type="number" step="1" />
        </div>

        <label>Build count</label>
        <div style="display:flex; gap:10px; align-items:center;">
          <input id="run_bc_enable" type="checkbox" />
          <input id="run_bc_value" type="number" step="1" />
        </div>

        <label>EXE constant</label>
        <input id="run_execonst" type="checkbox" />
      </div>
    \`;

    ensureTargetOptions(t);
    $('run_debug').checked = t.optionsAttrs?.debug === '1' || t.options?.debug === true;
    $('run_debug').addEventListener('change', (e) => setTargetOptionFlag(t, 'debug', e.target.checked));

    $('run_purifier').checked = !!t.purifier?.enabled;
    $('run_granularity').value = t.purifier?.granularity ?? '';

    $('run_purifier').addEventListener('change', (e) => {
      if (!t.purifier) t.purifier = { enabled: false };
      t.purifier.enabled = e.target.checked;
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.purifier = true;
      setDirtyModel(true);
    });
    $('run_granularity').addEventListener('input', (e) => {
      if (!t.purifier) t.purifier = { enabled: false };
      t.purifier.granularity = e.target.value;
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.purifier = true;
      setDirtyModel(true);
    });

    $('run_dbg_custom').checked = !!t.debugger?.custom;
    $('run_dbg_type').value = t.debugger?.type ?? '';
    $('run_dbg_custom').addEventListener('change', (e) => {
      if (!t.debugger) t.debugger = {};
      t.debugger.custom = e.target.checked;
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.debugger = true;
      setDirtyModel(true);
    });
    $('run_dbg_type').addEventListener('input', (e) => {
      if (!t.debugger) t.debugger = {};
      t.debugger.type = e.target.value;
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.debugger = true;
      setDirtyModel(true);
    });

    $('run_warn_custom').checked = !!t.warnings?.custom;
    $('run_warn_type').value = t.warnings?.type ?? '';
    $('run_warn_custom').addEventListener('change', (e) => {
      if (!t.warnings) t.warnings = {};
      t.warnings.custom = e.target.checked;
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.warnings = true;
      setDirtyModel(true);
    });
    $('run_warn_type').addEventListener('input', (e) => {
      if (!t.warnings) t.warnings = {};
      t.warnings.type = e.target.value;
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.warnings = true;
      setDirtyModel(true);
    });

    $('run_cmd').value = t.commandLine ?? '';
    $('run_cmd').addEventListener('input', (e) => { setTargetValueTag(t, 'commandline', e.target.value); });

    $('run_dir').value = t.directory ?? '';
    $('run_dir').addEventListener('input', (e) => { setTargetValueTag(t, 'directory', e.target.value); });

    $('run_temp').value = t.temporaryExe ?? '';
    $('run_temp').addEventListener('input', (e) => { setTargetValueTag(t, 'temporaryexe', e.target.value); });

    $('run_cc_enable').checked = !!t.compileCount?.enabled;
    $('run_cc_value').value = String(t.compileCount?.value ?? 0);
    $('run_cc_enable').addEventListener('change', (e) => {
      if (!t.compileCount) t.compileCount = { enabled: false };
      t.compileCount.enabled = e.target.checked;
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.compilecount = true;
      setDirtyModel(true);
    });
    $('run_cc_value').addEventListener('input', (e) => {
      if (!t.compileCount) t.compileCount = { enabled: false };
      t.compileCount.value = parseIntSafe(e.target.value);
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.compilecount = true;
      setDirtyModel(true);
    });

    $('run_bc_enable').checked = !!t.buildCount?.enabled;
    $('run_bc_value').value = String(t.buildCount?.value ?? 0);
    $('run_bc_enable').addEventListener('change', (e) => {
      if (!t.buildCount) t.buildCount = { enabled: false };
      t.buildCount.enabled = e.target.checked;
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.buildcount = true;
      setDirtyModel(true);
    });
    $('run_bc_value').addEventListener('input', (e) => {
      if (!t.buildCount) t.buildCount = { enabled: false };
      t.buildCount.value = parseIntSafe(e.target.value);
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.buildcount = true;
      setDirtyModel(true);
    });

    $('run_execonst').checked = !!t.exeConstant?.enabled;
    $('run_execonst').addEventListener('change', (e) => {
      if (!t.exeConstant) t.exeConstant = { enabled: false };
      t.exeConstant.enabled = e.target.checked;
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.execonstant = true;
      setDirtyModel(true);
    });
  }

  function renderTargetConstants(container, t) {
    if (!t.constants) t.constants = [];

    container.innerHTML = \`
      <div class="btnrow" style="margin-bottom:8px;">
        <button class="btn" id="constAdd">Add</button>
      </div>
      <table>
        <thead><tr><th>Enabled</th><th>Value</th><th style="width:80px"></th></tr></thead>
        <tbody id="constRows"></tbody>
      </table>
    \`;

    function rebuild() {
      const tbody = $('constRows');
      tbody.innerHTML = '';
      for (let i = 0; i < t.constants.length; i++) {
        const c = t.constants[i];
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td><input type="checkbox" data-idx="\${i}" data-k="en" \${c.enabled ? 'checked' : ''}></td>
          <td><input type="text" data-idx="\${i}" data-k="val" value="\${esc(c.value)}"></td>
          <td><button class="btn" data-del="\${i}">Remove</button></td>
        \`;
        tbody.appendChild(tr);
      }
      if (t.constants.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td colspan="3"><em>No constants.</em></td>\`;
        tbody.appendChild(tr);
      }

      for (const inp of tbody.querySelectorAll('input')) {
        inp.addEventListener('change', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          const k = e.target.dataset.k;
          if (k === 'en') t.constants[idx].enabled = e.target.checked;
          if (k === 'val') t.constants[idx].value = e.target.value;
          if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.constants = true;
          setDirtyModel(true);
        });
        inp.addEventListener('input', (e) => {
          if (e.target.dataset.k !== 'val') return;
          const idx = parseInt(e.target.dataset.idx, 10);
          t.constants[idx].value = e.target.value;
          if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.constants = true;
          setDirtyModel(true);
        });
      }

      for (const btn of tbody.querySelectorAll('button[data-del]')) {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.del, 10);
          t.constants.splice(idx, 1);
          if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.constants = true;
          setDirtyModel(true);
          rebuild();
        });
      }
    }

    $('constAdd').addEventListener('click', () => {
      t.constants.push({ enabled: true, value: '' });
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.constants = true;
      setDirtyModel(true);
      rebuild();
    });

    rebuild();
  }

  function renderTargetVersionInfo(container, t) {
    if (!t.versionInfo) t.versionInfo = { enabled: false, fields: [] };
    if (!t.versionInfo.fields) t.versionInfo.fields = [];

    const FIXED_FIELDS = [
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
                    '0452 Welsh (United Kingdom)'
                  ] },   
    ];
    const SELECT_DEFAULTS = {};
    for (let i = 0; i < FIXED_FIELDS.length; i++) {
      const fd = FIXED_FIELDS[i];
      if (fd.type === 'select') SELECT_DEFAULTS[fd.id] = fd.options[0];
    }

    function getFieldValue(id) {
      const f = t.versionInfo.fields.find(function(x) { return x.id === id; });
      return f ? (f.value || '') : '';
    }

    function setFieldValue(id, value) {
      if (!value && SELECT_DEFAULTS[id]) {
        value = SELECT_DEFAULTS[id];
      }
      const existing = t.versionInfo.fields.find(function(x) { return x.id === id; });
      if (!value) {
        t.versionInfo.fields = t.versionInfo.fields.filter(function(x) { return x.id !== id; });
      } else if (existing) {
        existing.value = value;
      } else {
        t.versionInfo.fields.push({ id: id, value: value });
      }
      markViDirty();
    }

    function markViDirty() {
      if (!t.meta) t.meta = {};
      if (!t.meta.presentNodes) t.meta.presentNodes = {};
      t.meta.presentNodes.versioninfo = true;
      setDirtyModel(true);
    }

    const enabled   = !!t.versionInfo.enabled;
    const chk       = enabled ? 'checked' : '';
    const dis       = enabled ? '' : 'disabled';

    let html = '';
    html += '<div class="grid2" style="margin-bottom:10px;">';
    html += '<label>Enable Version Info</label>';
    html += '<input id="viEnable" type="checkbox" ' + chk + ' />';
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
    for (let i = 0; i < FIXED_FIELDS.length; i++) {
      const fd  = FIXED_FIELDS[i];
      const val = esc(getFieldValue(fd.id));
      html += '<label>' + esc(fd.label) + '</label>';
      if (fd.type === 'select') {
        html += '<select id="vi_' + fd.id + '" ' + dis + '>';
        for (let j = 0; j < fd.options.length; j++) {
          const currentVal = getFieldValue(fd.id) || SELECT_DEFAULTS[fd.id] || '';
          const selAttr = currentVal === fd.options[j] ? 'selected' : '';;
          const optLabel = fd.options[j] || '(none)';
          html += '<option value="' + esc(fd.options[j]) + '" ' + selAttr + '>' + esc(optLabel) + '</option>';
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

    // --- Enable toggle (re-renders entire panel) ---
    $('viEnable').addEventListener('change', function(e) {
      t.versionInfo.enabled = e.target.checked;
      markViDirty();
      renderTargetVersionInfo(container, t);
    });

    // --- Fixed field bindings ---
    for (let fi = 0; fi < FIXED_FIELDS.length; fi++) {
      (function(fd) {
        const el = document.getElementById('vi_' + fd.id);
        if (!el) return;
        const evtName = fd.type === 'select' ? 'change' : 'input';
        el.addEventListener(evtName, function(e) {
          setFieldValue(fd.id, e.target.value);
        });
      })(FIXED_FIELDS[fi]);
    }

    // --- Custom fields (field18+) ---
    function isCustomField(f) {
      const m = f.id.match(/^field(\d+)$/);
      return !m || parseInt(m[1], 10) >= 18;
    }

    function rebuildCustom() {
      const tbody = $('viCustomRows');
      tbody.innerHTML = '';
      const custom = t.versionInfo.fields.filter(isCustomField);

      if (custom.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="3"><em>No custom fields.</em></td>';
        tbody.appendChild(tr);
      }

      for (let ci = 0; ci < custom.length; ci++) {
        const cf       = custom[ci];
        const gidx     = t.versionInfo.fields.indexOf(cf);
        const disAttr  = enabled ? '' : 'disabled';
        const tr       = document.createElement('tr');
        tr.innerHTML =
          '<td><input type="text" data-gidx="' + gidx + '" data-k="id"  value="' + esc(cf.id)    + '" ' + disAttr + ' /></td>' +
          '<td><input type="text" data-gidx="' + gidx + '" data-k="val" value="' + esc(cf.value) + '" ' + disAttr + ' /></td>' +
          '<td><button class="btn" data-gidx="' + gidx + '" ' + disAttr + '>Remove</button></td>';
        tbody.appendChild(tr);
      }

      for (const inp of tbody.querySelectorAll('input[type="text"]')) {
        inp.addEventListener('input', function(e) {
          const gidx = parseInt(e.target.dataset.gidx, 10);
          const k    = e.target.dataset.k;
          if (k === 'id')  t.versionInfo.fields[gidx].id    = e.target.value;
          if (k === 'val') t.versionInfo.fields[gidx].value = e.target.value;
          markViDirty();
        });
      }

      for (const btn of tbody.querySelectorAll('button[data-gidx]')) {
        btn.addEventListener('click', function(e) {
          const gidx = parseInt(e.target.dataset.gidx, 10);
          t.versionInfo.fields.splice(gidx, 1);
          markViDirty();
          rebuildCustom();
        });
      }
    }

    $('viAddCustom').addEventListener('click', function() {
      let nextId = 18;
      while (t.versionInfo.fields.some(function(f) { return f.id === 'field' + nextId; })) {
        nextId++;
      }
      t.versionInfo.fields.push({ id: 'field' + nextId, value: '' });
      markViDirty();
      rebuildCustom();
    });

    rebuildCustom();
  }

  function renderTargetResources(container, t) {
    if (!t.resources) t.resources = [];

    container.innerHTML = \`
      <div class="btnrow" style="margin-bottom:8px;">
        <button class="btn" id="resAdd">Add</button>
      </div>
      <table>
        <thead><tr><th>Resource</th><th style="width:80px"></th></tr></thead>
        <tbody id="resRows"></tbody>
      </table>
    \`;

    function rebuild() {
      const tbody = $('resRows');
      tbody.innerHTML = '';
      for (let i = 0; i < t.resources.length; i++) {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td><input type="text" data-idx="\${i}" value="\${esc(t.resources[i])}"></td>
          <td><button class="btn" data-del="\${i}">Remove</button></td>
        \`;
        tbody.appendChild(tr);
      }
      if (t.resources.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = \`<td colspan="2"><em>No resources.</em></td>\`;
        tbody.appendChild(tr);
      }

      for (const inp of tbody.querySelectorAll('input')) {
        inp.addEventListener('input', (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          t.resources[idx] = e.target.value;
          if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.resources = true;
          setDirtyModel(true);
        });
      }

      for (const btn of tbody.querySelectorAll('button[data-del]')) {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.del, 10);
          t.resources.splice(idx, 1);
          if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.resources = true;
          setDirtyModel(true);
          rebuild();
        });
      }
    }

    $('resAdd').addEventListener('click', () => {
      t.resources.push('');
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.resources = true;
      setDirtyModel(true);
      rebuild();
    });

    rebuild();
  }

  function renderTargetWatchlist(container, t) {
    container.innerHTML = \`
      <div class="grid2">
        <label>Watchlist</label>
        <textarea id="watchText"></textarea>
      </div>
    \`;

    $('watchText').value = t.watchList ?? '';
    $('watchText').addEventListener('input', (e) => {
      t.watchList = e.target.value;
      if (!t.meta) t.meta = {}; if (!t.meta.presentNodes) t.meta.presentNodes = {}; t.meta.presentNodes.watchlist = true;
      setDirtyModel(true);
    });
  }

  function renderTargets() {
    const el = $('page-targets');
    el.innerHTML = '';

    if (!ensureProject()) {
      el.innerHTML = \`<div class="panel">No project model available.</div>\`;
      return;
    }

    const targets = getTargets();
    if (targets.length === 0) {
      el.innerHTML = \`<div class="panel"><em>No targets found.</em></div>\`;
      return;
    }

    const row = document.createElement('div');
    row.className = 'row';

    const left = document.createElement('div');
    left.className = 'panel';
    left.innerHTML = \`
      <div class="muted" style="margin-bottom:6px;">Compile targets</div>
      <select id="targetSelect"></select>
      <div style="margin-top:10px;">
        <label><input type="checkbox" id="tIsDefault" style="margin-right:6px;">Set as default target</label>
      </div>
      <div style="margin-top:6px;">
        <label><input type="checkbox" id="tEnabled" style="margin-right:6px;">Enable in 'Build all Targets'</label>
      </div>
    \`;

    row.appendChild(left);

    const right = document.createElement('div');
    right.className = 'panel';
    row.appendChild(right);

    el.appendChild(row);

    const sel = $('targetSelect');
    sel.innerHTML = '';
    targets.forEach((t, i) => {
      const opt = document.createElement('option');
      const flags = \`\${t.enabled ? '' : ' (disabled)'}\${t.isDefault ? ' [default]' : ''}\`;
      opt.value = String(i);
      opt.textContent = (t.name || ('Target ' + (i+1))) + flags;
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

    $('tIsDefault').checked = !!t.isDefault;
    $('tEnabled').checked = !!t.enabled;

    $('tIsDefault').addEventListener('change', (e) => {
      t.isDefault = e.target.checked;
      const opt = sel.options[state.activeTargetIndex];
      if (opt) {
        const flags = \`\${t.enabled ? '' : ' (disabled)'}\${t.isDefault ? ' [default]' : ''}\`;
        opt.textContent = (t.name || ('Target ' + (state.activeTargetIndex + 1))) + flags;
      }
      setDirtyModel(true);
    });

    $('tEnabled').addEventListener('change', (e) => {
      t.enabled = e.target.checked;
      const opt = sel.options[state.activeTargetIndex];
      if (opt) {
        const flags = \`\${t.enabled ? '' : ' (disabled)'}\${t.isDefault ? ' [default]' : ''}\`;
        opt.textContent = (t.name || ('Target ' + (state.activeTargetIndex + 1))) + flags;
      }
      setDirtyModel(true);
    });


    const head = document.createElement('div');
    head.className = 'muted';
    head.style.marginBottom = '8px';
    head.textContent = \`Target: \${t.name}\`;
    right.appendChild(head);

    renderTargetSubTabs(right, t);
  }

  function renderXml() {
    const el = $('page-xml');
    el.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = \`
      <div class="muted" style="margin-bottom:8px;">Raw XML view is read-only. Use the structured tabs to make changes.</div>
      <textarea id="xmlText" style="min-height: 480px;" readonly></textarea>
    \`;
    el.appendChild(panel);

    const ta = $('xmlText');
    ta.value = state.xml ?? '';
    // editing XML directly is disabled for now. If we enable this, we need to make sure to update the structured view on every change, which can be tricky and cause performance issues.
    // ta.addEventListener('input', () => {
    //  state.xml = ta.value;
    //  setDirtyXml(true);
    //});
  }

  function renderAll() {
    renderStatus();
    renderProjectOptions();
    renderFiles();
    renderTargets();
    renderLibraries();
    renderXml();
  }

  // Toolbar actions
  $('btnSave').addEventListener('click', () => {
    if (!state.project) return;
    vscode.postMessage({ type: 'saveModel', project: state.project });
  });
  $('btnSaveXml').addEventListener('click', () => {
    vscode.postMessage({ type: 'saveXml', xml: state.xml ?? '' });
  });

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'state') {
      // Only replace state if user did not change it locally.
      if (!state.dirtyModel) {
        state.project = msg.project;
        state.errorText = msg.errorText;
      }
      if (!state.dirtyXml) {
        state.xml = msg.xml;
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
      if (typeof window._filePickedHandler === 'function') {
        window._filePickedHandler(msg.rawPath, msg.fsPath);
      }
    }
  });

  bindTabs();
  renderAll();

  </script>
</body>
</html>`;
}

export class PbpEditorProvider implements vscode.CustomTextEditorProvider {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new PbpEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(PBP_EDITOR_VIEW_TYPE, provider, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: false,
        });
    }

    public constructor(private readonly context: vscode.ExtensionContext) {
        void context;
    }

    public async resolveCustomTextEditor(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };

        const update = () => {
            const xml = document.getText();
            let project: PbpProject | null = null;
            let errorText: string | undefined;
            try {
                project = parsePbpProjectText(xml, document.uri.fsPath);
            } catch (err: any) {
                errorText = err?.message ?? String(err);
            }

            webviewPanel.webview.html = renderHtml(webviewPanel.webview, document, project, xml, errorText);
        };

        update();

        // Keep webview in sync if the user edits the text directly.
        const docChangeSub = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() !== document.uri.toString()) return;
            const xml = document.getText();
            let project: PbpProject | null = null;
            let errorText: string | undefined;
            try {
                project = parsePbpProjectText(xml, document.uri.fsPath);
            } catch (err: any) {
                errorText = err?.message ?? String(err);
            }
            void webviewPanel.webview.postMessage({ type: 'state', xml, project, errorText: errorText ?? null });
        });

        webviewPanel.onDidDispose(() => docChangeSub.dispose());

        webviewPanel.webview.onDidReceiveMessage(async (msg: any) => {
            if (!msg || typeof msg.type !== 'string') return;

            if (msg.type === 'saveModel') {
                const model = msg.project as PbpProject;
                const xml = writePbpProjectText(model);
                await replaceDocumentText(document, xml);
                await document.save();
                void webviewPanel.webview.postMessage({ type: 'saved', errorText: null });
                return;
            }

            if (msg.type === 'saveXml') {
                const xml = String(msg.xml ?? '');
                // Validate parse before applying.
                let errorText: string | null = null;
                try {
                    parsePbpProjectText(xml, document.uri.fsPath);
                } catch (err: any) {
                    errorText = err?.message ?? String(err);
                }

                if (errorText) {
                    void webviewPanel.webview.postMessage({ type: 'saved', errorText });
                    return;
                }

                await replaceDocumentText(document, xml);
                await document.save();
                void webviewPanel.webview.postMessage({ type: 'saved', errorText: null });
                return;
            }

            if (msg.type === 'pickFile') {
                const projectDir = path.dirname(document.uri.fsPath);
                const uris = await vscode.window.showOpenDialog({
                    canSelectMany: false,
                    defaultUri: vscode.Uri.file(projectDir),
                    filters: { 'PureBasic Files': ['pb', 'pbi', 'pbf', 'pbh'] },
                });
                if (!uris || uris.length === 0) return;
                const picked = uris[0];
                const rel = path.relative(projectDir, picked.fsPath);
                // Use absolute path for files outside the project root (PureBasic IDE behavior).
                const isExternal = rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel);
                const rawPath = isExternal ? picked.fsPath : rel;
                void webviewPanel.webview.postMessage({
                    type: 'filePicked',
                    rawPath,
                    fsPath: picked.fsPath,
                });
                return;
            }
        });
    }
}

async function replaceDocumentText(document: vscode.TextDocument, text: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    const lastLine = document.lineAt(document.lineCount - 1);
    const fullRange = new vscode.Range(0, 0, document.lineCount - 1, lastLine.text.length);
    edit.replace(document.uri, fullRange, text);
    await vscode.workspace.applyEdit(edit);
}