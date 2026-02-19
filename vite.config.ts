import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const resolvePoiOverridePath = () => path.resolve(process.cwd(), 'src/data/poiRewardOverrides.json');

const attachPoiEditorRoutes = (middlewares: any) => {
  middlewares.use('/__poi-editor/overrides', (req, res) => {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.end('Method Not Allowed');
      return;
    }
    try {
      const filePath = resolvePoiOverridePath();
      if (!fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/json');
        res.end('{}');
        return;
      }
      const contents = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'application/json');
      res.end(contents);
    } catch (err) {
      res.statusCode = 500;
      res.end('Unable to load overrides');
    }
  });
  middlewares.use('/__poi-editor/save', (req, res) => {
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
        if (typeof parsed.key !== 'string' || !Array.isArray(parsed.rewards)) {
          res.statusCode = 400;
          res.end('Invalid payload');
          return;
        }
        const filePath = resolvePoiOverridePath();
        const existing = fs.existsSync(filePath)
          ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
          : {};
        const nextEntry: Record<string, unknown> = { rewards: parsed.rewards };
        if (parsed.narration) {
          nextEntry.narration = parsed.narration;
        }
        if (parsed.sparkle) {
          nextEntry.sparkle = parsed.sparkle;
        }
        existing[parsed.key] = nextEntry;
        fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(existing));
      } catch (err) {
        res.statusCode = 400;
        res.end('Write failed');
      }
    });
  });
};

export default defineConfig({
  server: {
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    {
      name: 'light-blocker-save',
      configureServer(server) {
        attachPoiEditorRoutes(server.middlewares);
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
            const filePath = path.resolve(__dirname, 'src/data/keruAspects.json');
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
              const filePath = path.resolve(__dirname, 'src/data/keruAspects.json');
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
      configurePreviewServer(server) {
        attachPoiEditorRoutes(server.middlewares);
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
