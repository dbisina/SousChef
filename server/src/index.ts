import { buildApp } from './app';
import { loadConfig } from './config';

async function main() {
  const config = loadConfig();
  const { app } = await buildApp({ config });

  // Stop cleanly when the platform asks: finish requests in flight, close database connections, then exit.
  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    app.log.info({ signal }, 'shutting down');
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'error while shutting down');
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void stop('SIGTERM'));
  process.on('SIGINT', () => void stop('SIGINT'));

  await app.listen({ host: config.HOST, port: config.PORT });
}

main().catch((err) => {
  // Logging is not set up if the configuration itself is wrong, so this is the one place that writes to stderr directly.
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
