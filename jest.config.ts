import type { Config } from 'jest';

const config: Config = {
  // Use ts-jest preset for TypeScript support
  preset: 'ts-jest',

  // Set test environment to Node.js (not browser)
  testEnvironment: 'node',

  // Root directory for tests
  roots: ['<rootDir>/src'],

  // Test file patterns
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],

  // Module name mapping for path aliases
  moduleNameMapper: {
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@view/(.*)$': '<rootDir>/src/view/$1',
    '^@game/(.*)$': '<rootDir>/src/game/$1',
    '^@pixijs/(.*)$': '<rootDir>/src/pixi/$1',
  },

  // Transform files with ts-jest
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          // Override some tsconfig options for tests
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          verbatimModuleSyntax: false, // Disable for Jest compatibility
          module: 'CommonJS',
        },
      },
    ],
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/core/**/*.ts',
    '!src/core/**/*.d.ts',
    '!src/core/**/index.ts',
    // Exclude view files from coverage (hard to test with Pixi.js)
    '!src/view/**/*.ts',
  ],

  // Coverage thresholds (excluding GameController and pathfinding)
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 50,
      lines: 40,
      statements: 40,
    },
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
};

export default config;
