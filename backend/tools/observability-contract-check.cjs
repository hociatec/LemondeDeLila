const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const metrics = read('src/platform/observability/infrastructure/metrics/prometheus-metrics.ts');
const rules = read('observability/prometheus/lila-slo-rules.yml');
const alerts = read('observability/prometheus/lila-alerts.yml');
const dashboard = JSON.parse(read('observability/grafana/dashboards/backend-slo.json'));

for (const metric of [
  'lila_http_requests_total',
  'lila_http_request_duration_seconds',
  'lila_ws_messages_total',
  'lila_bullmq_jobs',
  'lila_dependency_up',
  'lila_dependency_saturation_ratio',
]) {
  assert.match(metrics, new RegExp(metric), `métrique absente: ${metric}`);
}
for (const objective of ['http_availability', 'http_latency', 'ws_error', 'bullmq_failed']) {
  assert.match(rules, new RegExp(objective), `SLO absent: ${objective}`);
}
for (const alert of [
  'LilaHttpAvailabilityBudgetBurn',
  'LilaHttpLatencyHigh',
  'LilaWebSocketErrorsHigh',
  'LilaBullmqBacklog',
  'LilaDependencyUnavailable',
  'LilaDependencySaturated',
]) {
  assert.match(alerts, new RegExp(`alert: ${alert}\\b`), `alerte absente: ${alert}`);
}
assert.ok(dashboard.panels.length >= 6, 'dashboard incomplet');
assert.equal(new Set(dashboard.panels.map((panel) => panel.id)).size, dashboard.panels.length);
console.log('observability-contract-check: OK');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}
