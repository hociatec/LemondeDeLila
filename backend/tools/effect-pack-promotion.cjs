'use strict';

function assertPrimitiveSource(file, source, forbiddenVocabulary) {
  if (/game-specific|game\/games|core\//.test(source))
    throw new Error(
      `${file}: primitive implementation reaches a game or application layer`,
    );
  for (const word of forbiddenVocabulary) {
    const variants = [
      word,
      word[0]?.toUpperCase() + word.slice(1),
      word.toUpperCase(),
    ];
    if (
      variants.some((variant) => {
        const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(
          `${/^[a-z]/.test(variant) ? '(?<![a-z])' : ''}${escaped}(?=[A-Z0-9_.-]|\\b)`,
        ).test(source);
      })
    )
      throw new Error(
        `${file}: game vocabulary in primitive implementation: ${word}`,
      );
  }
}

function mechanicalShape(value) {
  if (typeof value === 'number') return '<parameter>';
  if (Array.isArray(value)) return value.map(mechanicalShape);
  if (!value || typeof value !== 'object') return value;
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
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .filter((key) => !descriptive.has(key))
      .map((key) => [key, mechanicalShape(value[key])]),
  );
}

function validatePromotion(name, profile, readEvidence) {
  if (profile.scope === 'game-specific') return;
  const review = profile.reuseReview;
  const fail = (reason) => {
    throw new Error(`${name}: ${reason}`);
  };
  const read = (file, pattern) => {
    if (
      typeof file !== 'string' ||
      !pattern.test(file) ||
      file.split('/').includes('..')
    )
      fail('invalid promotion evidence path');
    const content = readEvidence(file);
    if (typeof content !== 'string' || content.trim().length < 80)
      fail('promotion evidence must contain reviewed source text');
    return content;
  };
  if (!review)
    fail('promotion requires an accepted ADR and two independent consumers');
  const adr = read(review.adr, /^docs\/architecture\/adr-.+\.md$/).replaceAll(
    '\r\n',
    '\n',
  );
  if (
    !/^Status: accepted\s*$/m.test(adr) ||
    !adr.split('\n').includes(`Pack: ${name}`)
  )
    fail('promotion ADR must be accepted and name this pack');
  if (!Array.isArray(review.consumers) || review.consumers.length < 2)
    fail('promotion requires at least two independent consumers');
  const documents = new Set();
  const mechanics = new Set();
  const shapes = new Set();
  for (const consumer of review.consumers) {
    const source = JSON.parse(read(consumer.document, /^src\/game\/.+\.json$/));
    if (documents.has(consumer.document))
      fail('consumer documents must be distinct');
    documents.add(consumer.document);
    shapes.add(JSON.stringify(mechanicalShape(source)));
    if (
      profile.property &&
      !source.extensions?.some((item) => item.type === profile.property)
    )
      fail('each consumer must actually enable the promoted extension');
    const dimensions = ['objective', 'turnStructure', 'interaction'].map(
      (key) => {
        const value = consumer[key];
        if (typeof value !== 'string' || value.trim().length < 20)
          fail(`consumer requires an explicit ${key}`);
        return value.trim().toLowerCase();
      },
    );
    mechanics.add(JSON.stringify(dimensions));
    if (!adr.includes(consumer.document)) fail('ADR must review each consumer');
  }
  if (mechanics.size < 2) fail('renamed consumers are not different mechanics');
  if (shapes.size < 2)
    fail('copies or numeric parameter changes are not different mechanics');
  read(review.test, /^src\/game\/.+\.spec\.ts$/);
  if (!Array.isArray(review.tests) || !review.tests.includes(review.test))
    fail('promotion tests must include the independence test');
  for (const file of review.tests) read(file, /^src\/game\/.+\.spec\.ts$/);
  if (profile.scope === 'engine-primitive') {
    const primitive = profile.primitiveReview;
    if (!primitive || primitive.independentTest === primitive.compositionTest)
      fail(
        'primitive requires separate standalone and orthogonal composition tests',
      );
    const contract = read(
      profile.primitiveContract,
      /^src\/game\/engine\/runtime\/contracts\/.+\.ts$/,
    );
    if (/game-specific|game\/games|core\/|rules\//.test(contract))
      fail('primitive contract reaches a game or application layer');
    for (const file of [primitive.independentTest, primitive.compositionTest]) {
      read(file, /^src\/game\/.+\.spec\.ts$/);
      if (!review.tests.includes(file))
        fail('primitive tests must run in promotion CI');
    }
    if (
      !Array.isArray(primitive.forbiddenVocabulary) ||
      !primitive.forbiddenVocabulary.length
    )
      fail('primitive requires a reviewed game vocabulary deny-list');
    for (const word of primitive.forbiddenVocabulary) {
      if (typeof word !== 'string' || !word.trim())
        fail('invalid game vocabulary');
      if (contract.toLowerCase().includes(word.toLowerCase()))
        fail('game vocabulary in primitive contract');
    }
  }
  return [...new Set(review.tests)];
}

module.exports = { validatePromotion, assertPrimitiveSource };
