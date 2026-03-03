/*
    Provides a custom editor for PureBasic .pbp project files.

    Note:
    - This editor intentionally uses an explicit "Save" button.
    - It does not integrate with VS Code's undo/redo or dirty tracking yet.
*/

import * as vscode from 'vscode';

import {
    parsePbpProjectText,
    writePbpProjectText,
    type PbpProject,
} from '@caldymos/pb-project-core';

export const PBP_EDITOR_VIEW_TYPE = 'pbProjectFiles.pbpEditor';

class PbpDocument implements vscode.CustomDocument {
    public constructor(public readonly uri: vscode.Uri) {}

    public dispose(): void {
        // No resources to release.
    }
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getNonce(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < 32; i++) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
}

function renderShellHtml(title: string, nonce: string): string {
    // Keep this HTML intentionally small; the actual UI is rendered by the inline script.
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-editor-background); margin: 0; padding: 0; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--vscode-editorWidget-border); }
    .title { font-size: 13px; opacity: 0.9; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-button-border); padding: 6px 10px; border-radius: 4px; cursor: pointer; }
    button:disabled { opacity: 0.6; cursor: default; }
    .tabs { display: flex; gap: 6px; padding: 10px 12px; border-bottom: 1px solid var(--vscode-editorWidget-border); flex-wrap: wrap; }
    .tab { padding: 6px 10px; border-radius: 4px; border: 1px solid var(--vscode-editorWidget-border); background: var(--vscode-editorWidget-background); cursor: pointer; user-select: none; }
    .tab.active { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border-color: var(--vscode-button-border); }
    .content { padding: 12px; }
    .row { display: grid; grid-template-columns: 180px 1fr; gap: 8px 12px; margin-bottom: 10px; align-items: center; }
    .row label { opacity: 0.9; }
    input[type="text"], textarea, select { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 6px 8px; border-radius: 4px; }
    textarea { min-height: 80px; resize: vertical; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid var(--vscode-editorWidget-border); padding: 6px 8px; text-align: left; }
    th { background: var(--vscode-editorWidget-background); }
    .split { display: grid; grid-template-columns: 220px 1fr; gap: 12px; }
    .list { border: 1px solid var(--vscode-editorWidget-border); border-radius: 4px; overflow: hidden; }
    .list-item { padding: 6px 8px; border-bottom: 1px solid var(--vscode-editorWidget-border); cursor: pointer; }
    .list-item:last-child { border-bottom: none; }
    .list-item.active { background: var(--vscode-editorWidget-background); }
    .muted { opacity: 0.8; }
    .h2 { font-size: 13px; margin: 0 0 10px; opacity: 0.9; }
    .btn-row { display: flex; gap: 8px; margin: 10px 0; }
    .danger { background: var(--vscode-inputValidation-errorBackground); color: var(--vscode-inputValidation-errorForeground); border-color: var(--vscode-inputValidation-errorBorder); }
    .mono { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="title">${escapeHtml(title)}</div>
    <div style="display:flex; gap:8px; align-items:center;">
      <span id="status" class="muted"></span>
      <button id="saveBtn" disabled>Save</button>
    </div>
  </div>
  <div class="tabs" id="tabs"></div>
  <div class="content" id="content"></div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    const tabs = [
      { id: 'project', label: 'Project Options' },
      { id: 'files', label: 'Project Files' },
      { id: 'targets', label: 'Targets' },
      { id: 'libraries', label: 'Libraries' },
      { id: 'raw', label: 'Raw XML' },
    ];

    let activeTab = 'project';
    let activeTargetIdx = 0;

    /** @type {any} */
    let state = { project: null, xml: '' };

    let isDirty = false;
    let isRawDirty = false;

    const elTabs = document.getElementById('tabs');
    const elContent = document.getElementById('content');
    const elSaveBtn = document.getElementById('saveBtn');
    const elStatus = document.getElementById('status');

    function setDirty(dirty) {
      isDirty = dirty;
      elSaveBtn.disabled = !(isDirty || isRawDirty);
      elStatus.textContent = (isDirty || isRawDirty) ? 'Unsaved changes' : '';
    }

    function setRawDirty(dirty) {
      isRawDirty = dirty;
      elSaveBtn.disabled = !(isDirty || isRawDirty);
      elStatus.textContent = (isDirty || isRawDirty) ? 'Unsaved changes' : '';
    }

    function renderTabs() {
      elTabs.innerHTML = '';
      for (const t of tabs) {
        const div = document.createElement('div');
        div.className = 'tab' + (t.id === activeTab ? ' active' : '');
        div.textContent = t.label;
        div.addEventListener('click', () => { activeTab = t.id; render(); });
        elTabs.appendChild(div);
      }
    }

    function h(tag, attrs = {}, ...children) {
      const el = document.createElement(tag);
      for (const [k,v] of Object.entries(attrs)) {
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.substring(2).toLowerCase(), v);
        else el.setAttribute(k, v);
      }
      for (const c of children) {
        if (c == null) continue;
        if (typeof c === 'string') el.appendChild(document.createTextNode(c));
        else el.appendChild(c);
      }
      return el;
    }

    function renderProjectOptions() {
      const p = state.project;
      if (!p) return h('div', { class: 'muted', text: 'No project loaded.' });

      const root = h('div');
      root.appendChild(h('div', { class: 'h2', text: 'Project Info' }));

      const nameInput = h('input', { type: 'text', value: p.config?.name ?? '' });
      nameInput.addEventListener('input', () => { p.config.name = nameInput.value; setDirty(true); });

      const commentArea = h('textarea', {}, p.config?.comment ?? '');
      commentArea.addEventListener('input', () => { p.config.comment = commentArea.value; setDirty(true); });

      const closeFiles = h('input', { type: 'checkbox' });
      closeFiles.checked = !!p.config?.closefiles;
      closeFiles.addEventListener('change', () => { p.config.closefiles = closeFiles.checked; setDirty(true); });

      const openModeSel = h('select');
      openModeSel.appendChild(h('option', { value: '0', text: 'Load sources open last time' }));
      openModeSel.appendChild(h('option', { value: '1', text: 'Load all project sources' }));
      openModeSel.appendChild(h('option', { value: '2', text: 'Load only sources marked in Project Files' }));
      openModeSel.appendChild(h('option', { value: '3', text: 'Load only main file of default target' }));
      openModeSel.appendChild(h('option', { value: '4', text: 'Load no files' }));
      openModeSel.value = String(p.config?.openmode ?? 0);
      openModeSel.addEventListener('change', () => { p.config.openmode = parseInt(openModeSel.value, 10) || 0; setDirty(true); });

      root.appendChild(h('div', { class: 'row' }, h('label', { text: 'Project name' }), nameInput));
      root.appendChild(h('div', { class: 'row' }, h('label', { text: 'Comments' }), commentArea));
      root.appendChild(h('div', { class: 'row' }, h('label', { text: 'Close all sources on close' }), closeFiles));
      root.appendChild(h('div', { class: 'row' }, h('label', { text: 'Open mode' }), openModeSel));

      return root;
    }

    function renderProjectFiles() {
      const p = state.project;
      if (!p) return h('div', { class: 'muted', text: 'No project loaded.' });

      const table = h('table');
      const thead = h('thead');
      thead.appendChild(h('tr', {},
        h('th', { text: 'File' }),
        h('th', { text: 'Load' }),
        h('th', { text: 'Scan' }),
        h('th', { text: 'Panel' }),
        h('th', { text: 'Warn' }),
      ));
      table.appendChild(thead);

      const tbody = h('tbody');
      for (const f of (p.files ?? [])) {
        const cfg = f.config ?? (f.config = {});
        function mkCb(key) {
          const cb = h('input', { type: 'checkbox' });
          cb.checked = !!cfg[key];
          cb.addEventListener('change', () => { cfg[key] = cb.checked; setDirty(true); });
          return cb;
        }

        const tr = h('tr', {},
          h('td', { text: f.rawPath ?? '' }),
          h('td', {}, mkCb('load')),
          h('td', {}, mkCb('scan')),
          h('td', {}, mkCb('panel')),
          h('td', {}, mkCb('warn')),
        );
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);

      const note = h('div', { class: 'muted', text: 'Note: Additional per-file fields like sortindex/panelstate/fingerprint are preserved in the parsed model (meta), but are not fully edited yet.' });

      return h('div', {}, table, h('div', { style: 'height: 10px;' }), note);
    }

    function renderTargets() {
      const p = state.project;
      if (!p) return h('div', { class: 'muted', text: 'No project loaded.' });

      const targets = p.targets ?? [];
      if (targets.length === 0) return h('div', { class: 'muted', text: 'No targets found.' });

      if (activeTargetIdx < 0 || activeTargetIdx >= targets.length) activeTargetIdx = 0;
      const cur = targets[activeTargetIdx];

      const left = h('div', { class: 'list' });
      targets.forEach((t, idx) => {
        const item = h('div', { class: 'list-item' + (idx === activeTargetIdx ? ' active' : ''), text: t.name ?? '(unnamed)' });
        item.addEventListener('click', () => { activeTargetIdx = idx; render(); });
        left.appendChild(item);
      });

      const right = h('div');
      right.appendChild(h('div', { class: 'h2', text: 'Compiler Options' }));

      // options checkboxes
      const optContainer = h('div');
      const optKeys = Object.keys(cur.optionAttrs ?? cur.options ?? {}).sort();
      if (!cur.optionAttrs) cur.optionAttrs = {};

      function readBoolFromOption(key) {
        const raw = cur.optionAttrs[key];
        if (raw === '1' || raw === 'true' || raw === 'yes') return true;
        if (raw === '0' || raw === 'false' || raw === 'no') return false;
        return !!(cur.options && cur.options[key]);
      }

      for (const k of optKeys) {
        const cb = h('input', { type: 'checkbox' });
        cb.checked = readBoolFromOption(k);
        cb.addEventListener('change', () => {
          cur.options = cur.options ?? {};
          cur.options[k] = cb.checked;
          cur.optionAttrs[k] = cb.checked ? '1' : '0';
          setDirty(true);
        });
        optContainer.appendChild(h('div', { class: 'row' }, h('label', { text: k }), cb));
      }

      if (optKeys.length === 0) {
        optContainer.appendChild(h('div', { class: 'muted', text: 'No target options found.' }));
      }

      right.appendChild(optContainer);

      // Purifier
      right.appendChild(h('div', { class: 'h2', text: 'Purifier' }));
      const purifierEnabled = h('input', { type: 'checkbox' });
      purifierEnabled.checked = !!cur.purifier?.enabled;
      purifierEnabled.addEventListener('change', () => {
        cur.purifier = cur.purifier ?? { enabled: false };
        cur.purifier.enabled = purifierEnabled.checked;
        setDirty(true);
      });

      const purifierGran = h('input', { type: 'text', value: cur.purifier?.granularity ?? '' });
      purifierGran.addEventListener('input', () => {
        cur.purifier = cur.purifier ?? { enabled: false };
        cur.purifier.granularity = purifierGran.value;
        setDirty(true);
      });

      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Enable Purifier' }), purifierEnabled));
      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Granularity' }), purifierGran));

      // Warnings
      right.appendChild(h('div', { class: 'h2', text: 'Warnings' }));
      const warnCustom = h('input', { type: 'checkbox' });
      warnCustom.checked = !!cur.warnings?.custom;
      warnCustom.addEventListener('change', () => {
        cur.warnings = cur.warnings ?? {};
        cur.warnings.custom = warnCustom.checked;
        setDirty(true);
      });

      const warnType = h('input', { type: 'text', value: cur.warnings?.type ?? '' });
      warnType.addEventListener('input', () => {
        cur.warnings = cur.warnings ?? {};
        cur.warnings.type = warnType.value;
        setDirty(true);
      });

      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Custom warnings' }), warnCustom));
      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Type' }), warnType));

      right.appendChild(h('div', { class: 'h2', text: 'Compile/Run' }));

      const inFile = h('input', { type: 'text', value: cur.inputFile?.rawPath ?? '' });
      inFile.addEventListener('input', () => { cur.inputFile.rawPath = inFile.value; setDirty(true); });

      const outFile = h('input', { type: 'text', value: cur.outputFile?.rawPath ?? '' });
      outFile.addEventListener('input', () => { cur.outputFile.rawPath = outFile.value; setDirty(true); });

      const dir = h('input', { type: 'text', value: cur.directory ?? '' });
      dir.addEventListener('input', () => { cur.directory = dir.value; setDirty(true); });

      const cmd = h('input', { type: 'text', value: cur.commandLine ?? '' });
      cmd.addEventListener('input', () => { cur.commandLine = cmd.value; setDirty(true); });

      const tempExe = h('input', { type: 'text', value: cur.temporaryExe ?? '' });
      tempExe.addEventListener('input', () => { cur.temporaryExe = tempExe.value; setDirty(true); });

      // Executable
      cur.executable = cur.executable ?? { rawPath: '', fsPath: '' };
      const exe = h('input', { type: 'text', value: cur.executable?.rawPath ?? '' });
      exe.addEventListener('input', () => { cur.executable.rawPath = exe.value; setDirty(true); });

      // Icon
      cur.icon = cur.icon ?? { enabled: false, rawPath: '', fsPath: '' };
      const iconEnabled = h('input', { type: 'checkbox' });
      iconEnabled.checked = !!cur.icon.enabled;
      iconEnabled.addEventListener('change', () => { cur.icon.enabled = iconEnabled.checked; setDirty(true); });

      const iconPath = h('input', { type: 'text', value: cur.icon.rawPath ?? '' });
      iconPath.addEventListener('input', () => { cur.icon.rawPath = iconPath.value; setDirty(true); });

      // Counters
      const ccEnabled = h('input', { type: 'checkbox' });
      ccEnabled.checked = !!cur.compileCount?.enabled;
      ccEnabled.addEventListener('change', () => {
        cur.compileCount = cur.compileCount ?? { enabled: false };
        cur.compileCount.enabled = ccEnabled.checked;
        setDirty(true);
      });

      const ccValue = h('input', { type: 'text', value: String(cur.compileCount?.value ?? '') });
      ccValue.addEventListener('input', () => {
        cur.compileCount = cur.compileCount ?? { enabled: false };
        const v = ccValue.value.trim();
        cur.compileCount.value = v ? (parseInt(v, 10) || 0) : undefined;
        setDirty(true);
      });

      const bcEnabled = h('input', { type: 'checkbox' });
      bcEnabled.checked = !!cur.buildCount?.enabled;
      bcEnabled.addEventListener('change', () => {
        cur.buildCount = cur.buildCount ?? { enabled: false };
        cur.buildCount.enabled = bcEnabled.checked;
        setDirty(true);
      });

      const bcValue = h('input', { type: 'text', value: String(cur.buildCount?.value ?? '') });
      bcValue.addEventListener('input', () => {
        cur.buildCount = cur.buildCount ?? { enabled: false };
        const v = bcValue.value.trim();
        cur.buildCount.value = v ? (parseInt(v, 10) || 0) : undefined;
        setDirty(true);
      });

      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Input file' }), inFile));
      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Output file' }), outFile));
      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Executable' }), exe));
      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Target directory' }), dir));
      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Command line' }), cmd));
      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Temporary EXE (value)' }), tempExe));

      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Icon enabled' }), iconEnabled));
      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Icon file' }), iconPath));

      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'CompileCount enabled' }), ccEnabled));
      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'CompileCount value' }), ccValue));

      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'BuildCount enabled' }), bcEnabled));
      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'BuildCount value' }), bcValue));

      right.appendChild(h('div', { class: 'h2', text: 'Constants' }));

      const constBox = h('div');
      cur.constants = cur.constants ?? [];

      function renderConstants() {
        constBox.innerHTML = '';
        if (cur.constants.length === 0) {
          constBox.appendChild(h('div', { class: 'muted', text: 'No constants.' }));
        }
        cur.constants.forEach((c, idx) => {
          const en = h('input', { type: 'checkbox' });
          en.checked = !!c.enabled;
          en.addEventListener('change', () => { c.enabled = en.checked; setDirty(true); });

          const val = h('input', { type: 'text', value: c.value ?? '' });
          val.addEventListener('input', () => { c.value = val.value; setDirty(true); });

          const del = h('button', { class: 'danger', text: 'Remove' });
          del.addEventListener('click', () => { cur.constants.splice(idx, 1); setDirty(true); renderConstants(); });

          const row = h('div', { class: 'row' }, h('label', { text: 'Enabled' }), en);
          const row2 = h('div', { class: 'row' }, h('label', { text: 'Value' }), val);
          constBox.appendChild(row);
          constBox.appendChild(row2);
          constBox.appendChild(h('div', { class: 'btn-row' }, del));
          constBox.appendChild(h('div', { style: 'height: 8px;' }));
        });
      }

      const addBtn = h('button', { text: 'Add constant' });
      addBtn.addEventListener('click', () => {
        cur.constants.push({ enabled: true, value: '' });
        setDirty(true);
        renderConstants();
      });

      right.appendChild(h('div', { class: 'btn-row' }, addBtn));
      right.appendChild(constBox);
      renderConstants();

      // Version Info
      right.appendChild(h('div', { class: 'h2', text: 'Version Info' }));
      const viEnabled = h('input', { type: 'checkbox' });
      viEnabled.checked = !!cur.versionInfo?.enabled;
      viEnabled.addEventListener('change', () => {
        cur.versionInfo = cur.versionInfo ?? { enabled: false, fields: [] };
        cur.versionInfo.enabled = viEnabled.checked;
        setDirty(true);
        renderVersionInfo();
      });

      const viBox = h('div');
      function renderVersionInfo() {
        viBox.innerHTML = '';

        const fields = cur.versionInfo?.fields ?? [];
        if (fields.length === 0) {
          viBox.appendChild(h('div', { class: 'muted', text: 'No version fields.' }));
        }

        fields.forEach((f, idx) => {
          const id = h('input', { type: 'text', value: f.id ?? '' });
          id.addEventListener('input', () => { f.id = id.value; setDirty(true); });

          const val = h('input', { type: 'text', value: f.value ?? '' });
          val.addEventListener('input', () => { f.value = val.value; setDirty(true); });

          const del = h('button', { class: 'danger', text: 'Remove' });
          del.addEventListener('click', () => { fields.splice(idx, 1); setDirty(true); renderVersionInfo(); });

          viBox.appendChild(h('div', { class: 'row' }, h('label', { text: 'Field id' }), id));
          viBox.appendChild(h('div', { class: 'row' }, h('label', { text: 'Value' }), val));
          viBox.appendChild(h('div', { class: 'btn-row' }, del));
          viBox.appendChild(h('div', { style: 'height: 8px;' }));
        });
      }

      const addVi = h('button', { text: 'Add field' });
      addVi.addEventListener('click', () => {
        cur.versionInfo = cur.versionInfo ?? { enabled: false, fields: [] };
        cur.versionInfo.fields.push({ id: 'field0', value: '' });
        setDirty(true);
        renderVersionInfo();
      });

      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Enable Version Info' }), viEnabled));
      right.appendChild(h('div', { class: 'btn-row' }, addVi));
      right.appendChild(viBox);
      renderVersionInfo();

      // Resources
      right.appendChild(h('div', { class: 'h2', text: 'Resources' }));
      cur.resources = cur.resources ?? { items: [] };
      cur.resources.items = cur.resources.items ?? [];

      const resBox = h('div');
      function renderResources() {
        resBox.innerHTML = '';
        if (cur.resources.items.length === 0) {
          resBox.appendChild(h('div', { class: 'muted', text: 'No resources.' }));
        }
        cur.resources.items.forEach((r, idx) => {
          const val = h('input', { type: 'text', value: r ?? '' });
          val.addEventListener('input', () => { cur.resources.items[idx] = val.value; setDirty(true); });
          const del = h('button', { class: 'danger', text: 'Remove' });
          del.addEventListener('click', () => { cur.resources.items.splice(idx, 1); setDirty(true); renderResources(); });
          resBox.appendChild(h('div', { class: 'row' }, h('label', { text: 'Resource' }), val));
          resBox.appendChild(h('div', { class: 'btn-row' }, del));
          resBox.appendChild(h('div', { style: 'height: 8px;' }));
        });
      }

      const resNew = h('input', { type: 'text', value: '' });
      const resAdd = h('button', { text: 'Add resource' });
      resAdd.addEventListener('click', () => {
        const v = resNew.value.trim();
        if (!v) return;
        cur.resources.items.push(v);
        resNew.value = '';
        setDirty(true);
        renderResources();
      });

      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'New resource' }), h('div', {}, resNew, h('div', { style: 'height: 6px;' }), resAdd)));
      right.appendChild(resBox);
      renderResources();

      // Watchlist
      right.appendChild(h('div', { class: 'h2', text: 'Watchlist' }));
      const wl = h('input', { type: 'text', value: cur.watchList ?? '' });
      wl.addEventListener('input', () => { cur.watchList = wl.value; setDirty(true); });
      right.appendChild(h('div', { class: 'row' }, h('label', { text: 'Watchlist item(s)' }), wl));

      return h('div', { class: 'split' }, left, right);
    }

    function renderLibraries() {
      const p = state.project;
      if (!p) return h('div', { class: 'muted', text: 'No project loaded.' });

      p.libraries = p.libraries ?? [];

      const list = h('div', { class: 'list' });
      p.libraries.forEach((lib, idx) => {
        const item = h('div', { class: 'list-item', text: lib });
        item.addEventListener('click', () => {
          if (!confirm('Remove library?')) return;
          p.libraries.splice(idx, 1);
          setDirty(true);
          render();
        });
        list.appendChild(item);
      });

      const input = h('input', { type: 'text', value: '' });
      const add = h('button', { text: 'Add' });
      add.addEventListener('click', () => {
        const v = input.value.trim();
        if (!v) return;
        p.libraries.push(v);
        input.value = '';
        setDirty(true);
        render();
      });

      return h('div', {},
        h('div', { class: 'row' }, h('label', { text: 'New library' }), h('div', {}, input, h('div', { style: 'height: 6px;' }), add)),
        h('div', { style: 'height: 10px;' }),
        list,
        h('div', { class: 'muted', text: 'Click a library entry to remove it.' }),
      );
    }

    function renderRawXml() {
      const ta = h('textarea', { class: 'mono' }, state.xml ?? '');
      ta.addEventListener('input', () => {
        state.xml = ta.value;
        setRawDirty(true);
      });

      const note = h('div', { class: 'muted', text: 'Editing raw XML bypasses the structured writer. Use with care.' });

      return h('div', {}, ta, h('div', { style: 'height: 10px;' }), note);
    }

    function render() {
      renderTabs();

      elContent.innerHTML = '';

      if (activeTab === 'project') elContent.appendChild(renderProjectOptions());
      else if (activeTab === 'files') elContent.appendChild(renderProjectFiles());
      else if (activeTab === 'targets') elContent.appendChild(renderTargets());
      else if (activeTab === 'libraries') elContent.appendChild(renderLibraries());
      else if (activeTab === 'raw') elContent.appendChild(renderRawXml());
    }

    elSaveBtn.addEventListener('click', () => {
      if (!state.project) return;

      if (isRawDirty) {
        vscode.postMessage({ type: 'saveXml', xml: state.xml });
        setRawDirty(false);
        setDirty(false);
        return;
      }

      vscode.postMessage({ type: 'saveModel', project: state.project });
      setDirty(false);
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'init') {
        state.project = msg.project;
        state.xml = msg.xml;
        setDirty(false);
        setRawDirty(false);
        render();
      }
      if (msg.type === 'saved') {
        setDirty(false);
        setRawDirty(false);
        elStatus.textContent = msg.message || '';
        setTimeout(() => { if (!(isDirty || isRawDirty)) elStatus.textContent = ''; }, 2000);
      }
      if (msg.type === 'error') {
        elStatus.textContent = msg.message || 'Error';
      }
    });

    renderTabs();

    // Request init from extension.
    vscode.postMessage({ type: 'ready' });
  </script>
</body>
</html>`;
}

export class PbpEditorProvider implements vscode.CustomReadonlyEditorProvider<PbpDocument> {
    public static register(context: vscode.ExtensionContext, onDidSave?: () => Promise<void>): vscode.Disposable {
        const provider = new PbpEditorProvider(context, onDidSave);
        return vscode.window.registerCustomEditorProvider(PBP_EDITOR_VIEW_TYPE, provider, {
            webviewOptions: { retainContextWhenHidden: true },
            supportsMultipleEditorsPerDocument: false,
        });
    }

    public constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly onDidSave?: () => Promise<void>
    ) {}

    public async openCustomDocument(uri: vscode.Uri): Promise<PbpDocument> {
        return new PbpDocument(uri);
    }

    public async resolveCustomEditor(document: PbpDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        const nonce = getNonce();

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.context.extensionUri],
        };

        const title = `PureBasic Project: ${document.uri.fsPath}`;
        webviewPanel.webview.html = renderShellHtml(title, nonce);

        const postInit = async (): Promise<void> => {
            try {
                const bytes = await vscode.workspace.fs.readFile(document.uri);
                const xml = Buffer.from(bytes).toString('utf8');
                const project = parsePbpProjectText(xml, document.uri.fsPath);
                webviewPanel.webview.postMessage({ type: 'init', project, xml });
            } catch (err: any) {
                webviewPanel.webview.postMessage({ type: 'error', message: err?.message ?? String(err) });
            }
        };

        const saveModel = async (project: PbpProject): Promise<void> => {
            const xml = writePbpProjectText(project, { newline: '\n' });
            await vscode.workspace.fs.writeFile(document.uri, Buffer.from(xml, 'utf8'));
            if (this.onDidSave) await this.onDidSave();
            webviewPanel.webview.postMessage({ type: 'saved', message: 'Saved.' });
        };

        const saveXml = async (xml: string): Promise<void> => {
            await vscode.workspace.fs.writeFile(document.uri, Buffer.from(xml ?? '', 'utf8'));
            if (this.onDidSave) await this.onDidSave();
            webviewPanel.webview.postMessage({ type: 'saved', message: 'Saved.' });
        };

        webviewPanel.webview.onDidReceiveMessage(async (msg: any) => {
            try {
                if (!msg || typeof msg !== 'object') return;
                if (msg.type === 'ready') {
                    await postInit();
                    return;
                }
                if (msg.type === 'saveModel') {
                    await saveModel(msg.project);
                    await postInit();
                    return;
                }
                if (msg.type === 'saveXml') {
                    await saveXml(msg.xml);
                    await postInit();
                    return;
                }
            } catch (err: any) {
                webviewPanel.webview.postMessage({ type: 'error', message: err?.message ?? String(err) });
            }
        });

        // Also refresh view when the document changes on disk.
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.pbp');
        const onChange = (uri: vscode.Uri) => {
            if (uri.fsPath === document.uri.fsPath) {
                void postInit();
            }
        };
        watcher.onDidChange(onChange);
        watcher.onDidCreate(onChange);
        watcher.onDidDelete(onChange);

        webviewPanel.onDidDispose(() => watcher.dispose());

        await postInit();
    }
}
