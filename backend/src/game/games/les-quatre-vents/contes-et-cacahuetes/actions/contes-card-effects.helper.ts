import type { GameStateEntity } from '../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../application/helpers/player-name.helper';
import type {
  ContesCardType,
  ContesCacahuetesMetadata,
} from '../model/contes-et-cacahuetes-state.model';

type StartChooseTargetFn = (
  state: GameStateEntity,
  playerId: number,
  context: string,
  label: string,
) => GameStateEntity;

type MoveByFn = (
  state: GameStateEntity,
  playerId: number,
  delta: number,
  depth: number,
) => GameStateEntity;

type DrawAndApplyFn = (
  state: GameStateEntity,
  playerId: number,
  type: ContesCardType,
  depth: number,
) => GameStateEntity;

export function applyContesBonusEffectById(input: {
  state: GameStateEntity;
  playerId: number;
  id: number;
  depth: number;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
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
  canUseBonusCards: (state: GameStateEntity, playerId: number) => boolean;
  startChooseTarget: StartChooseTargetFn;
  moveBy: MoveByFn;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  rollDice: (
    meta: ContesCacahuetesMetadata,
    faces: number,
  ) => { roll: number; meta: Partial<ContesCacahuetesMetadata> };
  applyAbondance: (state: GameStateEntity, playerId: number) => GameStateEntity;
  queueDraws: (
    state: GameStateEntity,
    playerId: number,
    queue: ContesCardType[],
    depth: number,
  ) => GameStateEntity;
}): GameStateEntity {
  let next = input.state;
  switch (input.id) {
    case 1:
      return input.moveBy(next, input.playerId, 2, input.depth);
    case 2:
      next = input.addStatusCount(next, 'rerollToken', input.playerId, 1);
      return input.appendLog(
        next,
        `${resolvePlayerNameFromState(next, input.playerId)} gagne un parchemin enchanté (1 relance).`,
      );
    case 3:
      next = input.addStatusCount(next, 'shieldMalus', input.playerId, 1);
      return input.appendLog(
        next,
        `${resolvePlayerNameFromState(next, input.playerId)} obtient une Amulette protectrice (1 protection).`,
      );
    case 4:
      next = input.setStatusBool(
        next,
        'ignoreNextConteAndAdvance',
        input.playerId,
        true,
      );
      return input.appendLog(
        next,
        `${resolvePlayerNameFromState(next, input.playerId)} obtient une Cape d’invisibilité (prochaine case Malus ignorée).`,
      );
    case 5:
      return input.startChooseTarget(
        next,
        input.playerId,
        'move_other_2',
        'Poussière de fée : choisissez un joueur à faire avancer de 2 cases.',
      );
    case 6: {
      const out = input.rollDice(input.getMeta(next), 6);
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...out.meta } };
      next = input.appendLog(
        next,
        `Haricot magique : dé "${out.roll}" x 2 = ${out.roll * 2}.`,
      );
      return input.moveBy(next, input.playerId, out.roll * 2, input.depth);
    }
    case 7:
      next = input.setStatusBool(next, 'keyOfGold', input.playerId, true);
      return input.appendLog(
        next,
        `${resolvePlayerNameFromState(next, input.playerId)} obtient la Clé d’or (sur Conte : Bonus/Malus pour un autre joueur).`,
      );
    case 8:
      return input.moveBy(next, input.playerId, 3, input.depth);
    case 9:
      return input.queueDraws(
        next,
        input.playerId,
        ['bonus', 'surprise'],
        input.depth,
      );
    case 10:
      return input.startChooseTarget(
        next,
        input.playerId,
        'turn_swap_next',
        'Formule magique : choisissez un joueur pour échanger vos prochains tours.',
      );
    case 11: {
      const players = Array.isArray(next.players) ? next.players : [];
      for (const player of players) {
        if (player.id === input.playerId) continue;
        next = input.addStatusCount(next, 'forcedRollOneTurns', player.id, 1);
      }
      return input.appendLog(
        next,
        'Flûte enchantée : au prochain tour des autres joueurs, ils avancent d’1 case.',
      );
    }
    case 12:
      return input.applyAbondance(next, input.playerId);
    case 13:
      next = input.appendLog(
        next,
        `${resolvePlayerNameFromState(next, input.playerId)} avance de 5 cases mais passera son prochain tour.`,
      );
      next = input.moveBy(next, input.playerId, 5, input.depth);
      return input.addStatusCount(next, 'skipTurn', input.playerId, 1);
    case 14:
      next = input.setStatusBool(next, 'replaceOneOn1By4', input.playerId, true);
      return input.appendLog(
        next,
        `${resolvePlayerNameFromState(next, input.playerId)} pose Feuille magique (1 devient 4 une fois).`,
      );
    case 15:
      next = input.moveBy(next, input.playerId, -2, input.depth);
      return input.moveBy(next, input.playerId, 3, input.depth);
    default:
      return next;
  }
}

export function applyContesMalusEffectById(input: {
  state: GameStateEntity;
  playerId: number;
  id: number;
  depth: number;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  addStatusCount: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    delta: number,
  ) => GameStateEntity;
  moveBy: MoveByFn;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  rollDice: (
    meta: ContesCacahuetesMetadata,
    faces: number,
  ) => { roll: number; meta: Partial<ContesCacahuetesMetadata> };
  swapWithClosestBehind: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  blockUntilPassed: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  drawAndApply: DrawAndApplyFn;
  drawBonusToGive: (
    state: GameStateEntity,
    playerId: number,
  ) => GameStateEntity;
  goToPreviousMalusAndApply: (
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ) => GameStateEntity;
  teleport: (
    state: GameStateEntity,
    playerId: number,
    position: number,
  ) => GameStateEntity;
}): GameStateEntity {
  let next = input.state;
  switch (input.id) {
    case 1:
      return input.addStatusCount(next, 'skipTurn', input.playerId, 1);
    case 2:
      return input.moveBy(next, input.playerId, -2, input.depth);
    case 3:
      return input.swapWithClosestBehind(next, input.playerId);
    case 4: {
      const out = input.rollDice(input.getMeta(next), 6);
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...out.meta } };
      const half = Math.floor(out.roll / 2);
      next = input.appendLog(
        next,
        `Pluie de mots oubliés : dé "${out.roll}", moitié = ${half}.`,
      );
      return input.moveBy(next, input.playerId, half, input.depth);
    }
    case 5:
      return input.blockUntilPassed(next, input.playerId);
    case 6:
      return input.addStatusCount(next, 'skipTurn', input.playerId, 2);
    case 7:
      return input.drawAndApply(next, input.playerId, 'malus', input.depth + 1);
    case 8:
      next = input.moveBy(next, input.playerId, 3, input.depth);
      return input.moveBy(next, input.playerId, -4, input.depth);
    case 9:
      return input.drawBonusToGive(next, input.playerId);
    case 10: {
      const out = input.rollDice(input.getMeta(next), 6);
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...out.meta } };
      next = input.appendLog(next, `Ombre farceuse : dé "${out.roll}", recul.`);
      return input.moveBy(next, input.playerId, -out.roll, input.depth);
    }
    case 11: {
      const out = input.rollDice(input.getMeta(next), 6);
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...out.meta } };
      if (out.roll >= 4) {
        return input.appendLog(next, `Énigme infernale : "${out.roll}" (réussi).`);
      }
      next = input.appendLog(
        next,
        `Énigme infernale : "${out.roll}" (raté) : passez votre tour.`,
      );
      return input.addStatusCount(next, 'skipTurn', input.playerId, 1);
    }
    case 12:
      return input.goToPreviousMalusAndApply(next, input.playerId, input.depth);
    case 13:
      return input.moveBy(next, input.playerId, -2, input.depth);
    case 14:
      return input.teleport(next, input.playerId, 0);
    case 15:
      next = input.addStatusCount(next, 'noBonusCardsTurns', input.playerId, 2);
      return input.appendLog(
        next,
        `${resolvePlayerNameFromState(next, input.playerId)} ne peut plus utiliser de cartes Bonus pendant 2 tours.`,
      );
    default:
      return next;
  }
}

export function applyContesSurpriseEffectById(input: {
  state: GameStateEntity;
  playerId: number;
  id: number;
  depth: number;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
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
  moveByToFinalTile: MoveByFn;
  moveBy: MoveByFn;
  drawAndApply: DrawAndApplyFn;
  applyCoffreMerveilles: (
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ) => GameStateEntity;
  setPending: (
    state: GameStateEntity,
    pending: Record<string, unknown>,
  ) => GameStateEntity;
  startChooseTarget: StartChooseTargetFn;
  getMeta: (state: GameStateEntity) => ContesCacahuetesMetadata;
  rollDice: (
    meta: ContesCacahuetesMetadata,
    faces: number,
  ) => { roll: number; meta: Partial<ContesCacahuetesMetadata> };
}): GameStateEntity {
  let next = input.state;
  switch (input.id) {
    case 1:
      return input.moveByToFinalTile(next, input.playerId, -1, input.depth);
    case 2:
      return input.moveBy(next, input.playerId, 4, input.depth);
    case 3:
      return input.drawAndApply(next, input.playerId, 'bonus', input.depth);
    case 4:
      return input.applyCoffreMerveilles(next, input.playerId, input.depth);
    case 5: {
      const order = (Array.isArray(next.players) ? next.players : [])
        .map((player) => Number(player?.id))
        .filter((id) => Number.isFinite(id));
      return input.setPending(next, {
        type: 'choose_number',
        label:
          'Poussière de rire : choisissez un nombre entre 1 et 3, puis Entrée.',
        playerId: input.playerId,
        blocking: true,
        choices: ['1', '2', '3'],
        data: {
          context: 'laughter_dust',
          min: 1,
          max: 3,
          order,
          picks: {},
        },
      });
    }
    case 6:
      return input.startChooseTarget(
        next,
        input.playerId,
        'swap_positions',
        'Tempête de pages : choisissez un joueur pour échanger vos positions.',
      );
    case 7:
      return input.addStatusCount(next, 'skipTurn', input.playerId, 1);
    case 8:
      next = input.setStatusBool(next, 'reverseNextTurn', input.playerId, true);
      return input.appendLog(
        next,
        `${resolvePlayerNameFromState(next, input.playerId)} lira à l’envers : prochain tour en reculant.`,
      );
    case 9:
      return input.setPending(next, {
        type: 'choose_option',
        label: 'Chanson enchantée : choisissez une option.',
        playerId: input.playerId,
        blocking: true,
        choices: ['Avancer de 3', 'Prendre une carte Bonus'],
        data: { context: 'song_choice' },
      });
    case 10:
      next = input.setStatusBool(next, 'protectNextMalus', input.playerId, true);
      return input.appendLog(
        next,
        `${resolvePlayerNameFromState(next, input.playerId)} est protégé(e) de la prochaine carte Malus.`,
      );
    case 11:
      return input.drawAndApply(next, input.playerId, 'conte', input.depth);
    case 12: {
      const out = input.rollDice(input.getMeta(next), 6);
      next = { ...next, metadata: { ...(next.metadata ?? {}), ...out.meta } };
      next = input.appendLog(
        next,
        `Montre enchantée : dé "${out.roll}", recul.`,
      );
      return input.moveBy(next, input.playerId, -out.roll, input.depth);
    }
    case 13:
      return input.setPending(next, {
        type: 'choose_option',
        label: 'Souhait éphémère : choisissez une option.',
        playerId: input.playerId,
        blocking: true,
        choices: ['Avancer de 2', 'Échanger', 'Tirer une carte Bonus'],
        data: { context: 'wish_ephemere' },
      });
    case 14:
      return input.startChooseTarget(
        next,
        input.playerId,
        'steal_bonus_or_surprise',
        'Filet magique : choisissez un joueur pour lui prendre une carte Bonus ou Surprise.',
      );
    case 15:
      return input.startChooseTarget(
        next,
        input.playerId,
        'grimoire_voyageur',
        'Grimoire voyageur : choisissez un joueur.',
      );
    default:
      return next;
  }
}




