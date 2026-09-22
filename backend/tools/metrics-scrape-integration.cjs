'use strict';
// Exercise the actual authenticated Nest endpoint with a real Prometheus scraper.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { generateKeyPairSync } = require('node:crypto');
const yaml = require('yaml');

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function main() {
  const binary = process.env.PROMETHEUS_BINARY;
  assert(binary && fs.existsSync(binary), 'PROMETHEUS_BINARY must identify an installed test binary');
  require('reflect-metadata');
  require('ts-node').register({
    project: path.join(__dirname, '../tsconfig.json'), transpileOnly: true,
  });
  const { Test } = require('@nestjs/testing');
  const { sign } = require('jsonwebtoken');
  const { ObservabilityModule } = require('../src/platform/observability/observability.module');
  const { JwtPayloadVerifierService } = require('../src/platform/auth/application/services/jwt-payload-verifier.service');
  const { prometheusMetrics } = require('../src/platform/observability/infrastructure/metrics/prometheus-metrics');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const token = roles => sign({ roles }, privateKey, {
    algorithm: 'RS256', issuer: 'metrics-integration', subject: '1', expiresIn: 3600,
  });
  const module = await Test.createTestingModule({ imports: [ObservabilityModule] })
    .overrideProvider(JwtPayloadVerifierService)
    .useValue(new JwtPayloadVerifierService({
      jwtPrivateKeyPem: null, jwtPrivateKeyPath: null,
      jwtPublicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      jwtPublicKeyPath: null, jwtIssuer: 'metrics-integration', jwtAudience: null,
      jwtClockToleranceSeconds: 0,
    })).compile();
  const app = module.createNestApplication({ logger: false });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-metrics-scrape-'));
  let child, closed, childError;
  let childLog = '';
  let prometheusPort;
  const sample = async (query, expected) => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (childError || child.exitCode !== null)
        throw new Error(`Prometheus stopped: ${childError?.message ?? childLog}`);
      try {
        const response = await fetch(`http://127.0.0.1:${prometheusPort}/api/v1/query?query=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(1000) });
        const body = await response.json();
        if (body.status === 'success' && body.data.result.length === 1 &&
            Number(body.data.result[0].value[1]) === expected) return;
      } catch { /* The process may still be starting its HTTP listener. */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    const targets = await fetch(`http://127.0.0.1:${prometheusPort}/api/v1/targets`, { signal: AbortSignal.timeout(2000) }).then(response => response.json());
    throw new Error(`Expected ${query} = ${expected}; scrape errors: ${JSON.stringify(targets.data.activeTargets.map(target => target.lastError))}`);
  };
  try {
    await app.listen(0, '127.0.0.1');
    const port = app.getHttpServer().address().port;
    const credentials = path.join(directory, 'token');
    fs.writeFileSync(credentials, token(['ROLE_ADMIN']), { mode: 0o600 });
    prometheusMetrics.setActiveRooms(3);
    prometheusPort = await unusedPort();
    const config = path.join(directory, 'prometheus.yml');
    fs.writeFileSync(config, yaml.stringify({
      global: { scrape_interval: '1s', scrape_timeout: '1s' },
      scrape_configs: [{
        job_name: 'lila-backend', metrics_path: '/metrics',
        authorization: { type: 'Bearer', credentials_file: credentials },
        static_configs: [{ targets: [`127.0.0.1:${port}`] }],
      }],
    }));
    child = spawn(binary, [
      `--config.file=${config}`, `--storage.tsdb.path=${path.join(directory, 'data')}`,
      `--web.listen-address=127.0.0.1:${prometheusPort}`,
    ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { childLog = (childLog + chunk).slice(-12000); });
    child.stderr.on('data', chunk => { childLog = (childLog + chunk).slice(-12000); });
    child.on('error', error => { childError = error; });
    closed = new Promise(resolve => child.once('close', resolve));
    const up = 'up{job="lila-backend"}';
    await sample(up, 1);
    await sample('lila_active_rooms{job="lila-backend"}', 3);
    fs.writeFileSync(credentials, 'invalid-token');
    await sample(up, 0);
    fs.writeFileSync(credentials, token(['ROLE_ADMIN']));
    await sample(up, 1);
    fs.writeFileSync(credentials, token(['ROLE_USER']));
    await sample(up, 0);
    fs.writeFileSync(credentials, token(['ROLE_ADMIN']));
    await sample(up, 1);
    await sample('lila_active_rooms{job="lila-backend"}', 3);
    console.log(JSON.stringify({ authenticatedScrape: true, actualRegistrySample: 3,
      invalidTokenRejected: true, nonAdminRejected: true, credentialRenewalRecovered: true,
      loopbackOnly: true }));
  } finally {
    if (child && child.exitCode === null) child.kill();
    if (closed) await closed;
    await app.close();
    const absolute = path.resolve(directory);
    assert.equal(path.dirname(absolute), path.resolve(os.tmpdir()));
    assert(path.basename(absolute).startsWith('lila-metrics-scrape-'));
    fs.rmSync(absolute, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
