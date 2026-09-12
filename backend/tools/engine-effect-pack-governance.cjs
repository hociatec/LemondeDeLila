#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const { inspectSources } = require('./game-structural-sequences.cjs');

const ROOT = path.resolve(__dirname, '..');
const EFFECT_PACKS = path.join(ROOT, 'src/game/engine/runtime/effect-packs');
const GAMES = path.join(ROOT, 'src/game/games');
const GAMEPLAY = path.join(ROOT, 'src/game/engine/runtime/recipes/gameplay');
const ENGINE_RUNTIME = path.join(ROOT, 'src/game/engine/runtime');
const policy = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, 'engine-effect-pack-governance.json'),
    'utf8',
  ),
);

const sourceLines = (source) =>
  source.split(/\r?\n/).length - (source.endsWith('\n') ? 1 : 0);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const upperFirst = (value) => value[0].toUpperCase() + value.slice(1);

function files(directory, name) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory()
      ? files(absolute, name)
      : !name || entry.name === name
        ? [absolute]
        : [];
  });
}

const programFiles = files(EFFECT_PACKS, 'program.ts');
const discovered = programFiles
  .map((file) => path.basename(path.dirname(file)))
  .sort();
const declared = Object.keys(policy.profiles).sort();
if (JSON.stringify(discovered) !== JSON.stringify(declared))
  throw new Error('Every program profile must be explicitly classified');

const familyByProfile = new Map();
for (const [family, profiles] of Object.entries(policy.effectDomains)) {
  for (const profile of profiles) {
    if (familyByProfile.has(profile))
      throw new Error(`${profile} belongs to more than one mechanic family`);
    familyByProfile.set(profile, family);
  }
}
if (
  JSON.stringify([...familyByProfile.keys()].sort()) !==
  JSON.stringify(declared)
)
  throw new Error(
    'Every effect pack must belong to exactly one reviewed mechanic family',
  );

const gameDocuments = files(GAMES, 'game.json').map((file) => ({
  file,
  source: JSON.parse(fs.readFileSync(file, 'utf8')),
}));
const gameCodes = files(GAMES, 'manifest.json').map(
  (file) => JSON.parse(fs.readFileSync(file, 'utf8')).code,
);
let lines = 0;
let productionLines = 0;
let behaviorLines = 0;
const report = [];
for (const name of declared) {
  const profile = policy.profiles[name];
  if (!profile.mechanic || !profile.domain)
    throw new Error(`Incomplete capability classification for ${name}`);
  if (profile.domain !== familyByProfile.get(name))
    throw new Error(`Capability domain mismatch for ${name}`);
  if (!name.startsWith(`${profile.domain}-`))
    throw new Error(
      `${name} must be named after its effect domain and mechanic`,
    );

  const programFile = path.join(EFFECT_PACKS, name, 'program.ts');
  const program = fs.readFileSync(programFile, 'utf8');
  if (
    /Single-consumer JSON authoring extension|Reusable JSON authoring extension/.test(
      program,
    )
  )
    throw new Error(
      `Legacy prose classification remains in ${name}/program.ts`,
    );
  if (
    /\bexport\s+(?:const|let|var|function|class|enum|namespace)\b/.test(program)
  )
    throw new Error(`Executable logic is forbidden in ${name}/program.ts`);

  const count = sourceLines(program);
  lines += count;

  const effectPackDirectory = path.join(EFFECT_PACKS, name);
  const profileLines = files(effectPackDirectory)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'))
    .reduce(
      (total, file) => total + sourceLines(fs.readFileSync(file, 'utf8')),
      0,
    );
  productionLines += profileLines;
  const profileBehaviorLines = profileLines - (profile.property ? 2 : 0);
  behaviorLines += profileBehaviorLines;
  for (const sourceFile of files(effectPackDirectory).filter((file) =>
    file.endsWith('.ts'),
  )) {
    const source = fs.readFileSync(sourceFile, 'utf8');
    for (const match of source.matchAll(
      /\b(?:from\s+|import\s*\()(['"])([^'"]+)\1/g,
    )) {
      if (!match[2].startsWith('.')) continue;
      const target = path.resolve(path.dirname(sourceFile), match[2]);
      const relativeTarget = path.relative(EFFECT_PACKS, target);
      if (
        !relativeTarget.startsWith('..') &&
        relativeTarget.split(path.sep)[0] !== name
      )
        throw new Error(
          `${path.relative(EFFECT_PACKS, sourceFile)} imports another effect-pack implementation: ${match[2]}`,
        );
    }
    for (const gameCode of gameCodes) {
      const namespace = new RegExp(
        `[\\'\\"\\x60]${escapeRegExp(gameCode)}[._-]`,
      );
      if (namespace.test(source))
        throw new Error(
          `${path.relative(EFFECT_PACKS, sourceFile)} contains the game namespace ${gameCode}`,
        );
    }
  }

  const consumers = profile.property
    ? gameDocuments.filter(({ source: document }) =>
        Object.hasOwn(document, profile.property),
      )
    : [];
  const scope = 'generic';
  if (profile.property && consumers.length !== 1)
    throw new Error(
      `${name} must have its actual consumer count reviewed (found ${consumers.length})`,
    );

  if (profile.property) {
    const effectPackFile = path.join(EFFECT_PACKS, name, 'effect-pack.ts');
    if (!fs.existsSync(effectPackFile))
      throw new Error(`${name}/effect-pack.ts is required`);
    const effectPack = fs.readFileSync(effectPackFile, 'utf8');
    if (!effectPack.includes(`scope: '${scope}'`))
      throw new Error(`${name}/effect-pack.ts has the wrong structured scope`);
    if (!effectPack.includes(`domain: '${profile.domain}'`))
      throw new Error(`${name}/effect-pack.ts has the wrong effect domain`);
    for (const contribution of [
      'defineJsonEffectPack',
      'documentKey:',
      'schema:',
      'compile:',
      'handlers:',
      'actions:',
      'validate:',
    ])
      if (!effectPack.includes(contribution))
        throw new Error(`${name}/effect-pack.ts does not own ${contribution}`);
    if (!effectPack.includes(`documentKey: '${profile.property}'`))
      throw new Error(`${name}/effect-pack.ts has the wrong document key`);
  }

  report.push({
    name,
    family: familyByProfile.get(name),
    scope,
    ...profile,
    reason: `generic ${profile.domain} capability: ${profile.mechanic}`,
    productionLines: profileLines,
    behaviorLines: profileBehaviorLines,
    consumerCount: consumers.length,
    linesPerConsumer:
      consumers.length === 0
        ? null
        : Math.round(profileLines / consumers.length),
    reuseEvidence:
      consumers.length > 1
        ? 'demonstrated'
        : consumers.length === 1
          ? 'designed'
          : 'support-profile',
    reviewRequired:
      consumers.length === 1 &&
      profileLines >= policy.largeSingleConsumerReviewLines,
    review: policy.largeSingleConsumerReviews[name] ?? null,
    consumers: consumers.map(({ file }) =>
      path.relative(GAMES, file).replaceAll(path.sep, '/'),
    ),
  });
}

for (const sourceFile of files(ENGINE_RUNTIME).filter(
  (file) => file.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(file),
)) {
  const source = fs.readFileSync(sourceFile, 'utf8');
  for (const gameCode of gameCodes) {
    if (source.includes(gameCode))
      throw new Error(
        `${path.relative(ENGINE_RUNTIME, sourceFile)} contains the game code ${gameCode}`,
      );
  }
  for (const alias of policy.forbiddenEngineVocabulary) {
    const variants = [alias, upperFirst(alias), alias.toUpperCase()];
    if (
      variants.some((variant) => {
        const prefix = /^[a-z]/.test(variant) ? '(?<![a-z])' : '';
        return new RegExp(
          `${prefix}${escapeRegExp(variant)}(?=[A-Z0-9_.-]|\\b)`,
        ).test(source);
      })
    )
      throw new Error(
        `${path.relative(ENGINE_RUNTIME, sourceFile)} contains legacy game vocabulary ${alias}`,
      );
  }
}

const requiredLargeReviews = report
  .filter((item) => item.reviewRequired)
  .map((item) => item.name)
  .sort();
const declaredLargeReviews = Object.keys(
  policy.largeSingleConsumerReviews,
).sort();
if (
  JSON.stringify(requiredLargeReviews) !== JSON.stringify(declaredLargeReviews)
)
  throw new Error(
    'Every large single-consumer effect pack must have exactly one current generalization review',
  );
for (const name of requiredLargeReviews) {
  if (policy.largeSingleConsumerReviews[name].trim().length < 80)
    throw new Error(`The generalization review for ${name} is too vague`);
}

const structuralSources = declared.flatMap((name) =>
  files(path.join(EFFECT_PACKS, name))
    .filter((file) => file.endsWith('.ts') && !/\.(spec|test)\.ts$/.test(file))
    .map((file) => ({
      game: name,
      file: path.relative(EFFECT_PACKS, file).replaceAll(path.sep, '/'),
      source: fs.readFileSync(file, 'utf8'),
    })),
);
const structuralReport = inspectSources(structuralSources);
const structuralKey = (operations, profiles) =>
  JSON.stringify({ operations, profiles: [...profiles].sort() });
const detectedStructuralReviews = structuralReport.candidates.map((candidate) =>
  structuralKey(candidate.sequence, candidate.games),
);
const declaredStructuralReviews = policy.structuralReviews.map((review) => {
  if (!review.decision || review.decision.trim().length < 80)
    throw new Error('A structural generalization decision is too vague');
  return structuralKey(review.operations, review.profiles);
});
if (
  JSON.stringify(detectedStructuralReviews.sort()) !==
  JSON.stringify(declaredStructuralReviews.sort())
)
  throw new Error(
    'Structural similarities changed: extract them or record a precise reviewed decision',
  );

if (programFiles.length > policy.maximumProgramFiles)
  throw new Error(
    `Program profile count grew: ${programFiles.length} > ${policy.maximumProgramFiles}`,
  );
if (lines > policy.maximumProgramLines)
  throw new Error(
    `Program profile lines grew: ${lines} > ${policy.maximumProgramLines}`,
  );
if (productionLines > policy.maximumProductionLines)
  throw new Error(
    `Effect-pack production LOC grew: ${productionLines} > ${policy.maximumProductionLines}`,
  );
if (behaviorLines > policy.maximumBehaviorLines)
  throw new Error(
    `Effect-pack behavior LOC grew: ${behaviorLines} > ${policy.maximumBehaviorLines}`,
  );

const registryFile = path.join(EFFECT_PACKS, 'json-effect-pack-registry.ts');
const registry = fs.readFileSync(registryFile, 'utf8');
const registered = [...registry.matchAll(/^  \w+EffectPack,?$/gm)].length;
if (
  !registry.includes('Object.freeze([') ||
  !registry.includes('No filesystem discovery')
)
  throw new Error(
    'The effect-pack registry must be static, frozen and deterministic',
  );
if (registered > policy.maximumRegisteredEffectPacks)
  throw new Error(
    `Registered effect-pack count grew: ${registered} > ${policy.maximumRegisteredEffectPacks}`,
  );

const centralFiles = [
  'json-effect-pack-document-fields.ts',
  'json-effect-pack-schemas.ts',
  'json-effect-pack-compilers.ts',
  '../definitions/json-game-program-handlers.ts',
  '../definitions/json-game-action-compiler.ts',
  '../definitions/json-program-reference-validation.ts',
  '../definitions/json-program-initialization.ts',
];
const effectPackProperties = Object.values(policy.profiles)
  .filter(({ property }) => property)
  .map(({ property }) => property);
for (const relative of centralFiles) {
  const source = fs.readFileSync(path.resolve(EFFECT_PACKS, relative), 'utf8');
  for (const property of effectPackProperties)
    if (new RegExp(`\\b${property}\\b`).test(source))
      throw new Error(
        `${relative} knows the profile-specific property ${property}`,
      );
}

const gameplayFiles = files(GAMEPLAY)
  .map((file) => path.basename(file))
  .sort();
const allowedGameplayFiles = [...policy.genericGameplayFiles].sort();
if (JSON.stringify(gameplayFiles) !== JSON.stringify(allowedGameplayFiles))
  throw new Error(
    'runtime/recipes/gameplay must contain only reviewed generic primitives',
  );

const document = fs.readFileSync(
  path.join(ROOT, 'src/game/engine/runtime/definitions/json-game-document.ts'),
  'utf8',
);
if ((document.match(/effect-packs\/.*\/program/g) ?? []).length !== 0)
  throw new Error(
    'The generic JSON document must depend only on the effect-pack contract catalog',
  );

const audit = {
  summary: {
    programFiles: programFiles.length,
    registeredEffectPacks: registered,
    genericGameplayFiles: gameplayFiles.length,
    programLines: lines,
    productionLines,
    behaviorLines,
    genericScopeEffectPacks: report.filter(
      (item) => item.scope === 'generic' && item.property,
    ).length,
    singleConsumerProfiles: report.filter((item) => item.consumers.length === 1)
      .length,
    largeSingleConsumerReviews: requiredLargeReviews.length,
    structuralCandidates: structuralReport.candidates.length,
    exactGameCodeMatches: 0,
    forbiddenVocabularyMatches: 0,
    crossPackImplementationImports: 0,
  },
  effectPacks: report,
  domains: Object.fromEntries(
    Object.keys(policy.effectDomains).map((domain) => {
      const packs = report.filter((item) => item.domain === domain);
      return [
        domain,
        {
          packs: packs.length,
          productionLines: packs.reduce(
            (total, item) => total + item.productionLines,
            0,
          ),
          singleConsumerPacks: packs.filter((item) => item.consumerCount === 1)
            .length,
          reviewedPatterns: packs.map((item) => item.mechanic),
        },
      ];
    }),
  ),
  structuralCandidates: structuralReport.candidates.map((candidate) => ({
    operations: candidate.sequence,
    profiles: candidate.games,
    occurrences: candidate.occurrences,
    decision: policy.structuralReviews.find(
      (review) =>
        structuralKey(review.operations, review.profiles) ===
        structuralKey(candidate.sequence, candidate.games),
    ).decision,
  })),
};

console.log(JSON.stringify(audit, null, 2));
