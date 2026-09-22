const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('yaml');

const root = path.resolve(__dirname, '..');
const metrics = read('src/platform/observability/infrastructure/metrics/prometheus-metrics.ts');
const rules = read('observability/prometheus/lila-slo-rules.yml');
const alerts = read('observability/prometheus/lila-alerts.yml');
const dashboard = JSON.parse(read('observability/grafana/dashboards/backend-slo.json'));
const scenarios = yaml.parse(read('observability/prometheus/lila-alerts.test.yml')).tests;
for (const rule of yaml.parse(alerts).groups.flatMap(group => group.rules)) {
  const checks = scenarios.flatMap(test => test.alert_rule_test ?? []).filter(check => check.alertname === rule.alert);
  assert(checks.some(check => check.exp_alerts.length > 0), `missing firing assertion: ${rule.alert}`);
  assert(checks.some(check => check.exp_alerts.length === 0), `missing healthy assertion: ${rule.alert}`);
  assert(scenarios.some(test => {
    const sequence = (test.alert_rule_test ?? []).filter(check => check.alertname === rule.alert);
    const firingIndex = sequence.findIndex(check => check.exp_alerts.length > 0);
    return firingIndex >= 0 && sequence.slice(firingIndex + 1).some(check => check.exp_alerts.length === 0);
  }), `missing recovery assertion: ${rule.alert}`);
}

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
  'LilaBackendMetricsUnavailable',
  'LilaHttpAvailabilityBudgetBurn',
  'LilaHttpLatencyHigh',
  'LilaWebSocketErrorsHigh',
  'LilaBullmqBacklog',
  'LilaDependencyUnavailable',
  'LilaDependencySaturated',
  'LilaRecoverySessionsDeferred',
  'LilaRecoveryStalled',
  'LilaMemoryCapacitySaturated',
  'LilaMemoryCapacityRefusals',
  'LilaDistributedLeaseLost',
]) {
  assert.match(alerts, new RegExp(`alert: ${alert}\\b`), `alerte absente: ${alert}`);
}
assert.ok(dashboard.panels.length >= 13, 'dashboard incomplet');
for (const metric of ['lila_game_recovery_sweeps_total', 'lila_distributed_lease_losses_total', 'lila_memory_capacity_ratio']) {
  assert(dashboard.panels.some(panel => panel.targets.some(target => target.expr.includes(metric))), `dashboard: ${metric}`);
}
assert.equal(new Set(dashboard.panels.map((panel) => panel.id)).size, dashboard.panels.length);
const testedExpressions = scenarios.flatMap(test => test.promql_expr_test ?? []).map(test => test.expr);
const bullmqPanel = dashboard.panels.find(panel => panel.title === 'BullMQ');
assert(bullmqPanel?.targets.length, 'missing BullMQ dashboard panel');
for (const target of bullmqPanel.targets)
  assert(testedExpressions.includes(target.expr), 'BullMQ dashboard expression must be tested by promtool');
console.log('observability-contract-check: OK');

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}
