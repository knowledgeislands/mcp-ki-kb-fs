import * as os from 'node:os'
import * as path from 'node:path'
import { defineConfig } from 'vitest/config'

const TEST_ROOT = path.join(os.tmpdir(), 'mcp-kb-tests')

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      ROOT_PATH: TEST_ROOT
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      }
    }
  }
})
