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
