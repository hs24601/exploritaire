# Painted woods cutouts v1

Eric's 2026-10-12 feedback replaces the painted relief trial with direct watercolor sprite artwork. The supplied three-tree image is the approved starting aesthetic. No new artwork was generated for this change.

- `public/assets/runtime/environment/watercolor/v1/woods-cluster-sprite-v1.png` is a byte-for-byte copy of the supplied image, retaining its original transparent alpha and brushwork. It replaces Small/Dark Woods' painted immersive and inspection art and the combat-demo woods.
- `public/assets/runtime/environment/watercolor/v1/pine-sprite-v1.png` retains the matching original single-pine artwork from the preceding pass, without relief reconstruction. It supplies the Old Tree and woods edge cutouts.
- `public/assets/runtime/environment/watercolor/v1/woods-overhead-v1.png` remains the matching overhead print. Original artwork, prompts and the relief experiment remain recorded in `watercolor-woods-relief-v1.md`.

`sceneryArt.ts` selects versioned Paint counterparts. These sprite filenames intentionally have no volume recipe: the browser composites the full source image with smooth sampling. Immersive trees billboard toward the orbital camera. Ground fitting reserves all camera headings up front so trunk anchors remain fixed inside their owning tile. The existing scenery occlusion mask opens around the real actor, and shared lighting and alpha-silhouette shadows remain active.

Discovered painted trees show their complete color immediately. Painted Dark Woods keep the source palette instead of the older red recoloring filter; their danger ground, warning and atmosphere remain. Discovery, travel, exploration rewards and interactions are unchanged. Pixel still selects the existing solids and sources; scenery without a painted counterpart retains its existing artwork.

Validation evidence is retained in `artifacts/painted-woods-sprites-v1/`; run `node tools/painted-woods-sprites-playwright.cjs` against the local Proto server for isolated mouse/touch checks.
