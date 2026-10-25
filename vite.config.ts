import { validateLayouts } from './src/proto/tableauLayouts';
import { validateAuthoringEdit } from './src/proto/authoringValidation';
import { defineConfig } from 'vite';
import { validateTileDocument } from './src/proto/tileEditor/schema';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { createHash } from 'crypto';

const parsePort = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEV_HOST = process.env.VITE_DEV_HOST?.trim() || '0.0.0.0';
const DEV_PORT = parsePort(process.env.VITE_DEV_PORT, 5178);
const DEV_HMR_HOST = process.env.VITE_DEV_HMR_HOST?.trim();
const DEV_HMR_PORT = parsePort(process.env.VITE_DEV_HMR_PORT, DEV_PORT);
const DEV_HTTPS = process.env.VITE_DEV_HTTPS?.trim().toLowerCase() === 'true';

// The /__* editor routes write files into the repo, so only this PC (loopback,
// which includes Tailscale Serve) and devices on the Tailscale tailnet may call them.
const isTrustedDevAddress = (address: string | undefined): boolean => {
  if (!address) return false;
  const ip = address.replace(/^::ffff:/, '');
  if (ip === '::1' || ip.startsWith('127.')) return true;
  const octets = ip.split('.').map(Number);
  if (octets.length === 4 && octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) return true;
  return ip.toLowerCase().startsWith('fd7a:115c:a1e0:');
};

const replaceActorDefinitionsBlock = (source: string, actors: unknown[]) => {
  const block = `// ACTOR_DEFINITIONS_START\nexport const ACTOR_DEFINITIONS: ActorDefinition[] = ${JSON.stringify(actors, null, 2)};\n// ACTOR_DEFINITIONS_END`;
  return source.replace(
    /\/\/ ACTOR_DEFINITIONS_START[\s\S]*?\/\/ ACTOR_DEFINITIONS_END/,
    block
  );
};

// Build label shown in Proto so playtests can confirm which commit is being served.
// In dev this is the commit checked out when Vite started; restart Vite after a pull.
const gitValue = (command: string) => {
  try {
    return execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};
const PROTO_BUILD = {
  commit: (process.env.VERCEL_GIT_COMMIT_SHA || gitValue('git rev-parse HEAD')).slice(0, 7) || 'unknown',
  committedAt: gitValue('git log -1 --format=%cI'),
  startedAt: new Date().toISOString(),
};

// Include local source/assets: a commit alone cannot identify an uncommitted playtest.
const sourceRevision = () => {
  const hash = createHash('sha256');
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) { hash.update(path.relative(__dirname, file)); hash.update(fs.readFileSync(file)); }
    }
  };
  visit(path.resolve(__dirname, 'src'));
  visit(path.resolve(__dirname, 'public'));
  return hash.digest('hex').slice(0, 8);
};
const buildModule = '\0virtual:proto-build';
let currentBuild = { ...PROTO_BUILD, revision: sourceRevision() };

export default defineConfig({
  define: {
    __PROTO_BUILD__: JSON.stringify(PROTO_BUILD),
  },
  server: {
    https: DEV_HTTPS,
    host: DEV_HOST,
    port: DEV_PORT,
    // Tailscale MagicDNS names (zenduo.<tailnet>.ts.net); raw IPs are always allowed.
    allowedHosts: ['.ts.net'],
    strictPort: true,
    headers: { 'Cache-Control': 'no-store' },
    ...(DEV_HMR_HOST
      ? {
        hmr: {
          host: DEV_HMR_HOST,
          port: DEV_HMR_PORT,
          clientPort: DEV_HMR_PORT,
        },
      }
      : {}),
  },
  plugins: [
    { name: 'query-page-titles', transformIndexHtml: { order: 'pre', handler: () => [{ tag: 'script', attrs: { type: 'module', src: '/src/browserPageTitle.ts' }, injectTo: 'head' }] } },
    { name: 'game-context-menu', transformIndexHtml: { order: 'pre', handler: () => [{ tag: 'script', attrs: { type: 'module', src: '/src/browserContextMenu.ts' }, injectTo: 'head' }] } },
    {
      name: 'proto-build-revision',
      configureServer(server) {
        server.middlewares.use('/__playtest-revision', (_req, res) => {
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ revision: currentBuild.revision }));
        });
      },
      transformIndexHtml: {
        order: 'pre',
        handler: (_html, context) => context.server ? [{
          tag: 'script', attrs: { type: 'module', src: '/src/devFreshness.ts' }, injectTo: 'head',
        }] : [],
      },
      resolveId(id) { if (id === 'virtual:proto-build') return buildModule; },
      load(id) { if (id === buildModule) return `export default ${JSON.stringify(currentBuild)}`; },
      handleHotUpdate(context) {
        const relative = path.relative(__dirname, context.file).replaceAll('\\', '/');
        if (!relative.startsWith('src/') && !relative.startsWith('public/')) return;
        const revision = sourceRevision();
        if (revision === currentBuild.revision) return;
        currentBuild = { ...PROTO_BUILD, revision, startedAt: new Date().toISOString() };
        const module = context.server.moduleGraph.getModuleById(buildModule);
        if (module) context.server.moduleGraph.invalidateModule(module);
        // Let the save response reach the editor before replacing its document.
        if (relative.startsWith('src/data/')) setTimeout(() => context.server.ws.send({ type: 'full-reload' }), 400);
        else context.server.ws.send({ type: 'full-reload' });
        return [];
      },
    },
    react(),
    ...(DEV_HTTPS ? [basicSsl()] : []),
    {
      name: 'light-blocker-save',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const isEditorRoute = req.url?.startsWith('/__') && !req.url.startsWith('/__vite');
          // Public tunnels (Cloudflare, Tailscale Funnel) arrive from loopback, so reject them by header.
          const isPublicTunnel = Boolean(req.headers['cf-connecting-ip'] || req.headers['tailscale-funnel-request']);
          if (isEditorRoute && (isPublicTunnel || !isTrustedDevAddress(req.socket.remoteAddress))) {
            res.statusCode = 403;
            res.end('Forbidden');
            return;
          }
          next();
        });
        server.middlewares.use('/__authoring/save', (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
          if (!req.headers['content-type']?.startsWith('application/json')) { res.statusCode = 415; res.end('Expected application/json'); return; }
          let body = '', large = false;
          req.on('data', chunk => {
            if (large) return;
            body += chunk;
            if (Buffer.byteLength(body) > 256 * 1024) { large = true; res.statusCode = 413; res.end('Document too large'); }
          });
          req.on('end', () => {
            if (large) return;
            try {
              const { kind, id, value } = JSON.parse(body);
              validateAuthoringEdit(kind, id, value);
              const file = path.resolve(__dirname, 'src/data/sharedAuthoring.json');
              // Patch the latest disk document, rather than replacing another device's edits.
              const document = JSON.parse(fs.readFileSync(file, 'utf8'));
              document[kind][id] = value;
              fs.writeFileSync(file + '.tmp', JSON.stringify(document, null, 2) + '\n');
              fs.renameSync(file + '.tmp', file);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-store');
              res.end(JSON.stringify(document));
            } catch (error) { res.statusCode = 400; res.end(String(error)); }
          });
        });
        server.middlewares.use('/__quest-cards/save', (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
          if (!req.headers['content-type']?.startsWith('application/json')) { res.statusCode = 415; res.end('Expected application/json'); return; }
          let body = '', large = false;
          req.on('data', chunk => { body += chunk; if (body.length > 32000) { large = true; res.statusCode = 413; res.end('Too large'); req.destroy(); } });
          req.on('end', () => {
            if (large) return;
            try {
              const { id, draft } = JSON.parse(body);
              if (typeof id !== 'string' || !id.trim() || id.length > 500 || ['__proto__', 'constructor', 'prototype'].includes(id)) throw new Error('Invalid quest ID');
              if (draft !== null && (!draft || typeof draft.title !== 'string' || !draft.title.trim() || draft.title.length > 200 || typeof draft.text !== 'string' || !draft.text.trim() || draft.text.length > 4000)) throw new Error('Invalid quest text');
              const file = path.resolve(__dirname, 'src/data/questCardEdits.json');
              const edits = JSON.parse(fs.readFileSync(file, 'utf8'));
              if (draft === null) delete edits[id]; else edits[id] = { title: draft.title, text: draft.text };
              fs.writeFileSync(file + '.tmp', JSON.stringify(edits, null, 2) + '\n'); fs.renameSync(file + '.tmp', file);
              res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(edits));
            } catch (error) { res.statusCode = 400; res.end(String(error)); }
          });
        });
        // ?combatAbilities editor: name/owner/description overrides keyed by stable ability id (null resets).
        server.middlewares.use('/__combat-abilities/save', (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
          if (!req.headers['content-type']?.startsWith('application/json')) { res.statusCode = 415; res.end('Expected application/json'); return; }
          let body = '', large = false;
          req.on('data', chunk => { body += chunk; if (body.length > 8000) { large = true; res.statusCode = 413; res.end('Too large'); req.destroy(); } });
          req.on('end', () => {
            if (large) return;
            try {
              const { id, override } = JSON.parse(body);
              if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,39}$/.test(id) || id.startsWith('cir')) throw new Error('Invalid ability ID');
              if (override !== null && (!override || typeof override.name !== 'string' || !override.name.trim() || override.name.length > 40
                || typeof override.description !== 'string' || !override.description.trim() || override.description.length > 400
                || !['hero', 'mochi'].includes(override.owner))) throw new Error('Invalid ability edit');
              const file = path.resolve(__dirname, 'src/data/combatAbilityOverrides.json');
              const edits = JSON.parse(fs.readFileSync(file, 'utf8'));
              if (override === null) delete edits[id]; else edits[id] = { name: override.name.trim(), owner: override.owner, description: override.description.trim() };
              fs.writeFileSync(file + '.tmp', JSON.stringify(edits, null, 2) + '\n'); fs.renameSync(file + '.tmp', file);
              res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(edits));
            } catch (error) { res.statusCode = 400; res.end(String(error)); }
          });
        });
        server.middlewares.use('/__tableau-layouts/save', (req,res) => {
          if(req.method!=='POST'){res.statusCode=405;res.end('Method Not Allowed');return;}
          if(!req.headers['content-type']?.startsWith('application/json')){res.statusCode=415;res.end('Expected application/json');return;}
          let body='',large=false;
          req.on('data',chunk=>{if(large)return;body+=chunk;if(Buffer.byteLength(body)>256*1024){large=true;res.statusCode=413;res.end('Document too large');}});
          req.on('end',()=>{if(large)return;try{const document=JSON.parse(body);validateLayouts(document);const file=path.resolve(__dirname,'src/data/tableauLayouts.json');fs.writeFileSync(file+'.tmp',JSON.stringify(document,null,2)+'\n');fs.renameSync(file+'.tmp',file);res.end('Saved');}catch(error){res.statusCode=400;res.end(String(error));}});
        });
        server.middlewares.use('/__proto-deprecated/pixel/tiles/save', (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end('Method Not Allowed'); return; }
          if (!req.headers['content-type']?.startsWith('application/json')) { res.statusCode = 415; res.end('Expected application/json'); return; }
          let body = '', tooLarge = false;
          req.on('data', chunk => {
            if (tooLarge) return;
            body += chunk;
            if (Buffer.byteLength(body) > 256 * 1024) { tooLarge = true; res.statusCode = 413; res.end('Tile document too large'); }
          });
          req.on('end', () => {
            if (tooLarge) return;
            try {
              const document = JSON.parse(body);
              validateTileDocument(document);
              if (!document.tiles) throw new Error('Save requires a complete authored layout');
              const file = path.resolve(__dirname, 'src/data/protoTiles.json');
              const temporary = `${file}.tmp`;
              fs.writeFileSync(temporary, JSON.stringify(document, null, 2) + '\n', 'utf8');
              fs.renameSync(temporary, file);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ saved: true }));
            } catch (error) {
              res.statusCode = 400;
              res.end(error instanceof Error ? error.message : 'Unable to save tile data');
            }
          });
        });
        server.middlewares.use('/__light-patterns/save', (req, res, next) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const filePath = path.resolve(__dirname, 'src/data/lightBlockPatterns.json');
              fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');
              res.statusCode = 200;
              res.end('OK');
            } catch (err) {
              res.statusCode = 400;
              res.end('Invalid JSON');
            }
          });
        });
        server.middlewares.use('/__map-editor/save', (req, res, next) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const filePath = path.resolve(__dirname, 'src/data/mapEditorLayout.json');
              fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');
              res.statusCode = 200;
              res.end('OK');
            } catch (err) {
              res.statusCode = 400;
              res.end('Invalid JSON');
            }
          });
        });
        server.middlewares.use('/__rpg-catalog/save', (req, res, next) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const filePath = path.resolve(__dirname, 'src/engine/rpgCatalog.ts');
              fs.writeFileSync(filePath, body, 'utf8');
              res.statusCode = 200;
              res.end('OK');
            } catch (err) {
              res.statusCode = 400;
              res.end('Write failed');
            }
          });
        });
        server.middlewares.use('/__aspects/overrides', (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          try {
            const filePath = path.resolve(__dirname, 'src/data/aspects.json');
            if (!fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.end('{"aspects": []}');
              return;
            }
            const contents = fs.readFileSync(filePath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(contents);
          } catch (err) {
            res.statusCode = 500;
            res.end('Unable to load aspects');
          }
        });
        server.middlewares.use('/__aspects/save', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (!parsed || !Array.isArray(parsed.aspects)) {
                res.statusCode = 400;
                res.end('Invalid payload');
                return;
              }
              const filePath = path.resolve(__dirname, 'src/data/aspects.json');
              fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(parsed));
            } catch (err) {
              res.statusCode = 400;
              res.end('Write failed');
            }
          });
        });
        server.middlewares.use('/__abilities/overrides', (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          try {
            const filePath = path.resolve(__dirname, 'src/data/abilities.json');
            if (!fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.end('{"abilities": []}');
              return;
            }
            const contents = fs.readFileSync(filePath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(contents);
          } catch (err) {
            res.statusCode = 500;
            res.end('Unable to load abilities');
          }
        });
        server.middlewares.use('/__abilities/save', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (!parsed || !Array.isArray(parsed.abilities)) {
                res.statusCode = 400;
                res.end('Invalid payload');
                return;
              }
              const filePath = path.resolve(__dirname, 'src/data/abilities.json');
              fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(parsed));
            } catch (err) {
              res.statusCode = 400;
              res.end('Write failed');
            }
          });
        });
        server.middlewares.use('/__enemy-encounters/overrides', (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          try {
            const filePath = path.resolve(__dirname, 'src/data/enemyEncounters.json');
            if (!fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.end('{"biomes": []}');
              return;
            }
            const contents = fs.readFileSync(filePath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(contents);
          } catch (err) {
            res.statusCode = 500;
            res.end('Unable to load enemy encounters');
          }
        });
        server.middlewares.use('/__enemy-encounters/save', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (!parsed || !Array.isArray(parsed.biomes)) {
                res.statusCode = 400;
                res.end('Invalid payload');
                return;
              }
              const filePath = path.resolve(__dirname, 'src/data/enemyEncounters.json');
              fs.writeFileSync(filePath, JSON.stringify({ biomes: parsed.biomes }, null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(parsed));
            } catch (err) {
              res.statusCode = 400;
              res.end('Write failed');
            }
          });
        });
        server.middlewares.use('/__deprecated/pixel/characters/overrides', (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          try {
            const filePath = path.resolve(__dirname, 'src/engine/actors.ts');
            const contents = fs.readFileSync(filePath, 'utf8');
            const match = contents.match(/export const ACTOR_DEFINITIONS: ActorDefinition\[] = ([\s\S]*?);\n\/\/ ACTOR_DEFINITIONS_END/);
            if (!match) {
              res.statusCode = 500;
              res.end('Unable to parse actors');
              return;
            }
            const actors = JSON.parse(match[1]);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ actors }));
          } catch (err) {
            res.statusCode = 500;
            res.end('Unable to load actors');
          }
        });
        server.middlewares.use('/__deprecated/pixel/characters/save', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (!parsed || !Array.isArray(parsed.actors)) {
                res.statusCode = 400;
                res.end('Invalid payload');
                return;
              }
              const filePath = path.resolve(__dirname, 'src/engine/actors.ts');
              const existing = fs.readFileSync(filePath, 'utf8');
              const next = replaceActorDefinitionsBlock(existing, parsed.actors);
              fs.writeFileSync(filePath, next, 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ actors: parsed.actors }));
            } catch (err) {
              res.statusCode = 400;
              res.end('Write failed');
            }
          });
        });
        server.middlewares.use('/__deprecated/pixel/orims/overrides', (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          try {
            const filePath = path.resolve(__dirname, 'src/data/orims.json');
            if (!fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.end('{"orims": []}');
              return;
            }
            const contents = fs.readFileSync(filePath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(contents);
          } catch (err) {
            res.statusCode = 500;
            res.end('Unable to load orims');
          }
        });
        server.middlewares.use('/__deprecated/pixel/orims/save', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (!parsed || !Array.isArray(parsed.orims)) {
                res.statusCode = 400;
                res.end('Invalid payload');
                return;
              }
              const dataFilePath = path.resolve(__dirname, 'src/data/orims.json');
              fs.writeFileSync(dataFilePath, JSON.stringify({ orims: parsed.orims }, null, 2), 'utf8');

              const tsFilePath = path.resolve(__dirname, 'src/engine/orims.ts');
              const tsContent = `import type { OrimDefinition } from './types';\n\n/**\n * Orim Definitions - Clean, minimal card modifications\n * Each orim has: id, name, description, elements\n */\nexport const ORIM_DEFINITIONS: OrimDefinition[] = ${JSON.stringify(parsed.orims, null, 2)};\n\n/**\n * Get an orim definition by ID\n */\nexport function getOrimDefinition(orimId: string): OrimDefinition | null {\n  return ORIM_DEFINITIONS.find((o) => o.id === orimId) || null;\n}\n`;
              fs.writeFileSync(tsFilePath, tsContent, 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(parsed));
            } catch (err) {
              res.statusCode = 400;
              res.end('Write failed');
            }
          });
        });
        server.middlewares.use('/__synergies/overrides', (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          try {
            const filePath = path.resolve(__dirname, 'src/data/synergies.json');
            if (!fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.end('{"synergies": []}');
              return;
            }
            const contents = fs.readFileSync(filePath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(contents);
          } catch (err) {
            res.statusCode = 500;
            res.end('Unable to load synergies');
          }
        });
        server.middlewares.use('/__synergies/save', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (!parsed || !Array.isArray(parsed.synergies)) {
                res.statusCode = 400;
                res.end('Invalid payload');
                return;
              }
              const filePath = path.resolve(__dirname, 'src/data/synergies.json');
              fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(parsed));
            } catch (err) {
              res.statusCode = 400;
              res.end('Write failed');
            }
          });
        });
        server.middlewares.use('/__aspect-profiles/overrides', (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          try {
            const filePath = path.resolve(__dirname, 'src/data/aspectProfiles.json');
            if (!fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.end('{"aspects": []}');
              return;
            }
            const contents = fs.readFileSync(filePath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(contents);
          } catch (err) {
            res.statusCode = 500;
            res.end('Unable to load aspect profiles');
          }
        });
        server.middlewares.use('/__aspect-profiles/save', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (!parsed || !Array.isArray(parsed.aspects)) {
                res.statusCode = 400;
                res.end('Invalid payload');
                return;
              }
              const filePath = path.resolve(__dirname, 'src/data/aspectProfiles.json');
              fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(parsed));
            } catch (err) {
              res.statusCode = 400;
              res.end('Write failed');
            }
          });
        });
        server.middlewares.use('/__pois/overrides', (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          try {
            const filePath = path.resolve(__dirname, 'src/data/pois.json');
            if (!fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.end('{"pois": []}');
              return;
            }
            const contents = fs.readFileSync(filePath, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(contents);
          } catch (err) {
            res.statusCode = 500;
            res.end('Unable to load POIs');
          }
        });
        server.middlewares.use('/__pois/save', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (!parsed || !Array.isArray(parsed.pois)) {
                res.statusCode = 400;
                res.end('Invalid payload');
                return;
              }
              const dataFilePath = path.resolve(__dirname, 'src/data/pois.json');
              fs.writeFileSync(dataFilePath, JSON.stringify({ pois: parsed.pois }, null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(parsed));
            } catch (err) {
              res.statusCode = 400;
              res.end('Write failed');
            }
          });
        });
        server.middlewares.use('/__write-file', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end('Method Not Allowed');
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body) as { path?: string; content?: string };
              if (!parsed.path || typeof parsed.content !== 'string') {
                res.statusCode = 400;
                res.end('Invalid payload');
                return;
              }
              const projectRoot = path.resolve(__dirname);
              const targetPath = path.resolve(projectRoot, parsed.path);
              if (!targetPath.startsWith(projectRoot + path.sep)) {
                res.statusCode = 400;
                res.end('Invalid path');
                return;
              }
              fs.writeFileSync(targetPath, parsed.content, 'utf8');
              res.statusCode = 200;
              res.end('OK');
            } catch (err) {
              res.statusCode = 400;
              res.end('Write failed');
            }
          });
        });
        },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main:       path.resolve(__dirname, 'index.html'),
        banks:      path.resolve(__dirname, 'banks.html'),
        benchclassic: path.resolve(__dirname, 'benchclassic.html'),
        chargeup:   path.resolve(__dirname, 'chargeup.html'),
        megahand:   path.resolve(__dirname, 'megahand.html'),
        kinhand:    path.resolve(__dirname, 'kinhand.html'),
        classic:    path.resolve(__dirname, 'classic.html'),
        proto: path.resolve(__dirname, 'proto.html'),
        golfLegacy: path.resolve(__dirname, 'golf-legacy.html'),
        inverse:    path.resolve(__dirname, 'inverse.html'),
        city:       path.resolve(__dirname, 'city.html'),
        cardDesigner: path.resolve(__dirname, 'cardDesigner.html'),
        immersion:  path.resolve(__dirname, 'immersion.html'),
        world:      path.resolve(__dirname, 'world.html'),
        auram:      path.resolve(__dirname, 'auram.html'),
        tooling:    path.resolve(__dirname, 'tooling.html'),
        watercolorLab: path.resolve(__dirname, 'tools/watercolor-lab.html'),
        bushLab: path.resolve(__dirname, 'tools/bush-lab.html'),
        ux:         path.resolve(__dirname, 'ux.html'),
        exploritaire: path.resolve(__dirname, 'exploritaire.html'),
        hearth: path.resolve(__dirname, 'hearth.html'),
      },
    },
  },
});
