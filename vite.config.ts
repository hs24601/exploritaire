import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
export default defineConfig({
  server: {
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    {
      name: 'light-blocker-save',
      configureServer(server) {
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
        server.middlewares.use('/__orims/overrides', (req, res) => {
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
        server.middlewares.use('/__orims/save', (req, res) => {
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
              if (!targetPath.startsWith(projectRoot)) {
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
});
