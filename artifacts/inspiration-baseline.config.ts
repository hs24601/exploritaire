import { defineConfig } from 'vitest/config';

// Verify the existing failures with this refactor's terminology reversed in memory.
export default defineConfig({
  plugins: [{
    name: 'restore-prior-resource-terminology',
    enforce: 'pre',
    transform(source, id) {
      if (!id.replaceAll('\\', '/').includes('/src/proto/')) return;
      return source.replaceAll('INSPIRATION', 'STAMINA').replaceAll('Inspiration', 'Stamina')
        .replaceAll('inspiration', 'stamina').replaceAll('staminaTesting', 'inspirationTesting');
    },
  }],
});
