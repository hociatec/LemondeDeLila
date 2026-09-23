import * as fs from 'node:fs';
import * as path from 'node:path';
import { jsonGameSchema } from './json-game-schema';

const backend = path.resolve(__dirname, '../../../../..');
const reference: { coreRootFields: string[] } = JSON.parse(
  fs.readFileSync(
    path.join(backend, 'tools/engine-language-reference.json'),
    'utf8',
  ),
);
const policy: {
  coreRootFieldReviews?: Record<string, { adr: string; insufficiency: string }>;
} = JSON.parse(
  fs.readFileSync(
    path.join(backend, 'tools/engine-effect-pack-governance.json'),
    'utf8',
  ),
);

export function assertRootFieldBudget(
  fields: readonly string[],
  previous: readonly string[],
  reviews: NonNullable<typeof policy.coreRootFieldReviews>,
  readAdr: (file: string) => boolean,
): void {
  for (const field of fields) {
    if (previous.includes(field)) continue;
    const review = reviews[field];
    if (
      !review ||
      typeof review.insufficiency !== 'string' ||
      review.insufficiency.trim().length < 120 ||
      typeof review.adr !== 'string' ||
      !/^docs\/architecture\/adr-.+\.md$/.test(review.adr) ||
      !readAdr(review.adr)
    )
      throw new Error(
        `New root field ${field} needs an ADR and proof that existing composition is insufficient`,
      );
  }
}

it('requires an architecture decision for every new core DSL root field', () => {
  assertRootFieldBudget(
    Object.keys(jsonGameSchema.properties ?? {}),
    reference.coreRootFields,
    policy.coreRootFieldReviews ?? {},
    (file) =>
      fs.existsSync(path.join(backend, file)) &&
      fs.readFileSync(path.join(backend, file), 'utf8').trim().length >= 120,
  );
});

it('rejects unreviewed and empty root-field exceptions', () => {
  expect(() =>
    assertRootFieldBudget(['newMechanic'], [], {}, () => true),
  ).toThrow('newMechanic');
  expect(() =>
    assertRootFieldBudget(
      ['newMechanic'],
      [],
      {
        newMechanic: {
          adr: 'docs/architecture/adr-example.md',
          insufficiency: 'Needed',
        },
      },
      () => true,
    ),
  ).toThrow('composition');
});

it('accepts a reviewed addition without enlarging the historical baseline', () => {
  expect(() =>
    assertRootFieldBudget(
      ['newMechanic'],
      [],
      {
        newMechanic: {
          adr: 'docs/architecture/adr-example.md',
          insufficiency:
            'Existing components, actions, effects, conditions and phases were attempted. The architecture decision identifies the exact missing invariant and explains why a root contract is necessary.',
        },
      },
      () => true,
    ),
  ).not.toThrow();
});
