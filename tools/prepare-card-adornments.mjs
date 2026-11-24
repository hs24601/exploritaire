import fs from 'node:fs';
import path from 'node:path';

// Preserve authored pixels and alpha exactly; do not infer alpha from paint color.
const generated = process.argv[2];
if (!generated) throw new Error('Usage: node tools/prepare-card-adornments.mjs GENERATED_DIRECTORY');
const names = {
  nature: ['a3ce2ee0-397d-47d1-af83-256896d3124c', 'b6fb8822-040d-4991-aa15-d677f3e4daf9'],
  fire: ['b5defad4-1234-4c73-8351-33b652e2e62f', '80db025f-3d4b-462e-ac80-d8724584737e'],
  water: ['4c015e68-a86f-468d-92ad-0539200c6fe4', 'f44f531f-ac79-4dc9-a38a-157bda0f7e87'],
  air: ['122f4534-92ae-4fee-9e13-696b10051c90', 'dd0b6411-2e98-4304-b47e-ca9f9f7a6264'],
  earth: ['c12986f4-3cf5-4fde-adfe-901933092191', 'b6b0fb67-16c2-4447-a90a-39758c38dcda'],
};
const sources = 'public/assets/sources/ui/card-adornments';
const runtime = 'public/assets/runtime/ui/card-adornments';
fs.mkdirSync(sources, { recursive: true });
fs.mkdirSync(runtime, { recursive: true });
for (const [name, versions] of Object.entries(names)) {
  versions.forEach((id, index) => fs.copyFileSync(path.join(generated, `exec-${id}.png`), `${sources}/${name}-master-v${index + 1}.png`));
  fs.copyFileSync(`${sources}/${name}-master-v2.png`, `${runtime}/${name}-v2.png`);
}
