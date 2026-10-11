import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// One runner for the whole game. Web tests opt in to jsdom with `// @vitest-environment jsdom` at the top of the file.
// Kit tests are not copied into a game by default (they live in the kits repo); `new-game.mjs --with-kit-tests` copies them and they run here too.
export default defineConfig({
  plugins: [react()],
  test: { include: ['packages/**/*.test.{ts,tsx}'] },
});
