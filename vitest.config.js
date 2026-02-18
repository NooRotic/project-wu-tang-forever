import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.{js,jsx}'],
    exclude: ['node_modules', 'dist'],
  },
});
