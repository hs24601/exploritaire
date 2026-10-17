# Painted den pose

The 2026-10-12 asset audit found that the map den pose and rest quest decoration bypassed Paint selection. Hero now has versioned low-camera and overhead sleeping cutouts, selected through `actorArt.ts`; Pixel keeps the originals. Mochi and the shared cuddle retain existing art until a companion paint pass is requested.

Source: `public/assets/actors/sources/hero-sleeping-watercolor-sheet-v1.png`. Runtime images: `public/assets/actors/watercolor-v1/hero-sleeping[-topdown]-watercolor-v1.png`. Measured source rows and alpha bounds are recorded in the sibling JSON. Packing only crops each equal-height row to its alpha bounds and adds an eight-pixel transparent gutter, preserving generated alpha.

ImageGen references: original Hero sleeping sprite and approved `hero-watercolor-v7-rich-loose-preview.png`. Prompt: two isolated equal-row sleeping dog poses, low front three-quarter and overhead nose-down, broad wet watercolor dabs, charcoal/slate and copper palette, opaque creamy blaze/muzzle/paws, sparse broken ink, small partially transparent spectral flame tail, no cave, scenery, text, shadows or paper texture. A follow-up requested removal of all background/glow while preserving body artwork and transparent tail edges.
