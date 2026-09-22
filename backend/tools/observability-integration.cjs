'use strict';
// Real Prometheus -> Alertmanager -> loopback webhook, in an owned test directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const yaml = require('yaml');

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server.address().port;
}
async function freePort() {
  const socket = net.createServer();
  const port = await listen(socket);
  await new Promise(resolve => socket.close(resolve));
  return port;
}

async function ready(url) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      await response.arrayBuffer();
      if (response.ok) return;
    } catch { /* The child may not yet have bound its loopback port. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Alertmanager readiness deadline exceeded');
}

async function main() {
  for (const key of ['PROMETHEUS_BINARY', 'ALERTMANAGER_BINARY'])
    assert(process.env[key] && fs.existsSync(process.env[key]), `${key} must identify an installed test binary`);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-observability-'));
  const children = [];
  const received = { firing: new Set(), resolved: new Set() };
  let prometheusPort;
  let healthy = false;
  let requests = 0, errors = 0, quick = 0, failures = 0, sweeps = 0;
  const exporter = http.createServer((request, response) => {
    if (request.url === '/probe') {
      response.writeHead(healthy ? 200 : 503, { 'Content-Type': 'text/plain' }).end('');
      return;
    }
    if (request.url === '/webhook') {
      let body = '';
      request.on('data', chunk => { body += chunk; });
      request.on('end', () => {
        try {
          for (const alert of JSON.parse(body).alerts) {
            assert.equal(alert.labels.service, 'le-monde-de-lila');
            received[alert.status].add(alert.labels.alertname);
          }
          response.writeHead(200).end('ok');
        } catch { response.writeHead(400).end('invalid alert'); }
      });
      return;
    }
    requests += 10;
    if (healthy) { quick += 10; sweeps++; } else { errors++; failures++; }
    response.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4' });
    response.end([
      `lila_http_requests_total{status="200"} ${requests}`,
      `lila_http_requests_total{status="500"} ${errors}`,
      `lila_ws_messages_total{outcome="success"} ${requests}`,
      `lila_ws_messages_total{outcome="error"} ${errors}`,
      `lila_http_request_duration_seconds_bucket{le="0.1"} ${quick}`,
      `lila_http_request_duration_seconds_bucket{le="0.5"} ${quick}`,
      `lila_http_request_duration_seconds_bucket{le="1"} ${requests}`,
      `lila_http_request_duration_seconds_bucket{le="+Inf"} ${requests}`,
      `lila_bullmq_jobs{state="waiting"} ${healthy ? 0 : 101}`,
      `lila_bullmq_failures_total{queue="game-engine-tasks"} ${failures}`,
      `lila_dependency_up{dependency="redis"} ${healthy ? 1 : 0}`,
      `lila_dependency_saturation_ratio{dependency="mysql",resource="pool"} ${healthy ? 0.1 : 0.9}`,
      `lila_game_recovery_deferred_sessions ${healthy ? 0 : 1}`,
      `lila_memory_capacity_ratio{resource="game-sessions"} ${healthy ? 0.1 : 0.9}`,
      `lila_memory_capacity_refusals_total{resource="game-sessions"} ${failures}`,
      `lila_game_recovery_sweeps_total ${sweeps}`,
      'lila_active_rooms 1',
      `lila_distributed_lease_losses_total ${failures}`,
      '',
    ].join('\n'));
  });
  const launch = (binary, args) => {
    const process = spawn(binary, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const record = { process, log: '', error: null };
    process.stdout.on('data', chunk => { record.log = (record.log + chunk).slice(-16000); });
    process.stderr.on('data', chunk => { record.log = (record.log + chunk).slice(-16000); });
    process.on('error', error => { record.error = error; });
    record.closed = new Promise(resolve => process.once('close', resolve));
    children.push(record);
  };
  const awaitAll = async (status, names) => {
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      for (const child of children)
        if (child.error || child.process.exitCode !== null)
          throw new Error(`Monitoring process stopped: ${child.error?.message ?? child.log}`);
      if (names.every(name => received[status].has(name))) return;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const rules = await fetch(`http://127.0.0.1:${prometheusPort}/api/v1/rules`, { signal: AbortSignal.timeout(5000) }).then(response => response.json());
    const diagnostics = rules.data.groups.flatMap(group => group.rules.map(rule => ({ name: rule.name, state: rule.state, lastError: rule.lastError })));
    throw new Error(`Missing ${status} webhooks: ${names.filter(name => !received[status].has(name)).join(', ')}; rules=${JSON.stringify(diagnostics)}`);
  };
  try {
    const port = await listen(exporter);
    const alertPort = await freePort();
    prometheusPort = await freePort();
    const original = yaml.parse(fs.readFileSync('observability/prometheus/lila-alerts.yml', 'utf8'));
    const names = original.groups.flatMap(group => group.rules.map(rule => rule.alert));
    for (const file of ['lila-alerts.yml', 'lila-slo-rules.yml']) {
      const rules = yaml.parse(fs.readFileSync(`observability/prometheus/${file}`, 'utf8'));
      // Only this disposable copy uses accelerated time; promtool tests real durations.
      for (const group of rules.groups) {
        group.interval = '1s';
        for (const rule of group.rules) {
          if (rule.for) rule.for = '0s';
          rule.expr = rule.expr.replace(/\[\d+m\]/g, '[5s]');
        }
      }
      fs.writeFileSync(path.join(directory, file), yaml.stringify(rules));
    }
    fs.writeFileSync(path.join(directory, 'alertmanager.yml'), yaml.stringify({
      global: { resolve_timeout: '5s' },
      route: { receiver: 'test-webhook', group_by: ['alertname'], group_wait: '0s', group_interval: '1s', repeat_interval: '1m' },
      receivers: [{ name: 'test-webhook', webhook_configs: [{ url: `http://127.0.0.1:${port}/webhook`, send_resolved: true }] }],
    }));
    fs.writeFileSync(path.join(directory, 'prometheus.yml'), yaml.stringify({
      global: { scrape_interval: '1s', evaluation_interval: '1s' },
      rule_files: ['lila-alerts.yml', 'lila-slo-rules.yml'],
      scrape_configs: [
        { job_name: 'test-exporter', static_configs: [{ targets: [`127.0.0.1:${port}`] }] },
        { job_name: 'lila-backend', metrics_path: '/probe', static_configs: [{ targets: [`127.0.0.1:${port}`] }] },
      ],
      alerting: { alertmanagers: [{ static_configs: [{ targets: [`127.0.0.1:${alertPort}`] }] }] },
    }));
    launch(process.env.ALERTMANAGER_BINARY, [`--config.file=${path.join(directory, 'alertmanager.yml')}`, `--storage.path=${path.join(directory, 'alerts')}`, `--web.listen-address=127.0.0.1:${alertPort}`, '--cluster.listen-address=']);
    await ready(`http://127.0.0.1:${alertPort}/-/ready`);
    // Discovery can miss the very first absent-target alert. Accelerate resend,
    // like evaluation windows above, instead of waiting the production minute.
    launch(process.env.PROMETHEUS_BINARY, [`--config.file=${path.join(directory, 'prometheus.yml')}`, `--storage.tsdb.path=${path.join(directory, 'metrics')}`, `--web.listen-address=127.0.0.1:${prometheusPort}`, '--rules.alert.resend-delay=2s']);
    await awaitAll('firing', names);
    healthy = true;
    await awaitAll('resolved', names);
    assert.equal(received.firing.size, names.length);
    assert.equal(received.resolved.size, names.length);
    console.log(JSON.stringify({ alerts: names.length, firingWebhooks: received.firing.size, resolvedWebhooks: received.resolved.size, loopbackOnly: true }));
  } finally {
    for (const child of children) if (child.process.exitCode === null) child.process.kill();
    await Promise.all(children.map(child => child.closed));
    await new Promise(resolve => exporter.close(resolve));
    const absolute = path.resolve(directory);
    assert.equal(path.dirname(absolute), path.resolve(os.tmpdir()));
    assert(path.basename(absolute).startsWith('lila-observability-'));
    fs.rmSync(absolute, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
