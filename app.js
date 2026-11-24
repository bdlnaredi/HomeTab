'use strict';

// ---------- Default apps (edit these from the page; ports are the usual defaults) ----------
const DEFAULTS = {
  settings: { server: '', name: '', search: 'brave', status: false },
  groups: [
    { id: 'g-media', name: 'Media', apps: [
      { id: 'a1', name: 'MediaHub', url: 'http://{server}:5080' },
      { id: 'a2', name: 'GoatMediaStackarr', url: 'http://{server}:2806' },
      { id: 'a3', name: 'Plex', url: 'http://{server}:32400/web' },
      { id: 'a4', name: 'Seerr', url: 'http://{server}:5055' },
      { id: 'a5', name: 'Tautulli', url: 'http://{server}:8181' },
      { id: 'a6', name: 'Jellyfin', url: 'http://{server}:8096' }
    ]},
    { id: 'g-dl', name: 'Downloads', apps: [
      { id: 'a7', name: 'Sonarr', url: 'http://{server}:8989' },
      { id: 'a8', name: 'Radarr', url: 'http://{server}:7878' },
      { id: 'a9', name: 'Prowlarr', url: 'http://{server}:9696' },
      { id: 'a10', name: 'qBittorrent', url: 'http://{server}:8080' }
    ]},
    { id: 'g-lib', name: 'Libraries', apps: [
      { id: 'a11', name: 'Photos', url: 'http://{server}:2283' },
      { id: 'a12', name: 'Stasharr', url: 'http://{server}:2704' }
    ]},
    { id: 'g-server', name: 'Server', apps: [
      { id: 'a13', name: 'Unraid', url: 'http://{server}' }
    ]},
    { id: 'g-sites', name: 'My sites', apps: [
      { id: 'a14', name: 'Shree Shyam Mandir', url: 'https://mandir.bdlnaredi.uk' },
      { id: 'a15', name: 'Agrawal Samaj', url: 'https://samaj.bdlnaredi.uk' }
    ]}
  ]
};

const SEARCH = {
  brave: 'https://search.brave.com/search?q=',
  ddg: 'https://duckduckgo.com/?q=',
  startpage: 'https://www.startpage.com/do/search?q='
};
const ORIGINS = { origins: ['http://*/*', 'https://*/*'] };
const KEY = 'hometab';

let state;
let editing = false;
let current = { app: null, group: null };
let statusRun = 0;

const $ = (s) => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// ---------- Storage ----------
async function load() {
  try {
    const r = await chrome.storage.local.get(KEY);
    state = valid(r[KEY]) ? r[KEY] : clone(DEFAULTS);
  } catch (e) {
    state = clone(DEFAULTS);
  }
  state.settings = Object.assign({}, DEFAULTS.settings, state.settings);
  render();
}
function save() {
  return chrome.storage.local.set({ [KEY]: state });
}
function valid(s) {
  return s && Array.isArray(s.groups) && s.groups.every((g) => g && typeof g.name === 'string' && Array.isArray(g.apps));
}

// ---------- Helpers ----------
function resolveUrl(u) {
  const server = (state.settings.server || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return u.split('{server}').join(server || 'SERVER-IP');
}
function normaliseUrl(u) {
  u = u.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = 'http://' + u;
  return u;
}
function shortUrl(u) {
  return u.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
function initials(name) {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}
function color(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 42%)`;
}

// ---------- Rendering ----------
function render() {
  document.body.classList.toggle('editing', editing);
  $('#editBtn').textContent = editing ? '✓ Done' : '✎ Edit';
  $('#banner').hidden = !!state.settings.server.trim();

  const root = $('#groups');
  root.textContent = '';

  state.groups.forEach((g) => {
    if (!editing && g.apps.length === 0) return;
    const sec = el('section', 'group');
    const head = el('div', 'group-head');
    head.append(el('h2', null, g.name));
    if (editing) {
      const ren = el('button', 'btn', 'Rename');
      ren.type = 'button';
      ren.onclick = () => openGroup(g);
      const del = el('button', 'btn danger', 'Delete group');
      del.type = 'button';
      del.onclick = () => deleteGroup(g);
      head.append(ren, del);
    }
    sec.append(head);

    const grid = el('div', 'grid');
    g.apps.forEach((a) => grid.append(tile(a, g)));
    if (editing) {
      const add = el('button', 'tile add', '+ Add app');
      add.type = 'button';
      add.onclick = () => openApp(null, g);
      grid.append(add);
    }
    sec.append(grid);
    root.append(sec);
  });

  if (state.settings.status && !editing) checkStatus();
}

function tile(a, g) {
  const url = resolveUrl(a.url);
  const t = el(editing ? 'button' : 'a', 'tile');
  if (editing) {
    t.type = 'button';
    t.title = 'Edit ' + a.name;
    t.onclick = () => openApp(a, g);
  } else {
    t.href = url;
    t.title = url;
  }

  const badge = el('div', 'badge');
  badge.style.background = color(a.name);
  if (a.icon) {
    const img = new Image();
    img.alt = '';
    img.onerror = () => { img.remove(); badge.textContent = initials(a.name); };
    img.src = a.icon;
    badge.append(img);
  } else {
    badge.textContent = initials(a.name);
  }

  const dot = el('span', 'dot');
  dot.dataset.url = url;
  t.append(badge, el('div', 'name', a.name), el('div', 'host', shortUrl(url)), dot);
  return t;
}

// ---------- Online / offline dots ----------
async function checkStatus() {
  const run = ++statusRun;
  let allowed = false;
  try { allowed = await chrome.permissions.contains(ORIGINS); } catch (e) { /* ignore */ }
  if (!allowed) return;
  document.querySelectorAll('.tile .dot').forEach(async (d) => {
    d.className = 'dot checking';
    const up = await ping(d.dataset.url);
    if (run !== statusRun) return;
    d.className = 'dot ' + (up ? 'up' : 'down');
    d.title = up ? 'Online' : 'Not reachable';
  });
}
async function ping(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    await fetch(url, { mode: 'no-cors', cache: 'no-store', credentials: 'omit', signal: ctrl.signal });
    return true; // any answer (even a login page) means the app is up
  } catch (e) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- App dialog ----------
function openApp(app, group) {
  current = { app, group };
  $('#appTitle').textContent = app ? 'Edit app' : 'Add app';
  $('#appName').value = app ? app.name : '';
  $('#appUrl').value = app ? app.url : 'http://{server}:';
  $('#appIcon').value = app && app.icon ? app.icon : '';
  const sel = $('#appGroup');
  sel.textContent = '';
  state.groups.forEach((g) => {
    const o = el('option', null, g.name);
    o.value = g.id;
    sel.append(o);
  });
  sel.value = group.id;
  $('#appDelete').hidden = !app;
  $('#appDialog').showModal();
  $('#appName').focus();
}

$('#appForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#appName').value.trim();
  const url = normaliseUrl($('#appUrl').value);
  const icon = $('#appIcon').value.trim();
  const target = state.groups.find((g) => g.id === $('#appGroup').value) || current.group;
  if (!name) return;

  if (current.app) {
    Object.assign(current.app, { name, url, icon });
    if (target !== current.group) {
      current.group.apps = current.group.apps.filter((a) => a !== current.app);
      target.apps.push(current.app);
    }
  } else {
    target.apps.push({ id: uid(), name, url, icon });
  }
  await save();
  $('#appDialog').close();
  render();
});

$('#appDelete').addEventListener('click', async () => {
  if (!current.app) return;
  if (!confirm(`Remove "${current.app.name}"?`)) return;
  current.group.apps = current.group.apps.filter((a) => a !== current.app);
  await save();
  $('#appDialog').close();
  render();
});

// ---------- Group dialog ----------
function openGroup(group) {
  current = { app: null, group };
  $('#groupTitle').textContent = group ? 'Rename group' : 'Add group';
  $('#groupName').value = group ? group.name : '';
  $('#groupDialog').showModal();
  $('#groupName').focus();
}

$('#groupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#groupName').value.trim();
  if (!name) return;
  if (current.group) current.group.name = name;
  else state.groups.push({ id: 'g-' + uid(), name, apps: [] });
  await save();
  $('#groupDialog').close();
  render();
});

async function deleteGroup(g) {
  const msg = g.apps.length ? `Delete "${g.name}" and its ${g.apps.length} app(s)?` : `Delete "${g.name}"?`;
  if (!confirm(msg)) return;
  state.groups = state.groups.filter((x) => x !== g);
  await save();
  render();
}

// ---------- Settings ----------
function openSettings() {
  const s = state.settings;
  $('#setServer').value = s.server;
  $('#setName').value = s.name;
  $('#setSearch').value = s.search;
  $('#setStatus').checked = !!s.status;
  $('#settingsDialog').showModal();
}

$('#setStatus').addEventListener('change', async (e) => {
  if (!e.target.checked) return;
  try {
    const ok = await chrome.permissions.request(ORIGINS);
    if (!ok) e.target.checked = false;
  } catch (err) {
    e.target.checked = false;
  }
});

$('#settingsForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  state.settings.server = $('#setServer').value.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  state.settings.name = $('#setName').value.trim();
  state.settings.search = $('#setSearch').value;
  state.settings.status = $('#setStatus').checked;
  await save();
  $('#settingsDialog').close();
  tick();
  render();
});

$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = el('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'hometab-backup.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!valid(data)) throw new Error('bad file');
    data.settings = Object.assign({}, DEFAULTS.settings, data.settings);
    state = data;
    await save();
    $('#settingsDialog').close();
    render();
  } catch (err) {
    alert('That file is not a HomeTab backup.');
  }
});

$('#resetBtn').addEventListener('click', async () => {
  if (!confirm('Put back the default apps? Your own changes will be lost (server IP is kept).')) return;
  const server = state.settings.server;
  state = clone(DEFAULTS);
  state.settings.server = server;
  await save();
  $('#settingsDialog').close();
  render();
});

// ---------- Search, clock, buttons ----------
$('#searchForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#q').value.trim();
  if (!q) return;
  if (/^https?:\/\//i.test(q)) { location.href = q; return; }
  location.href = (SEARCH[state.settings.search] || SEARCH.brave) + encodeURIComponent(q);
});

function tick() {
  const now = new Date();
  $('#clock').textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const h = now.getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const name = state && state.settings.name ? ', ' + state.settings.name : '';
  $('#date').textContent = `${greet}${name} · ` +
    now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

function toggleEdit(on) {
  editing = on;
  render();
}

$('#editBtn').addEventListener('click', () => toggleEdit(!editing));
$('#doneBtn').addEventListener('click', () => toggleEdit(false));
$('#addGroupBtn').addEventListener('click', () => openGroup(null));
$('#settingsBtn').addEventListener('click', openSettings);
$('#bannerSettings').addEventListener('click', openSettings);
document.querySelectorAll('[data-close]').forEach((b) =>
  b.addEventListener('click', () => b.closest('dialog').close()));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && editing && !document.querySelector('dialog[open]')) toggleEdit(false);
});

tick();
setInterval(tick, 10000);
load();
