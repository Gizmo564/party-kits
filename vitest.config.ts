import { defineConfig } from 'vitest/config';

// Runs every package's own tests. Web tests opt in to jsdom with `// @vitest-environment jsdom` at the top of the file.
// Packages import each other as @gizmo564/<kit>, which npm workspaces link into node_modules.
export default defineConfig({
  // @ts-expect-error vite 8 types may not list esbuild options; vitest still honours it for tsx
  esbuild: { jsx: 'automatic' },
  test: { include: ['packages/*/**/*.test.{ts,tsx}'], exclude: ['**/node_modules/**', 'packages/create-game/template/**'] },
});
