# Hero overhead standing correction

Removed the extra pair of trailing leaping legs from Hero's standing bird's-eye frame. The four small shoulder/hip paws remain, with a compact rounded rump. The other four elevated views are copied pixel-for-pixel from v3; atlas dimensions and rig registration are unchanged. The shared `heroHigh` Paint asset supplies the correction to map, combat and actor previews. Walking, sitting and Pixel art retain their existing assets.

Built-in ImageGen produced the transparent source at `public/assets/sources/characters/hero/rig/watercolor/v4/hero-standing-overhead-four-paws-source-v4.png`. The integrated atlas is `public/assets/runtime/characters/hero/rig/watercolor/v4/hero-directions-high-body-v4.png`. Historical v3 remains available.

Final prompt: “Extract ONLY the bottom top-down standing four-pawed dog as an isolated transparent PNG sprite. Remove ALL background including the brown glow and black area. NO shadow, NO glow, NO backdrop, genuinely transparent alpha immediately outside the fur. Preserve this exact bottom dog's compact rounded rump, four small sideways paws (two at shoulders, two at hips), head pointing up, fur pattern, bird's-eye pose and watercolor style. Do not include any of the other four dogs. Center this one dog with small transparent padding. No extra legs, no trailing leaping paws, no tail extension.”

Asset preparation crops the transparent source's alpha bounds and registers it at `[77,1026,164,280]` in the original 1024×1536 atlas, clearing only the old `[71,1022,174,398]` overhead region. See `output/prepare-hero-overhead.mjs` for the preparation script.
