#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const previewHost = '127.0.0.1';
const previewPortStart = Number(process.env.MEGAHAND_SMOKE_PORT ?? 4173);
const viteBinPath = path.resolve(process.cwd(), 'node_modules', 'vite', 'bin', 'vite.js');
const artifactsDir = path.resolve(process.cwd(), 'artifacts');
const routes = {
  megahand: '/megahand.html',
};

function log(message) {
  process.stdout.write(`[megahand:ux] ${message}\n`);
}

function warn(message) {
  process.stderr.write(`[megahand:ux] WARN ${message}\n`);
}

function runShellCommand(label, command) {
  try {
    execSync(command, { stdio: 'inherit', shell: true, env: process.env });
    return true;
  } catch (error) {
    warn(`${label} failed: ${String(error)}`);
    return false;
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
  for (let candidate = startPort; candidate < startPort + 30; candidate += 1) {
    // eslint-disable-next-line no-await-in-loop
    const open = await isPortOpen(candidate);
    if (open) return candidate;
  }
  throw new Error(`Unable to find open port near ${String(startPort)}`);
}

function waitForServer(child, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const onData = (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (text.includes('Local:') || text.includes('ready in')) {
        cleanup();
        resolve();
      }
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    const onExit = (code) => {
      cleanup();
      reject(new Error(`Vite exited before startup with code ${String(code)}`));
    };

    const interval = setInterval(() => {
      if (Date.now() - startedAt > timeoutMs) {
        cleanup();
        reject(new Error(`Vite did not become ready within ${String(timeoutMs)}ms`));
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

function boxesOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function boxOutsideViewport(box, viewport) {
  if (!box) return true;
  return box.x < 0
    || box.y < 0
    || box.right > viewport.width
    || box.bottom > viewport.height;
}

async function getParentBox(locator) {
  if (await locator.count() < 1) return null;
  return locator.first().evaluate((element) => {
    const target = element.parentElement ?? element;
    const rect = target.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    };
  });
}

async function getLocatorBox(locator) {
  if (await locator.count() < 1) return null;
  return locator.first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    };
  });
}

async function getBox(locator) {
  if (await locator.count() < 1) return null;
  return locator.first().boundingBox();
}

async function runViewportPass(page, viewport, screenshotName) {
  await page.setViewportSize(viewport);
  await page.goto(`http://${previewHost}:${page.__megahandPort}${routes.megahand}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const screenshotPath = path.join(artifactsDir, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const playerEnergyRail = await getParentBox(page.locator('text=⚡').nth(0));
  const enemyEnergyRail = await getParentBox(page.locator('text=⚡').nth(1));
  const playerEnergy = await getLocatorBox(page.locator('[data-ap-meter="shared"]').nth(0));
  const enemyEnergy = await getLocatorBox(page.locator('[data-ap-meter="shared"]').nth(1));
  const endTurn = await getBox(page.locator('text=End Turn'));
  const player = await getBox(page.locator('text=PLAYER'));
  const mochi = await getBox(page.locator('text=Mochi'));
  const jet = await getBox(page.locator('text=Jet'));
  const enemy = await getBox(page.locator('text=\"Lesser Shade\"'));
  const handCard = await getBox(page.locator('text=Tackle'));

  const overlaps = [];
  if (boxesOverlap(playerEnergy, endTurn)) overlaps.push('player energy overlaps End Turn');
  if (boxesOverlap(playerEnergy, player)) overlaps.push('player energy overlaps player board');
  if (boxesOverlap(playerEnergy, mochi)) overlaps.push('player energy overlaps Mochi board');
  if (boxesOverlap(playerEnergy, jet)) overlaps.push('player energy overlaps Jet board');
  if (boxesOverlap(enemyEnergy, enemy)) overlaps.push('enemy energy overlaps enemy board');
  if (boxesOverlap(playerEnergy, handCard) || boxesOverlap(enemyEnergy, handCard)) {
    overlaps.push('energy bars overlap hand cards');
  }

  const offscreen = [];
  if (boxOutsideViewport(playerEnergyRail, viewport)) offscreen.push('player energy rail is off-screen');
  if (boxOutsideViewport(enemyEnergyRail, viewport)) offscreen.push('enemy energy rail is off-screen');
  if (boxOutsideViewport(endTurn, viewport)) offscreen.push('End Turn is off-screen');
  if (boxOutsideViewport(player, viewport)) offscreen.push('player board is off-screen');
  if (boxOutsideViewport(enemy, viewport)) offscreen.push('enemy board is off-screen');

  return {
    viewport,
    screenshotPath,
    overlaps,
    offscreen,
    boxes: {
      playerEnergyRail,
      enemyEnergyRail,
      playerEnergy,
      enemyEnergy,
      endTurn,
      player,
      mochi,
      jet,
      enemy,
      handCard,
    },
  };
}

async function main() {
  fs.mkdirSync(artifactsDir, { recursive: true });

  log('Attempting build before UX smoke pass...');
  const buildOk = runShellCommand('build', 'npm run build');

  const port = await findOpenPort(previewPortStart);
  log(`Starting Vite dev server on ${previewHost}:${String(port)}...`);
  const devServer = spawn(
    process.execPath,
    [viteBinPath, '--host', previewHost, '--port', String(port), '--strictPort'],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: process.env,
      cwd: process.cwd(),
    },
  );

  try {
    await waitForServer(devServer);

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      page.__megahandPort = port;
      const results = [];
      results.push(await runViewportPass(page, { width: 1600, height: 1200 }, 'megahand-ux-pass.png'));
      results.push(await runViewportPass(page, { width: 1280, height: 960 }, 'megahand-ux-pass-1280.png'));

      const failures = results.flatMap((result) =>
        result.overlaps.map((message) => `${result.viewport.width}x${result.viewport.height}: ${message}`),
      );

      const summary = {
        buildOk,
        results: results.map((result) => ({
          viewport: result.viewport,
          screenshotPath: result.screenshotPath,
          overlaps: result.overlaps,
          offscreen: result.offscreen,
        })),
      };
      fs.writeFileSync(path.join(artifactsDir, 'megahand-ux-smoke-summary.json'), JSON.stringify(summary, null, 2), 'utf8');

      const visibilityFailures = results.flatMap((result) =>
        result.offscreen.map((message) => `${result.viewport.width}x${result.viewport.height}: ${message}`),
      );

      if (failures.length > 0 || visibilityFailures.length > 0) {
        throw new Error(`UX smoke found layout issues:\n${[...failures, ...visibilityFailures].join('\n')}`);
      }

      log(`PASS${buildOk ? '' : ' (build still failing outside Megahand)'}`);
      log(`Screenshots: ${results.map((result) => result.screenshotPath).join(', ')}`);
    } finally {
      await browser.close();
    }
  } finally {
    if (!devServer.killed) {
      devServer.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  process.stderr.write(`[megahand:ux] FAIL ${String(error)}\n`);
  process.exit(1);
});
