import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Deterministic test-only configuration (see jest.setup-env.ts). Without
  // this the end-to-end suite could not even load its module graph.
  setupFiles: ['<rootDir>/jest.setup-env.ts'],
};

export default config;