import { execSync } from 'node:child_process';

/** Brings the test database up to date once before any test file runs. */
export default function setup() {
  const url = process.env['DATABASE_URL_TEST'];
  if (!url) {
    throw new Error(
      'DATABASE_URL_TEST is not set. Run the tests with: docker compose run --rm server npm test\n' +
        'or set it to a PostgreSQL database whose name contains "test".',
    );
  }
  // The tests empty their tables. Refuse anything that does not look like a throwaway database.
  const database = new URL(url).pathname.replace(/^\//, '');
  if (!/test/i.test(database)) {
    throw new Error(`Refusing to run tests against "${database}": the database name must contain "test".`);
  }
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
}
