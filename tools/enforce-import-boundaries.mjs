import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const SRC_DIR = path.join(ROOT_DIR, 'src');

const FORBIDDEN_GAME_EXPORTS = new Set([
  'advanceTurn',
  'completeEncounter',
  'endExplorationTurn',
  'endTurn',
  'playEnemyTableauCard',
  'playTableauCard',
  'spawnEnemy',
  'spawnEnemyActor',
  'recordCardAction',
  'processEffects',
  'findActorById',
  'grantApToActorById',
  'ensureCombatDeck',
  'resolveRandomBiomeDeadlockSurge',
  'createActorFoundationCard',
  'checkNoValidMoves',
  'checkNoValidMovesGlobal',
  'getMoveAvailability',
  'getTableauCanPlay',
  'getValidFoundationsForCard',
  'MoveAvailability',
]);

function isUiOrHookFile(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  return normalized.includes('/src/components/') || normalized.includes('/src/hooks/');
}

function isEngineLayerFile(filePath) {
  const normalized = filePath.split(path.sep).join('/');
  if (!normalized.includes('/src/engine/')) return false;
  return !normalized.endsWith('/src/engine/game.ts');
}

async function walkFiles(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    files.push(fullPath);
  }
  return files;
}

function parseNamedImports(importBlock) {
  return importBlock
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/^type\s+/, '').trim())
    .map((segment) => segment.split(/\s+as\s+/i)[0].trim())
    .filter(Boolean);
}

function isEngineGameImport(modulePath) {
  return modulePath === '../engine/game'
    || modulePath === './engine/game'
    || modulePath === './game'
    || modulePath === '../game'
    || modulePath.endsWith('/engine/game');
}

async function main() {
  const files = await walkFiles(SRC_DIR);
  const violations = [];
  const importRegex = /import\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+['"]([^'"]+)['"]/g;

  for (const filePath of files) {
    if (!isUiOrHookFile(filePath) && !isEngineLayerFile(filePath)) continue;
    const contents = await readFile(filePath, 'utf8');
    let match;
    while ((match = importRegex.exec(contents)) !== null) {
      const [, importBlock, modulePath] = match;
      if (!isEngineGameImport(modulePath.trim())) continue;
      const names = parseNamedImports(importBlock);
      const forbidden = names.filter((name) => FORBIDDEN_GAME_EXPORTS.has(name));
      if (forbidden.length === 0) continue;
      violations.push({
        filePath,
        modulePath,
        forbidden,
      });
    }
  }

  if (violations.length === 0) {
    console.log('Import boundary check passed.');
    return;
  }

  console.error('Import boundary violations found:');
  for (const violation of violations) {
    const relativePath = path.relative(ROOT_DIR, violation.filePath).split(path.sep).join('/');
    console.error(`- ${relativePath}`);
    console.error(`  source: ${violation.modulePath}`);
    console.error(`  forbidden: ${violation.forbidden.join(', ')}`);
    console.error('  use canonical combat modules: engine/combat or engine/combat/*');
  }
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
