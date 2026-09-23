'use strict';

const crypto = require('node:crypto');

const scopes = Object.freeze(['game-specific', 'reusable', 'engine-primitive']);
const descriptive = new Set([
  'schemaVersion',
  'contentVersion',
  'definitionVersion',
  'world',
  'category',
  'presentation',
  'documentation',
  'name',
  'description',
  'label',
  'text',
  'prompt',
]);

// A renamed/copied document is not a second mechanical use case.
function mechanicalFingerprint(document) {
  if (Array.isArray(document.extensions)) {
    const { extensions, ...core } = document;
    document = {
      ...core,
      ...Object.fromEntries(
        extensions.map((extension) => [extension.type, extension.config]),
      ),
    };
  }
  function normalize(value) {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => !descriptive.has(key))
        .map((key) => [key, normalize(value[key])]),
    );
  }
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(normalize(document)))
    .digest('hex');
}

function classifyEffectPack(name, profile, consumers, readEvidence) {
  if (!scopes.includes(profile.scope))
    throw new Error(
      `${name}: explicit game-specific/reusable/engine-primitive scope required`,
    );
  if (
    typeof profile.classificationReason !== 'string' ||
    profile.classificationReason.trim().length < 80
  )
    throw new Error(`${name}: a precise classification reason is required`);
  if (!['experimental', 'reusable', 'stable'].includes(profile.maturity))
    throw new Error(
      `${name}: explicit experimental/reusable/stable maturity required`,
    );
  if (profile.maturity !== 'experimental' && profile.scope === 'game-specific')
    throw new Error(`${name}: maturity promotion requires demonstrated reuse`);
  const distinctMechanicalConsumers = new Set(
    consumers.map((consumer) => mechanicalFingerprint(consumer.source)),
  ).size;
  if (profile.scope !== 'game-specific') {
    // Evidence is reviewed and executable: counts alone never promote a pack.
    const evidence = profile.reuseReview;
    if (
      !evidence ||
      typeof evidence.rationale !== 'string' ||
      evidence.rationale.trim().length < 120 ||
      typeof evidence.test !== 'string' ||
      !/^src\/game\/.+\.spec\.ts$/.test(evidence.test) ||
      !readEvidence(evidence.test)
    )
      throw new Error(
        `${name}: reusable scope requires an executable independence review`,
      );
    if (
      distinctMechanicalConsumers < 2 &&
      evidence.kind !== 'independence-proof'
    )
      throw new Error(
        `${name}: two mechanically different games or an independence proof required`,
      );
    if (!['second-game', 'independence-proof'].includes(evidence.kind))
      throw new Error(`${name}: invalid reuse evidence kind`);
    if (
      profile.scope === 'engine-primitive' &&
      (typeof profile.primitiveContract !== 'string' ||
        !readEvidence(profile.primitiveContract))
    )
      throw new Error(
        `${name}: an engine primitive requires its independent contract`,
      );
  }
  if (profile.maturity === 'stable') {
    const review = profile.stabilityReview;
    if (
      !review ||
      !Number.isInteger(review.contractVersion) ||
      review.contractVersion < 1 ||
      typeof review.compatibilityPolicy !== 'string' ||
      !/^docs\/.+\.md$/.test(review.compatibilityPolicy) ||
      !readEvidence(review.compatibilityPolicy) ||
      !Array.isArray(review.tests) ||
      review.tests.length < 2 ||
      new Set(review.tests).size !== review.tests.length ||
      !review.tests.every(
        (file) =>
          typeof file === 'string' &&
          /^src\/game\/.+\.spec\.ts$/.test(file) &&
          readEvidence(file),
      )
    )
      throw new Error(
        `${name}: stable maturity requires versioned compatibility policy and distinct regression tests`,
      );
  }
  return {
    scope: profile.scope,
    maturity: profile.maturity,
    reason: profile.classificationReason,
    distinctMechanicalConsumers,
    reuseEvidence:
      profile.scope === 'game-specific'
        ? 'not-demonstrated'
        : profile.reuseReview.kind,
  };
}

module.exports = { scopes, mechanicalFingerprint, classifyEffectPack };
