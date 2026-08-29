import {
  freezeGameContent,
  gameEffects,
  rejectContent,
} from '../../../engine/sdk/public-api';
import type { GameEffectInstruction } from '../../../engine/sdk/public-api';
import { CONTES_RESOURCES, CONTES_STATUSES } from './constants';
import rawContent from './content-data.json';

export type ContesTileType =
  'start' | 'conte' | 'bonus' | 'malus' | 'surprise' | 'finish';

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
  effects: readonly GameEffectInstruction[];
};

type RawContesCard = Omit<ContesCard, 'effects'>;

const self = gameEffects.target.self();
const custom = (
  effectId: string,
  data: Record<string, unknown> = {},
): GameEffectInstruction => gameEffects.custom(effectId, data, self);
const move = (delta: number): GameEffectInstruction =>
  custom('contes.move', { delta });
const draw = (type: ContesCardType): GameEffectInstruction =>
  custom('contes.draw', { type });
const target = (effect: string): GameEffectInstruction =>
  custom('contes.schedule-target', { effect });
const status = (statusId: string): GameEffectInstruction =>
  gameEffects.addStatus({
    status: statusId,
    scope: 'until-used',
    target: self,
  });

const BONUS_EFFECTS: Readonly<
  Record<number, readonly GameEffectInstruction[]>
> = {
  1: [move(2)],
  2: [gameEffects.gainResource(CONTES_RESOURCES.reroll, 1, self)],
  3: [gameEffects.gainResource(CONTES_RESOURCES.shield, 1, self)],
  4: [status(CONTES_STATUSES.cape)],
  5: [target('move-other-two')],
  6: [custom('contes.roll-move', { mode: 'double' })],
  7: [status(CONTES_STATUSES.keyOfGold)],
  8: [move(3)],
  9: [custom('contes.queue-draws', { types: ['bonus', 'surprise'] })],
  10: [target('swap-next-turns')],
  11: [custom('contes.force-one-others')],
  12: [custom('contes.abundance')],
  13: [move(5), gameEffects.skipTurn(1, self)],
  14: [status(CONTES_STATUSES.replaceOne)],
  15: [move(-2), move(3)],
};

const MALUS_EFFECTS: Readonly<
  Record<number, readonly GameEffectInstruction[]>
> = {
  1: [gameEffects.skipTurn(1, self)],
  2: [move(-2)],
  3: [custom('contes.swap-closest')],
  4: [custom('contes.roll-move', { mode: 'half' })],
  5: [custom('contes.block')],
  6: [gameEffects.skipTurn(2, self)],
  7: [draw('malus')],
  8: [move(3), move(-4)],
  9: [custom('contes.bonus-gift')],
  10: [custom('contes.roll-move', { mode: 'backward' })],
  11: [custom('contes.skip-if-low-roll')],
  12: [custom('contes.previous-malus')],
  13: [move(-2)],
  14: [gameEffects.moveTo('story-road', 0, self)],
  15: [
    custom('contes.extend-status', {
      status: CONTES_STATUSES.noBonus,
      turns: 2,
    }),
  ],
};

const SURPRISE_EFFECTS: Readonly<
  Record<number, readonly GameEffectInstruction[]>
> = {
  1: [move(-1)],
  2: [move(4)],
  3: [draw('bonus')],
  4: [custom('contes.queue-random-draws')],
  5: [custom('contes.laughter')],
  6: [target('swap-positions')],
  7: [gameEffects.skipTurn(1, self)],
  8: [status(CONTES_STATUSES.reverseNextTurn)],
  9: [custom('contes.option', { effect: 'song' })],
  10: [status(CONTES_STATUSES.protectNextMalus)],
  11: [draw('conte')],
  12: [custom('contes.roll-move', { mode: 'backward' })],
  13: [custom('contes.option', { effect: 'wish' })],
  14: [target('steal-token')],
  15: [target('travelling-book')],
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
  return cards.map((card) => {
    const normalized: RawContesCard = {
      ...card,
      type: cardType(card.type),
    };
    return { ...normalized, effects: cardEffects(normalized) };
  });
}

function cardEffects(card: RawContesCard): readonly GameEffectInstruction[] {
  if (card.type === 'bonus') return BONUS_EFFECTS[card.id] ?? [];
  if (card.type === 'malus') return MALUS_EFFECTS[card.id] ?? [];
  if (card.type === 'surprise') return SURPRISE_EFFECTS[card.id] ?? [];
  return [custom('contes.conte')];
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
  rejectContent(`Type de case Contes inconnu: ${value}`);
}

function cardType(value: string): ContesCardType {
  if (
    value === 'bonus' ||
    value === 'malus' ||
    value === 'surprise' ||
    value === 'conte'
  )
    return value;
  rejectContent(`Type de carte Contes inconnu: ${value}`);
}

freezeGameContent(CONTES_PAWNS);
freezeGameContent(CONTES_TILES);
freezeGameContent(CONTES_DECKS);
