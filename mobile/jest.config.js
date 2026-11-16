module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/functions/', '<rootDir>/.expo/', '<rootDir>/dist/'],
  moduleNameMapper: { '^@shared/(.*)$': '<rootDir>/../shared/$1', '^@/(.*)$': '<rootDir>/$1' },
  modulePaths: ['<rootDir>/node_modules'],
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
};
