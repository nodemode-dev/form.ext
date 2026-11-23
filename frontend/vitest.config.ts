import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { fs: { allow: ['..'] } },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'happy-dom',
    restoreMocks: true,
    testTimeout: 20000,
  },
});
