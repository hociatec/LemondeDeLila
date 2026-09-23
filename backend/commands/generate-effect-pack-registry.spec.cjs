'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  renderRegistry,
  validateIntroduction,
  generateEffectPackRegistry,
} = require('./generate-effect-pack-registry.cjs');
const profile = { scope: 'game-specific' };
const policy = {
  registrationOrder: ['race-track', 'cards-draw'],
  profiles: { 'race-track': profile, 'cards-draw': profile },
};
const reference = { effectPacks: ['cards-draw', 'race-track'] };

test('generated registry matches the controlled metadata', () =>
  generateEffectPackRegistry({ check: true }));
test('registry is deterministic and preserves explicitly reviewed precedence', () => {
  const source = renderRegistry(policy, reference, () => false);
  assert.equal(
    source,
    renderRegistry(
      { ...policy, profiles: { 'cards-draw': profile, 'race-track': profile } },
      reference,
      () => false,
    ),
  );
  assert(
    source.indexOf('  raceTrackEffectPack,') <
      source.indexOf('  cardsDrawEffectPack,'),
  );
  assert(source.includes('domains.get(pack.domain)'));
  assert(!source.includes('readdirSync'));
});
test('missing and duplicate registrations fail instead of silently dropping a pack', () => {
  for (const registrationOrder of [
    ['race-track'],
    ['race-track', 'race-track'],
  ])
    assert.throws(
      () =>
        renderRegistry({ ...policy, registrationOrder }, reference, () => true),
      /exactly once/,
    );
});
test('new pack requires a reviewed failure to compose existing mechanisms', () => {
  assert.throws(
    () => validateIntroduction('choice-new', {}, reference, () => true),
    /new effect-pack requires/,
  );
  const profile = {
    introductionReview: {
      existingMechanisms: ['actions + effects + conditions + phases'],
      insufficiency:
        'The proposed behavior requires a capability that is not expressible by the existing composition. The ADR contains the attempted composition, the missing invariant and the smallest contract needed to implement it.',
      adr: 'docs/architecture/adr-new-mechanic.md',
      test: 'src/game/testing/new-mechanic.spec.ts',
    },
  };
  assert.doesNotThrow(() =>
    validateIntroduction('choice-new', profile, reference, () => true),
  );
  assert.throws(
    () => validateIntroduction('choice-new', profile, reference, () => false),
    /new effect-pack requires/,
  );
});
