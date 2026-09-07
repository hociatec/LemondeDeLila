const path = require('node:path');
const { generateKeyPairSync } = require('node:crypto');

const TEST_SECRET = 'test-only-secret-with-at-least-32-characters';

function prepareEnvironment() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  process.env.NODE_ENV = 'test';
  process.env.IGNORE_ENV_FILE = 'true';
  process.env.JWT_ALGORITHM = 'RS256';
  process.env.JWT_PRIVATE_KEY_PEM = privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  });
  process.env.JWT_PUBLIC_KEY_PEM = publicKey.export({
    type: 'spki',
    format: 'pem',
  });
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
