export type BandeABananeCardType = 'monkey' | 'action' | 'trap' | 'joker';

export type BandeABananeMonkeySpecies =
  | 'capucin'
  | 'mandrill'
  | 'gibbon'
  | 'babouin'
  | 'macaque';

export type BandeABananeActionType =
  | 'vol-de-banane'
  | 'cris-de-la-jungle'
  | 'grimpeur-fou';

export type BandeABananeTrapType = 'piege-a-noix-de-coco' | 'tigre-rodeur';

export interface BandeABananeCardDefinition {
  id: string;
  name: string;
  type: BandeABananeCardType;
  species?: BandeABananeMonkeySpecies;
  action?: BandeABananeActionType;
  trap?: BandeABananeTrapType;
}

const createCopies = (
  prefix: string,
  count: number,
  details: Partial<BandeABananeCardDefinition>,
): BandeABananeCardDefinition[] =>
  Array.from(
    { length: count },
    (_, index) =>
      ({
        id: `${prefix}-${index + 1}`,
        ...details,
      }) as BandeABananeCardDefinition,
  );

const deck: BandeABananeCardDefinition[] = [
  ...createCopies('monkey-capucin', 6, {
    type: 'monkey',
    name: 'Capucin malicieux',
    species: 'capucin',
  }),
  ...createCopies('monkey-mandrill', 6, {
    type: 'monkey',
    name: 'Mandrill paradeur',
    species: 'mandrill',
  }),
  ...createCopies('monkey-gibbon', 6, {
    type: 'monkey',
    name: 'Gibbon bondissant',
    species: 'gibbon',
  }),
  ...createCopies('monkey-babouin', 6, {
    type: 'monkey',
    name: 'Babouin observateur',
    species: 'babouin',
  }),
  ...createCopies('monkey-macaque', 6, {
    type: 'monkey',
    name: 'Macaque zen',
    species: 'macaque',
  }),
  ...createCopies('action-vol-de-banane', 5, {
    type: 'action',
    name: 'Vol de banane',
    action: 'vol-de-banane',
  }),
  ...createCopies('action-cris-de-la-jungle', 5, {
    type: 'action',
    name: 'Cris de la jungle',
    action: 'cris-de-la-jungle',
  }),
  ...createCopies('action-grimpeur-fou', 5, {
    type: 'action',
    name: 'Grimpeur fou',
    action: 'grimpeur-fou',
  }),
  ...createCopies('trap-piege-a-noix-de-coco', 5, {
    type: 'trap',
    name: 'Piège à noix de coco',
    trap: 'piege-a-noix-de-coco',
  }),
  ...createCopies('trap-tigre-rodeur', 5, {
    type: 'trap',
    name: 'Tigre rôdeur',
    trap: 'tigre-rodeur',
  }),
  ...createCopies('joker-singe-deguise', 5, {
    type: 'joker',
    name: 'Singe déguisé',
  }),
];

export const BANDE_A_BANANE_DECK = deck;
export const BANDE_A_BANANE_CARD_BY_ID: Record<
  string,
  BandeABananeCardDefinition
> = Object.fromEntries(deck.map((card) => [card.id, card]));
