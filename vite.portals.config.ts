import {defineConfig} from 'vite';
import path from 'node:path';
import base from './vite.config';

// Retain the existing trusted editor-save APIs, controller entry behavior,
// page titles and runtime build metadata; package only connected world entries.
export default defineConfig({
 ...base,
 cacheDir: '.cache/vite-portals',
 plugins:[...(base.plugins??[]),{name:'portals-preview-home',configurePreviewServer(server){server.middlewares.use((req,res,next)=>{const url=new URL(req.url??'/','http://localhost');if((req.method==='GET'||req.method==='HEAD')&&url.pathname==='/'){res.statusCode=302;res.setHeader('Location','/portals.html'+url.search);res.setHeader('Cache-Control','no-store');res.end();return;}next();});}}],
 build:{...base.build,rollupOptions:{...base.build?.rollupOptions,input:{"portals_html":path.resolve(__dirname, 'portals.html'),"book_html":path.resolve(__dirname, 'book.html'),"117_html":path.resolve(__dirname, '117.html'),"118_html":path.resolve(__dirname, '118.html'),"119_html":path.resolve(__dirname, '119.html'),"snowflake_sticker_html":path.resolve(__dirname, 'snowflake-sticker.html')}}},
});
