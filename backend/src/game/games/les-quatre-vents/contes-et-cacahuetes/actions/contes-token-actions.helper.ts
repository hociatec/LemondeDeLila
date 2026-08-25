import type { GameStateEntity } from '../../../../core/application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../core/application/helpers/player-name.helper';
import type {
  ContesCardType,
  ContesCacahuetesMetadata,
  ContesPending,
} from '../model/contes-et-cacahuetes-state.model';

type TokenDescriptor = { cardId: number; title: string };
type ChoiceCard = {
  cardType: 'bonus' | 'surprise';
  cardId: number;
  title: string;
};

export function listContesBonusTokens(
  meta: ContesCacahuetesMetadata,
  playerId: number,
): TokenDescriptor[] {
  const out: TokenDescriptor[] = [];
  const shield = Number(meta.statuses.shieldMalus?.[playerId] ?? 0);
  if (shield > 0) {
    out.push({ cardId: 3, title: `Amulette protectrice (${shield})` });
  }
  if (meta.statuses.ignoreNextConteAndAdvance?.[playerId]) {
    out.push({ cardId: 4, title: 'Cape d’invisibilité' });
  }
  if (meta.statuses.keyOfGold?.[playerId]) {
    out.push({ cardId: 7, title: 'Clé d’or universelle' });
  }
  if (meta.statuses.replaceOneOn1By4?.[playerId]) {
    out.push({ cardId: 14, title: 'Feuille magique' });
  }
  const reroll = Number(meta.statuses.rerollToken?.[playerId] ?? 0);
  if (reroll > 0) {
    out.push({ cardId: 2, title: `Parchemin enchanté (${reroll})` });
  }
  return out;
}

export function listContesSurpriseTokens(
  meta: ContesCacahuetesMetadata,
  playerId: number,
): TokenDescriptor[] {
  const out: TokenDescriptor[] = [];
  if (meta.statuses.reverseNextTurn?.[playerId]) {
    out.push({ cardId: 8, title: 'Livre à l’envers' });
  }
  if (meta.statuses.protectNextMalus?.[playerId]) {
    out.push({ cardId: 10, title: 'Dragon de papier' });
  }
  return out;
}

export function startContesGiveBonusChoice(input: {
  state: GameStateEntity;
  giverId: number;
  targetId: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  listBonusTokens: (
    meta: ContesCacahuetesMetadata,
    playerId: number,
  ) => TokenDescriptor[];
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  setPending: (
    state: GameStateEntity,
    pending: Exclude<ContesPending, null>,
  ) => GameStateEntity;
}): GameStateEntity {
  const tokens = input.listBonusTokens(
    input.getMeta(input.state),
    input.giverId,
  );
  if (!tokens.length) {
    return input.appendLog(
      input.state,
      `${resolvePlayerNameFromState(input.state, input.giverId)} n'a aucune carte Bonus à donner.`,
    );
  }
  return input.setPending(input.state, {
    type: 'choose_card',
    label: `Choisissez la carte Bonus à donner à ${resolvePlayerNameFromState(input.state, input.targetId)}, puis Entrée.`,
    playerId: input.giverId,
    blocking: true,
    choices: tokens.map((token) => token.title),
    data: {
      context: `give_bonus_to:${input.targetId}`,
      cards: tokens.map((token) => ({
        cardType: 'bonus' as const,
        cardId: token.cardId,
        title: token.title,
      })),
    },
  });
}

export function startContesStealTokenChoice(input: {
  state: GameStateEntity;
  thiefId: number;
  fromId: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  listBonusTokens: (
    meta: ContesCacahuetesMetadata,
    playerId: number,
  ) => TokenDescriptor[];
  listSurpriseTokens: (
    meta: ContesCacahuetesMetadata,
    playerId: number,
  ) => TokenDescriptor[];
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  setPending: (
    state: GameStateEntity,
    pending: Exclude<ContesPending, null>,
  ) => GameStateEntity;
  transferBonusToken: (
    state: GameStateEntity,
    fromId: number,
    toId: number,
    bonusId: number,
  ) => GameStateEntity;
  transferSurpriseToken: (
    state: GameStateEntity,
    fromId: number,
    toId: number,
    surpriseId: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const bonus: ChoiceCard[] = input
    .listBonusTokens(meta, input.fromId)
    .map((token) => ({
      cardType: 'bonus',
      cardId: token.cardId,
      title: token.title,
    }));
  const surprise: ChoiceCard[] = input
    .listSurpriseTokens(meta, input.fromId)
    .map((token) => ({
      cardType: 'surprise',
      cardId: token.cardId,
      title: token.title,
    }));
  const cards = [...bonus, ...surprise];

  if (!cards.length) {
    return input.appendLog(
      input.state,
      `${resolvePlayerNameFromState(input.state, input.fromId)} n’a aucune carte Bonus ou Surprise à voler.`,
    );
  }

  if (cards.length === 1) {
    const only = cards[0];
    const next = input.appendLog(
      input.state,
      `Vol : ${resolvePlayerNameFromState(input.state, input.thiefId)} prend "${only.title}" à ${resolvePlayerNameFromState(input.state, input.fromId)}.`,
    );
    return only.cardType === 'bonus'
      ? input.transferBonusToken(next, input.fromId, input.thiefId, only.cardId)
      : input.transferSurpriseToken(
          next,
          input.fromId,
          input.thiefId,
          only.cardId,
        );
  }

  return input.setPending(input.state, {
    type: 'choose_card',
    label: `Filet magique : choisissez la carte à voler à ${resolvePlayerNameFromState(input.state, input.fromId)}, puis Entrée.`,
    playerId: input.thiefId,
    blocking: true,
    choices: cards.map((card) => card.title),
    data: {
      context: `steal_token_from:${input.fromId}:${input.thiefId}`,
      cards: cards.map((card) => ({
        cardType: card.cardType,
        cardId: card.cardId,
        title: card.title,
      })),
    },
  });
}

export function transferContesBonusToken(input: {
  state: GameStateEntity;
  fromId: number;
  toId: number;
  bonusId: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  setStatusCount: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: number,
  ) => GameStateEntity;
  addStatusCount: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  setStatusBool: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: boolean,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  let next = input.state;
  const meta = input.getMeta(next);
  if (input.bonusId === 3) {
    const shield = Number(meta.statuses.shieldMalus?.[input.fromId] ?? 0);
    if (shield <= 0) return next;
    next = input.setStatusCount(next, 'shieldMalus', input.fromId, shield - 1);
    next = input.addStatusCount(next, 'shieldMalus', input.toId, 1);
    return input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, input.fromId)} donne une Amulette protectrice à ${resolvePlayerNameFromState(next, input.toId)}.`,
    );
  }
  if (input.bonusId === 4) {
    if (!meta.statuses.ignoreNextConteAndAdvance?.[input.fromId]) return next;
    next = input.setStatusBool(
      next,
      'ignoreNextConteAndAdvance',
      input.fromId,
      false,
    );
    next = input.setStatusBool(
      next,
      'ignoreNextConteAndAdvance',
      input.toId,
      true,
    );
    return input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, input.fromId)} donne une Cape d’invisibilité à ${resolvePlayerNameFromState(next, input.toId)}.`,
    );
  }
  if (input.bonusId === 7) {
    if (!meta.statuses.keyOfGold?.[input.fromId]) return next;
    next = input.setStatusBool(next, 'keyOfGold', input.fromId, false);
    next = input.setStatusBool(next, 'keyOfGold', input.toId, true);
    return input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, input.fromId)} donne la Clé d’or à ${resolvePlayerNameFromState(next, input.toId)}.`,
    );
  }
  if (input.bonusId === 14) {
    if (!meta.statuses.replaceOneOn1By4?.[input.fromId]) return next;
    next = input.setStatusBool(next, 'replaceOneOn1By4', input.fromId, false);
    next = input.setStatusBool(next, 'replaceOneOn1By4', input.toId, true);
    return input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, input.fromId)} donne Feuille magique à ${resolvePlayerNameFromState(next, input.toId)}.`,
    );
  }
  if (input.bonusId === 2) {
    const reroll = Number(meta.statuses.rerollToken?.[input.fromId] ?? 0);
    if (reroll <= 0) return next;
    next = input.setStatusCount(next, 'rerollToken', input.fromId, reroll - 1);
    next = input.addStatusCount(next, 'rerollToken', input.toId, 1);
    return input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, input.fromId)} donne un Parchemin enchanté à ${resolvePlayerNameFromState(next, input.toId)}.`,
    );
  }
  return next;
}

export function transferContesSurpriseToken(input: {
  state: GameStateEntity;
  fromId: number;
  toId: number;
  surpriseId: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  setStatusBool: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: boolean,
  ) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
}): GameStateEntity {
  let next = input.state;
  const meta = input.getMeta(next);
  if (input.surpriseId === 8) {
    if (!meta.statuses.reverseNextTurn?.[input.fromId]) return next;
    next = input.setStatusBool(next, 'reverseNextTurn', input.fromId, false);
    next = input.setStatusBool(next, 'reverseNextTurn', input.toId, true);
    return input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, input.fromId)} donne Livre à l’envers à ${resolvePlayerNameFromState(next, input.toId)}.`,
    );
  }
  if (input.surpriseId === 10) {
    if (!meta.statuses.protectNextMalus?.[input.fromId]) return next;
    next = input.setStatusBool(next, 'protectNextMalus', input.fromId, false);
    next = input.setStatusBool(next, 'protectNextMalus', input.toId, true);
    return input.appendLog(
      next,
      `${resolvePlayerNameFromState(next, input.fromId)} donne Dragon de papier à ${resolvePlayerNameFromState(next, input.toId)}.`,
    );
  }
  return next;
}

export function takeOneContesBonusToken(input: {
  state: GameStateEntity;
  fromId: number;
  toId: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  listBonusTokens: (
    meta: ContesCacahuetesMetadata,
    playerId: number,
  ) => TokenDescriptor[];
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  transferBonusToken: (
    state: GameStateEntity,
    fromId: number,
    toId: number,
    bonusId: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const tokens = input.listBonusTokens(
    input.getMeta(input.state),
    input.fromId,
  );
  if (!tokens.length) {
    return input.appendLog(
      input.state,
      `${resolvePlayerNameFromState(input.state, input.fromId)} n'a aucune carte Bonus à donner.`,
    );
  }
  return input.transferBonusToken(
    input.state,
    input.fromId,
    input.toId,
    tokens[0].cardId,
  );
}
