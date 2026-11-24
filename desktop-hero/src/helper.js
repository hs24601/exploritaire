'use strict';
// Builds (on first use) and drives the C# sidecar in native/HeroHelper.cs.

const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const ROOT = path.resolve(__dirname, '..');
const SOURCE = path.join(ROOT, 'native', 'HeroHelper.cs');
const EXE = path.join(ROOT, 'native', 'bin', 'HeroHelper.exe');

function findCsc() {
  const windir = process.env.WINDIR || 'C:\\Windows';
  for (const fw of ['Framework64', 'Framework']) {
    const dir = path.join(windir, 'Microsoft.NET', fw, 'v4.0.30319');
    if (fs.existsSync(path.join(dir, 'csc.exe'))) return dir;
  }
  throw new Error('Could not find the .NET Framework C# compiler (csc.exe).');
}

function buildHelper({ force = false } = {}) {
  if (!force && fs.existsSync(EXE) && fs.statSync(EXE).mtimeMs >= fs.statSync(SOURCE).mtimeMs) return EXE;
  const fw = findCsc();
  const wpf = path.join(fw, 'WPF');
  fs.mkdirSync(path.dirname(EXE), { recursive: true });
  execFileSync(path.join(fw, 'csc.exe'), [
    '/nologo', '/optimize', '/target:exe', '/platform:anycpu', `/out:${EXE}`,
    `/r:${path.join(wpf, 'UIAutomationClient.dll')}`,
    `/r:${path.join(wpf, 'UIAutomationTypes.dll')}`,
    `/r:${path.join(wpf, 'WindowsBase.dll')}`,
    SOURCE,
  ], { windowsHide: true, stdio: 'pipe' });
  return EXE;
}

class Helper {
  constructor(ignoredPids = []) {
    this.ignoredPids = ignoredPids;
    this.nextId = 1;
    this.pending = new Map();
    this.proc = null;
    this.closed = false;
  }

  start() {
    const exe = buildHelper();
    this.proc = spawn(exe, this.ignoredPids.map(String), { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stdin.setDefaultEncoding('utf8');
    const lines = readline.createInterface({ input: this.proc.stdout });
    lines.on('line', (line) => {
      let msg;
      try { msg = JSON.parse(line); } catch { return; }
      const waiter = this.pending.get(msg.id);
      if (waiter) { this.pending.delete(msg.id); waiter(msg); }
    });
    this.proc.stderr.on('data', (d) => process.stderr.write(`[helper] ${d}`));
    this.proc.on('exit', (code) => {
      this.closed = true;
      for (const waiter of this.pending.values()) waiter({ error: `helper exited (${code})` });
      this.pending.clear();
    });
    return this;
  }

  request(command, ...args) {
    if (this.closed || !this.proc) return Promise.resolve({ error: 'helper not running' });
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.proc.stdin.write(`${id} ${[command, ...args].join(' ')}\n`);
    });
  }

  snap() { return this.request('snap'); }
  buttons() { return this.request('buttons'); }
  activate(hwnd) { return this.request('activate', String(hwnd)); }
  move(hwnd, dx, dy) { return this.request('move', String(hwnd), String(Math.round(dx)), String(Math.round(dy))); }

  stop() {
    if (!this.proc || this.closed) return;
    try { this.proc.stdin.write('0 quit\n'); } catch { /* already gone */ }
    setTimeout(() => { if (!this.closed) this.proc.kill(); }, 500);
  }
}

module.exports = { Helper, buildHelper };

if (require.main === module) {
  buildHelper({ force: process.argv.includes('--force') });
  console.log(`Built ${EXE}`);
}
