#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process';
import net from 'node:net';
import { resolve } from 'node:path';
import process from 'node:process';

const defaultPreviewPort = Number(process.env.SMOKE_PREVIEW_PORT ?? 5199);
const previewPortStart = Number.isFinite(defaultPreviewPort) ? defaultPreviewPort : 5199;
const previewHost = '127.0.0.1';

const viteBinPath = resolve(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');

function runShellCommand(label, command) {
  try {
    execSync(command, { stdio: 'inherit', shell: true, env: process.env });
  } catch (error) {
    throw new Error(`${label} failed: ${String(error)}`);
  }
}

function waitForPreviewServer(child, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const onData = (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (
        text.includes('Local:')
        || text.includes('http://127.0.0.1')
        || text.includes('ready in')
      ) {
        cleanup();
        resolve();
      }
    };
    const onError = (err) => {
      cleanup();
      reject(err);
    };
    const onExit = (code) => {
      cleanup();
      reject(new Error(`preview exited before startup (code ${String(code)})`));
    };
    const interval = setInterval(() => {
      if (Date.now() - startedAt > timeoutMs) {
        cleanup();
        reject(new Error(`preview did not become ready within ${timeoutMs}ms`));
      }
    }, 250);

    const cleanup = () => {
      clearInterval(interval);
      child.stdout?.off('data', onData);
      child.stderr?.off('data', onData);
      child.off('error', onError);
      child.off('exit', onExit);
    };

    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', onError);
    child.on('exit', onExit);
  });
}

async function verifyPreviewReachability() {
  const previewPort = await findOpenPort(previewPortStart);
  const previewUrl = `http://${previewHost}:${previewPort}/?mode=combat-lab`;
  const child = spawn(
    process.execPath,
    [viteBinPath, 'preview', '--host', previewHost, '--port', String(previewPort), '--strictPort'],
    { stdio: ['ignore', 'pipe', 'pipe'], shell: false, env: process.env }
  );

  try {
    await waitForPreviewServer(child);
    const response = await fetch(previewUrl, { method: 'GET' });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`preview responded with ${response.status}`);
    }
    if (!body.includes('<!DOCTYPE html>')) {
      throw new Error('preview response did not contain expected HTML doctype');
    }
    console.log(`[smoke:preflight] Reachability OK: ${previewUrl}`);
  } finally {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
}

function isPortOpen(port) {
  return new Promise((resolvePromise) => {
    const server = net.createServer();
    server.once('error', () => resolvePromise(false));
    server.once('listening', () => {
      server.close(() => resolvePromise(true));
    });
    server.listen(port, previewHost);
  });
}

async function findOpenPort(startPort) {
  for (let candidate = startPort; candidate < startPort + 40; candidate += 1) {
    // eslint-disable-next-line no-await-in-loop
    const isOpen = await isPortOpen(candidate);
    if (isOpen) return candidate;
  }
  throw new Error(`Unable to find open preview port near ${String(startPort)}`);
}

async function main() {
  console.log('[smoke:preflight] Running typecheck...');
  runShellCommand('typecheck', 'npm run typecheck');
  console.log('[smoke:preflight] Running build...');
  runShellCommand('build', 'npm run build');
  console.log('[smoke:preflight] Verifying preview reachability...');
  await verifyPreviewReachability();
  console.log('[smoke:preflight] PASS');
}

main().catch((error) => {
  console.error(`[smoke:preflight] FAIL: ${String(error)}`);
  process.exit(1);
});
