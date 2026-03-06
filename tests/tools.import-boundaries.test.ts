import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const boundaryScriptPath = path.resolve(process.cwd(), 'tools', 'enforce-import-boundaries.mjs');

async function createTempRepo(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'exploritaire-boundary-test-'));
  await mkdir(path.join(root, 'src'), { recursive: true });
  return root;
}

async function writeTsFile(repoRoot: string, relativePath: string, content: string): Promise<void> {
  const fullPath = path.join(repoRoot, relativePath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, 'utf8');
}

async function runBoundaryScript(repoRoot: string): Promise<{ code: number; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [boundaryScriptPath], {
      cwd: repoRoot,
    });
    return { code: 0, output: `${stdout}${stderr}` };
  } catch (error: any) {
    return {
      code: Number(error?.code ?? 1),
      output: `${error?.stdout ?? ''}${error?.stderr ?? ''}`,
    };
  }
}

describe('tools/enforce-import-boundaries.mjs', () => {
  it('passes when UI/hook imports from engine/game avoid forbidden combat helpers', async () => {
    const repoRoot = await createTempRepo();
    try {
      await writeTsFile(
        repoRoot,
        'src/hooks/useAllowed.ts',
        "import { initializeGame } from '../engine/game';\nexport const ok = initializeGame;\n"
      );
      const result = await runBoundaryScript(repoRoot);
      expect(result.code).toBe(0);
      expect(result.output).toContain('Import boundary check passed.');
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it('fails when a hook imports forbidden combat helpers from engine/game', async () => {
    const repoRoot = await createTempRepo();
    try {
      await writeTsFile(
        repoRoot,
        'src/hooks/useBad.ts',
        "import { getMoveAvailability } from '../engine/game';\nexport const bad = getMoveAvailability;\n"
      );
      const result = await runBoundaryScript(repoRoot);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain('Import boundary violations found:');
      expect(result.output).toContain('src/hooks/useBad.ts');
      expect(result.output).toContain('getMoveAvailability');
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it('fails when non-game engine modules import forbidden combat helpers via engine/game', async () => {
    const repoRoot = await createTempRepo();
    try {
      await writeTsFile(
        repoRoot,
        'src/engine/anyModule.ts',
        "import { advanceTurn } from './game';\nexport const bad = advanceTurn;\n"
      );
      const result = await runBoundaryScript(repoRoot);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain('Import boundary violations found:');
      expect(result.output).toContain('src/engine/anyModule.ts');
      expect(result.output).toContain('advanceTurn');
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });
});
