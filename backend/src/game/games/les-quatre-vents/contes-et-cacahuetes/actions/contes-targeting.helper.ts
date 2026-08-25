import { resolvePlayerNameFromState } from '../../../../core/application/helpers/player-name.helper';
import type { GameStateEntity } from '../../../../core/application/models/game-state.model';
import type {
  ContesCard,
  ContesCardType,
  ContesCacahuetesMetadata,
  ContesPending,
} from '../model/contes-et-cacahuetes-state.model';

export function startContesChooseTarget(input: {
  state: GameStateEntity;
  playerId: number;
  context: string;
  label: string;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  listBonusTokens: (
    meta: ContesCacahuetesMetadata,
    playerId: number,
  ) => Array<{ cardId: number; title: string }>;
  listSurpriseTokens: (
    meta: ContesCacahuetesMetadata,
    playerId: number,
  ) => Array<{ cardId: number; title: string }>;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  setPending: (state: GameStateEntity, pending: Exclude<ContesPending, null>) => GameStateEntity;
}): GameStateEntity {
  const meta = input.getMeta(input.state);
  const players = Array.isArray(input.state.players) ? input.state.players : [];
  const targets = players
    .filter((player) => {
      const targetId = player?.id;
      if (targetId === input.playerId) return false;

      if (input.context === 'song_take_bonus' || input.context === 'steal_bonus') {
        return input.listBonusTokens(meta, targetId).length > 0;
      }

      if (input.context === 'steal_bonus_or_surprise') {
        return (
          input.listBonusTokens(meta, targetId).length > 0 ||
          input.listSurpriseTokens(meta, targetId).length > 0
        );
      }

      return true;
    })
    .map((player) => ({
      targetPlayerId: player.id,
      targetUsername: player.username ?? `Joueur ${player.id}`,
    }));

  if (input.context === 'swap_positions') {
    targets.push({
      targetPlayerId: -1,
      targetUsername: 'Refuser l’échange',
    });
  }

  if (!targets.length) {
    if (
      input.context === 'song_take_bonus' ||
      input.context === 'steal_bonus' ||
      input.context === 'steal_bonus_or_surprise'
    ) {
      return input.appendLog(
        input.state,
        'Aucune carte à voler chez les autres joueurs.',
      );
    }
    return input.appendLog(input.state, 'Aucun autre joueur disponible.');
  }

  return input.setPending(input.state, {
    type: 'choose_target',
    label: input.label,
    playerId: input.playerId,
    blocking: true,
    choices: targets.map((target) => target.targetUsername),
    data: { context: input.context, targets },
  });
}

export function drawContesBonusToGive(input: {
  state: GameStateEntity;
  playerId: number;
  drawCard: (
    state: GameStateEntity,
    type: 'bonus',
  ) => { state: GameStateEntity; card: ContesCard | null };
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  announceDrawnCard: (
    state: GameStateEntity,
    playerId: number,
    card: ContesCard,
  ) => GameStateEntity;
  startChooseTarget: (
    state: GameStateEntity,
    playerId: number,
    context: string,
    label: string,
  ) => GameStateEntity;
}): GameStateEntity {
  const draw = input.drawCard(input.state, 'bonus');
  let next = draw.state;
  const card = draw.card;
  if (!card) {
    return input.appendLog(next, 'Aucune carte Bonus disponible.');
  }
  next = input.announceDrawnCard(next, input.playerId, card);
  return input.startChooseTarget(
    next,
    input.playerId,
    `give_drawn_bonus:${card.id}`,
    `Maladresse de sorcier : choisissez un joueur qui recevra "${card.title}".`,
  );
}

export function findContesCardTitle(input: {
  state: GameStateEntity;
  type: ContesCardType;
  cardId: number;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  toContesCardArray: (value: unknown) => ContesCard[];
}): string | null {
  const decks = input.getMeta(input.state).decks;
  const keys: Array<keyof ContesCacahuetesMetadata['decks']> =
    input.type === 'bonus'
      ? ['bonus', 'discardBonus']
      : input.type === 'malus'
        ? ['malus', 'discardMalus']
        : input.type === 'surprise'
          ? ['surprise', 'discardSurprise']
          : ['contes', 'discardContes'];
  for (const key of keys) {
    const cards = input.toContesCardArray(decks[key]);
    const found = cards.find((card) => Number(card.id) === input.cardId);
    if (found?.title) return found.title;
  }
  return null;
}




