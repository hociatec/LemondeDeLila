const path = require('node:path');

const TEST_SECRET = 'test-only-secret-with-at-least-32-characters';

function prepareEnvironment() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_ALGORITHM = 'HS256';
  process.env.JWT_SECRET ||= TEST_SECRET;
  process.env.WS_TICKET_SECRET ||= TEST_SECRET;
  process.env.LOG_FILES_ENABLED = 'false';
}

function fail(error) {
  const message = error instanceof Error ? error.stack : String(error);
  process.stderr.write(`[verify:app-load] ${message}\n`);
  process.exit(1);
}

function main() {
  prepareEnvironment();
  const appModulePath = path.resolve(process.cwd(), 'dist', 'app.module.js');

  try {
    const loaded = require(appModulePath);
    if (typeof loaded.AppModule !== 'function') {
      throw new Error(`AppModule export not found in ${appModulePath}`);
    }
    process.stdout.write(
      '[verify:app-load] compiled AppModule loaded successfully\n',
    );
  } catch (error) {
    fail(error);
  }
}

main();
