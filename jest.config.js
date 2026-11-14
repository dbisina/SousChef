module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  modulePathIgnorePatterns: ['<rootDir>/functions/', '<rootDir>/.expo/', '<rootDir>/dist/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
};
