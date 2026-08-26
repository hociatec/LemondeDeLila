import rawContent from './content-data.json';

export type ContesTileType =
  | 'start'
  | 'conte'
  | 'bonus'
  | 'malus'
  | 'surprise'
  | 'finish';

export type ContesCardType = 'bonus' | 'malus' | 'surprise' | 'conte';

export type ContesPawn = {
  id: string;
  label: string;
  description: string;
};

export type ContesTile = {
  id: string;
  type: ContesTileType;
  label: string;
  description: string;
};

export type ContesCard = {
  id: number;
  type: ContesCardType;
  title: string;
  text: string;
};

export const CONTES_PAWNS: ContesPawn[] = rawContent.pawns.map((pawn) => ({
  ...pawn,
}));

export const CONTES_TILES: ContesTile[] = rawContent.tiles.map((tile) => ({
  ...tile,
  type: tileType(tile.type),
}));

export const CONTES_DECKS = {
  bonus: normalizeCards(rawContent.decks.bonus),
  malus: normalizeCards(rawContent.decks.malus),
  surprise: normalizeCards(rawContent.decks.surprise),
  conte: normalizeCards(rawContent.decks.contes),
};

function normalizeCards(
  cards: ReadonlyArray<{
    id: number;
    type: string;
    title: string;
    text: string;
  }>,
): ContesCard[] {
  return cards.map((card) => ({ ...card, type: cardType(card.type) }));
}

function tileType(value: string): ContesTileType {
  if (
    value === 'start' ||
    value === 'conte' ||
    value === 'bonus' ||
    value === 'malus' ||
    value === 'surprise' ||
    value === 'finish'
  )
    return value;
  throw new Error(`Type de case Contes inconnu: ${value}`);
}

function cardType(value: string): ContesCardType {
  if (
    value === 'bonus' ||
    value === 'malus' ||
    value === 'surprise' ||
    value === 'conte'
  )
    return value;
  throw new Error(`Type de carte Contes inconnu: ${value}`);
}
