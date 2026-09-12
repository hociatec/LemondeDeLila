import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { GerardProgram } from '../extensions/gerard/program';
import { effectJsonSchema } from '../contracts/effect-json-schema';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

const text: AuthorSchema = { type: 'string', minLength: 1, maxLength: 10000 };
const effects = [
  'sabotage',
  'double-prenom',
  'double-theme',
  'interdiction',
  'main-fantome',
  'defense-totale',
  'echange-force',
  'panique-generale',
  'retour-envoyeur',
  'theme-secret',
  'chuchotement-confus',
  'mega-combo',
  'inversion',
  'jury-mystere',
  'effet-domino',
  'prenom-fantome',
  'inversion-role',
  'chaos-temporel',
  'ultra-sabotage',
  'prenom-volant',
] as const;

export const jsonGerardSchema: AuthorSchema = object({
  targetScore: { type: 'integer', minimum: 1, maximum: 1000 },
  names: array(object({ id, name: text }), 1),
  themes: array(object({ id, text }), 1),
  specialCards: array(
    object({
      id,
      name: text,
      description: text,
      effect: { enum: effects },
      effects: effectJsonSchema,
    }),
    1,
  ),
});

export function assertGerardReferences(program: GerardProgram): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError('Gerard: ' + reason);
  };
  for (const cards of [program.names, program.themes, program.specialCards])
    if (new Set(cards.map((card) => card.id)).size !== cards.length)
      fail('identifiers must be unique within each catalogue');
  if (program.specialCards.some((card) => card.effects.length === 0))
    fail('special cards require effects');
}
