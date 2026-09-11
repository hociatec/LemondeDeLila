import manifest from './manifest.json';
import {
  defineGameContent,
  gameInput,
  cardContent,
} from '../../../engine/sdk/public-api';

import type { CerclesSacresTheme } from './types';
export type { CerclesSacresTheme } from './types';

export interface CerclesSacresCardDefinition {
  id: string;
  name: string;
  theme: CerclesSacresTheme;
}

const TOTEM_NAMES = [
  'L’Aigle visionnaire',
  'Le Loup protecteur',
  'L’Ours guérisseur',
  'Le Bison sacré',
  'Le Colibri messager',
  'Le Renard rusé',
  'Le Cerf élégant',
  'Le Castor bâtisseur',
  'Le Puma silencieux',
  'Le Serpent de transformation',
  'La Tortue éternelle',
  'La Grenouille chanteuse',
  'Le Corbeau du mystère',
  'Le Coyote farceur',
  'La Libellule de l’illusion',
];

const NATURE_NAMES = [
  'Le Feu du renouveau',
  'L’Eau des profondeurs',
  'Le Vent des montagnes',
  'La Terre-mère',
  'La Forêt vivante',
  'La Rivière sacrée',
  'Le Soleil guérisseur',
  'La Lune des cycles',
  'L’Orage purificateur',
  'La Neige silencieuse',
  'Le Désert des visions',
  'La Pluie nourricière',
  'L’Arbre aux ancêtres',
  'La Caverne des esprits',
  'Le Rocher du souvenir',
];

const PLANTE_NAMES = [
  'La Sauge blanche',
  'Le Cèdre purifiant',
  'Le Tabac sacré',
  'Le Maïs doré',
  'La Citrouille nourricière',
  'Le Haricot de sagesse',
  'L’Aloe médicinale',
  'L’Amarante rouge',
  'La Mandragore',
  'Le Peyotl',
  'Le Copal fumigène',
  'L’Achillée guérisseuse',
  'Le Foin d’odeur',
  'Le Nénuphar lunaire',
  'Le Thé du Labrador',
];

const ESPRIT_NAMES = [
  'Le Grand Esprit',
  'La Femme Bison Blanc',
  'L’Esprit du Tambour',
  'L’Ancêtre silencieux',
  'L’Enfant de lumière',
  'L’Ombre intérieure',
  'Le Rêveur du ciel',
  'L’Observateur invisible',
  'L’Esprit du Feu',
  'L’Être-Aigle',
  'Le Cheval sans bride',
  'L’Esprit des quatre vents',
  'Le Porteur de Plume',
  'Le Veilleur du crépuscule',
  'La Danse de l’âme',
];

const PAROLE_NAMES = [
  '« Écoute le vent, il te parle »',
  '« Nous sommes les gardiens de la Terre »',
  '« Chaque pas est une prière »',
  '« Ton cœur connaît le chemin »',
  '« Tout est lié »',
  '« Le silence est la voix des Anciens »',
  '« La vérité est dans le cercle »',
  '« Respecte ce que tu ne comprends pas »',
  '« Tu es une étincelle du grand feu »',
  '« Marche en beauté »',
  '« Le tambour bat pour tous »',
  '« Les plumes tombent, mais l’esprit s’élève »',
  '« Le rêve enseigne mieux que la parole »',
  '« N’oublie jamais d’où tu viens »',
  '« Le monde est un miroir sacré »',
];

const NATION_NAMES = [
  'Hopi — Les gardiens du temps',
  'Navajo — Les tisseurs de lumière',
  'Lakota — Le peuple du bison',
  'Cherokee — Ceux qui marchent avec sagesse',
  'Inuit — Les enfants de la glace',
  'Haïda — Les sculpteurs de totems',
  'Mapuche — Les enfants de la Terre du Sud',
  'Tupi — Les esprits des forêts tropicales',
  'Quechua — Les bâtisseurs des Andes',
  'Arawak — Les rêveurs des îles',
  'Apache — Les guerriers du désert',
  'Algonquin — Les voix de la rivière',
  'Zuni — Les protecteurs des anciens savoirs',
  'Guarani — Les porteurs de chants',
  'Ojibwé — Ceux qui dessinent les rêves',
];

const createThemeCards = (
  theme: CerclesSacresTheme,
  names: string[],
): CerclesSacresCardDefinition[] =>
  names.map((name, index) => ({
    id: `${theme}-${index + 1}`,
    name,
    theme,
  }));

const deck: CerclesSacresCardDefinition[] = [
  ...createThemeCards('totem', TOTEM_NAMES),
  ...createThemeCards('nature', NATURE_NAMES),
  ...createThemeCards('plante', PLANTE_NAMES),
  ...createThemeCards('esprit', ESPRIT_NAMES),
  ...createThemeCards('parole', PAROLE_NAMES),
  ...createThemeCards('nation', NATION_NAMES),
];

const deckSchema = gameInput.object({
  cards: gameInput.array(
    gameInput.object({
      id: gameInput.string({ min: 1, max: 128 }),
      name: gameInput.string({ min: 1, max: 200 }),
      theme: gameInput.enum([
        'totem',
        'nature',
        'plante',
        'esprit',
        'parole',
        'nation',
      ]),
    }),
    { min: 1, max: 10000 },
  ),
});
export const CERCLES_SACRES_GAME_CONTENT = defineGameContent(
  manifest.code,
  { cards: deck },
  {
    schema: {
      parse(value: unknown) {
        const parsed = deckSchema.parse(value);

        return { cards: cardContent(parsed.cards) };
      },
    },
  },
);
export const CERCLES_SACRES_DECK = CERCLES_SACRES_GAME_CONTENT.data.cards;
export const CERCLES_SACRES_CARD_BY_ID: Readonly<
  Record<string, CerclesSacresCardDefinition>
> = Object.freeze(
  Object.fromEntries(CERCLES_SACRES_DECK.map((card) => [card.id, card])),
);
