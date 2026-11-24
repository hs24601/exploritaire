#!/usr/bin/env node
import { execSync, execFileSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const fix = args.has('--fix');
const portFlag = [...args].find((arg) => arg.startsWith('--port='));
const port = Number((portFlag ? portFlag.split('=')[1] : process.env.VITE_DEV_PORT) ?? 5178);

if (!Number.isFinite(port) || port <= 0) {
  console.error(`[dev:doctor] Invalid port: ${String(port)}`);
  process.exit(1);
}

function getWindowsListeners(localPort) {
  const script = `& {
      $rows = Get-NetTCPConnection -State Listen -LocalPort ${localPort} -ErrorAction SilentlyContinue |
        Select-Object LocalAddress,LocalPort,OwningProcess;
      $result = @();
      foreach ($row in $rows) {
        $listenerProcessId = [int]$row.OwningProcess;
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$listenerProcessId" -ErrorAction SilentlyContinue;
        $result += [PSCustomObject]@{
          localAddress = $row.LocalAddress;
          localPort = $row.LocalPort;
          pid = $listenerProcessId;
          name = $proc.Name;
          commandLine = $proc.CommandLine;
        };
      }
      $result | ConvertTo-Json -Compress
    }`;
  const raw = execFileSync('powershell', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  // Tailnet proxy sockets do not compete for Vite's loopback backend.
  return (Array.isArray(parsed) ? parsed : [parsed]).filter(row =>
    ['127.0.0.1', '0.0.0.0', '::1', '::'].includes(row.localAddress));
}

function getUnixListeners(localPort) {
  const rows = execSync(`lsof -nP -iTCP:${localPort} -sTCP:LISTEN`, { encoding: 'utf8' })
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean);
  return rows.map((line) => {
    const parts = line.split(/\s+/);
    const commandName = parts[0] ?? '';
    const pid = Number(parts[1] ?? 0);
    const localAddress = parts[8]?.split('->')[0] ?? '';
    return {
      localAddress,
      localPort,
      pid,
      name: commandName,
      commandLine: commandName,
    };
  });
}

function getListeners(localPort) {
  try {
    if (process.platform === 'win32') return getWindowsListeners(localPort);
    return getUnixListeners(localPort);
  } catch {
    return [];
  }
}

function isViteProcess(entry) {
  const cmd = String(entry.commandLine ?? '').toLowerCase();
  const name = String(entry.name ?? '').toLowerCase();
  return cmd.includes('vite') || name === 'vite';
}

function summarize(entries) {
  const byPid = new Map();
  entries.forEach((entry) => {
    const current = byPid.get(entry.pid) ?? {
      pid: entry.pid,
      name: entry.name,
      commandLine: entry.commandLine,
      addresses: [],
    };
    current.addresses.push(entry.localAddress);
    byPid.set(entry.pid, current);
  });
  return [...byPid.values()].sort((a, b) => a.pid - b.pid);
}

function printSummary(summary) {
  if (summary.length === 0) {
    console.log(`[dev:doctor] No listener currently bound to port ${port}.`);
    return;
  }
  console.log(`[dev:doctor] Listeners on port ${port}:`);
  summary.forEach((entry) => {
    const addresses = [...new Set(entry.addresses)].join(', ');
    console.log(`  - pid=${entry.pid} addr=[${addresses}] cmd=${String(entry.commandLine ?? entry.name ?? '').trim()}`);
  });
}

let listeners = getListeners(port);
let summary = summarize(listeners);
printSummary(summary);

if (summary.length <= 1) {
  console.log('[dev:doctor] OK');
  process.exit(0);
}

const viteSummary = summary.filter(isViteProcess);
const nonViteSummary = summary.filter((entry) => !isViteProcess(entry));

if (nonViteSummary.length > 0) {
  console.error('[dev:doctor] Port conflict includes non-Vite process(es). Resolve manually before starting dev server.');
  process.exit(1);
}

if (!fix) {
  console.error('[dev:doctor] Multiple Vite listeners detected on the same port. Run `npm run dev:doctor:fix`.');
  process.exit(1);
}

const keep = viteSummary.reduce((best, entry) => (entry.pid > best.pid ? entry : best), viteSummary[0]);
const toKill = viteSummary.filter((entry) => entry.pid !== keep.pid);

toKill.forEach((entry) => {
  try {
    process.kill(entry.pid, 'SIGTERM');
    console.log(`[dev:doctor] Stopped stale Vite process pid=${entry.pid}.`);
  } catch (error) {
    console.error(`[dev:doctor] Failed to stop pid=${entry.pid}: ${String(error)}`);
  }
});

listeners = getListeners(port);
summary = summarize(listeners);
printSummary(summary);
if (summary.length > 1) {
  console.error('[dev:doctor] Port still has multiple listeners. Resolve manually.');
  process.exit(1);
}
console.log('[dev:doctor] Fixed duplicate listeners.');
