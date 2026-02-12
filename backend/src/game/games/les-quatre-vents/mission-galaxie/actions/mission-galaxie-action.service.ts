import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import type {
  MissionGalaxieChoiceCard,
  MissionGalaxieDeckName,
  MissionGalaxieEventCard,
  MissionGalaxieMetadata,
  MissionGalaxiePendingContext,
  MissionGalaxieTile,
} from '../model/mission-galaxie-state.entity';

type MissionGalaxieMetadataWithFlags = MissionGalaxieMetadata & {
  keepTurn?: boolean;
};

@Injectable()
export class MissionGalaxieActionService {
  constructor(
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
    private readonly core: GameCoreService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'roll' || type === 'ROLL_DICE') {
        next = this.handleRoll(next);
        continue;
      }
      if (type === 'draw') {
        next = this.handleDraw(next);
        continue;
      }
      if (type === 'choose_option') {
        next = this.handleChooseOption(next, action);
        continue;
      }
      if (type === 'choose_event_move') {
        next = this.handleChooseEventMove(next, action);
      }
    }
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    if (state.pending) return state;

    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    let meta = this.getMeta(state);
    const skipTurns = meta.statuses?.skipTurn?.[currentId] ?? 0;
    if (skipTurns > 0) {
      const nextStatuses = {
        ...meta.statuses,
        skipTurn: {
          ...(meta.statuses.skipTurn ?? {}),
          [currentId]: Math.max(0, skipTurns - 1),
        },
      };
      meta = { ...meta, statuses: nextStatuses };
      const skipped = this.core.appendLog(
        { ...state, metadata: { ...(state.metadata ?? {}), ...meta } },
        `${this.playerName(state, currentId)} passe son tour (${skipTurns} restant).`,
      );
      return this.turns.advanceTurn(skipped);
    }

    const rng = this.random.rollDice(meta as any, 6);
    meta = { ...meta, ...rng.meta };
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      lastRoll: roll,
      metadata: { ...(state.metadata ?? {}), ...meta },
    };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} lance le dé : "${roll}".`,
    );

    next = this.move(next, currentId, roll);
    next = this.applyLanding(next, currentId);

    const updatedMeta = this.getMeta(next);
    if (updatedMeta.winnerId != null) return { ...next, status: 'finished' };
    if (next.pending) return next;

    const keepTurn =
      (updatedMeta as MissionGalaxieMetadataWithFlags).keepTurn === true;
    if (keepTurn) {
      const nextMeta = { ...updatedMeta };
      delete (nextMeta as MissionGalaxieMetadataWithFlags).keepTurn;
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...nextMeta },
      };
      return this.core.appendLog(
        next,
        `${this.playerName(next, currentId)} rejoue.`,
      );
    }

    return this.turns.advanceTurn(next);
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const pending = state.pending as any;
    if (!pending || pending.type !== 'draw') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : (state.turn?.currentPlayerId ?? null);
    if (playerId == null) return state;

    const deckName = pending.data?.deck as MissionGalaxieDeckName | undefined;
    if (!deckName) return state;

    const meta = this.getMeta(state);
    const draw = this.drawCard(meta, deckName);
    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...draw.meta },
    };
    const card = draw.card;
    if (!card) {
      return this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} n'a plus de cartes ${deckName}.`,
      );
    }

    if (deckName === 'events') {
      return this.applyEventCard(
        next,
        playerId,
        card as MissionGalaxieEventCard,
      );
    }

    const cardKind = deckName === 'questions' ? 'question' : 'challenge';
    const ctx: MissionGalaxiePendingContext = {
      kind: cardKind,
      actorId: playerId,
      card: card as MissionGalaxieChoiceCard,
    };

    const pendingState: PendingState = {
      type: 'choose_option',
      playerId,
      blocking: true,
      label:
        cardKind === 'question'
          ? 'Répondez à la question galactique.'
          : 'Résolvez le défi cosmique.',
      choices: (card as MissionGalaxieChoiceCard).choices,
      data: { choices: (card as MissionGalaxieChoiceCard).choices },
    };

    const withContext = this.getMeta(next);
    const updatedMeta: MissionGalaxieMetadataWithFlags = {
      ...withContext,
      pendingContext: ctx,
    };
    next = {
      ...next,
      pending: pendingState,
      metadata: { ...(next.metadata ?? {}), ...updatedMeta },
    };
    return this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} pioche la carte "${card.title}".`,
    );
  }

  private handleChooseOption(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_option') return state;

    const choiceIndex = Number((action.payload as any)?.choiceIndex);
    if (!Number.isFinite(choiceIndex)) return state;

    const meta = this.getMeta(state);
    const ctx = meta.pendingContext;
    if (
      !ctx ||
      (ctx.kind !== 'question' && ctx.kind !== 'challenge') ||
      ctx.actorId !== currentId
    ) {
      return { ...state, pending: null };
    }

    const card = ctx.card;
    const isCorrect = choiceIndex === card.correctIndex;
    const delta = isCorrect ? card.correctDelta : card.wrongDelta;
    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        pendingContext: null,
      },
    };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} répond à "${card.title}" : ${
        isCorrect ? 'Correct' : 'Erreur'
      } (${delta >= 0 ? 'avance' : 'recule'} ${Math.abs(delta)}).`,
    );
    next = this.move(next, currentId, delta);
    next = this.applyLanding(next, currentId);
    return next;
  }

  private handleChooseEventMove(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    if (String(state.status ?? '').toLowerCase() !== 'started') return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_event_move') return state;

    const targetPlayerId = Number((action.payload as any)?.targetPlayerId);
    const delta = Number((action.payload as any)?.delta);
    if (!Number.isFinite(targetPlayerId) || !Number.isFinite(delta))
      return state;

    const meta = this.getMeta(state);
    const ctx = meta.pendingContext;
    if (!ctx || ctx.kind !== 'choosePlayerMove' || ctx.actorId !== currentId) {
      return { ...state, pending: null };
    }

    const options: Array<{ targetPlayerId: number; delta: number }> =
      Array.isArray(pending?.data?.options) ? pending.data.options : [];
    const isValid = options.some(
      (opt) => opt.targetPlayerId === targetPlayerId && opt.delta === delta,
    );
    if (!isValid) return state;

    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...meta, pendingContext: null },
    };
    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} applique ${
        delta >= 0 ? 'un boost' : 'une perturbation'
      } à ${this.playerName(next, targetPlayerId)} (${delta >= 0 ? '+' : ''}${delta}).`,
    );
    next = this.move(next, targetPlayerId, delta);
    next = this.applyLanding(next, targetPlayerId);
    return next;
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const pos = meta.positions?.[playerId] ?? 0;
    const tile = meta.tiles[pos];
    if (!tile) return next;

    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} met ${this.pawnLabel(next, playerId)} en case ${tile.n} (${tile.title}).`,
    );

    switch (tile.type) {
      case 'move':
        if (typeof tile.delta === 'number' && tile.delta !== 0) {
          next = this.core.appendLog(
            next,
            `${this.playerName(next, playerId)} suit l'effet du plateau (${tile.delta >= 0 ? 'avance' : 'recule'} ${Math.abs(
              tile.delta,
            )}).`,
          );
          next = this.move(next, playerId, tile.delta);
          return this.applyLanding(next, playerId);
        }
        break;
      case 'skip': {
        meta = this.getMeta(next);
        const currentSkip = meta.statuses?.skipTurn?.[playerId] ?? 0;
        const addition =
          typeof tile.skipTurns === 'number' ? tile.skipTurns : 1;
        meta = {
          ...meta,
          statuses: {
            ...meta.statuses,
            skipTurn: {
              ...(meta.statuses.skipTurn ?? {}),
              [playerId]: currentSkip + addition,
            },
          },
        };
        next = {
          ...next,
          metadata: { ...(next.metadata ?? {}), ...meta },
        };
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} doit sauter ${addition} tour(s).`,
        );
      }
      case 'question':
        next = this.core.appendLog(
          next,
          'Effet : piochez une question galactique.',
        );
        return this.promptDraw(next, playerId, 'questions');
      case 'challenge':
        next = this.core.appendLog(next, 'Effet : piochez un défi cosmique.');
        return this.promptDraw(next, playerId, 'challenges');
      case 'event':
        next = this.core.appendLog(
          next,
          'Effet : piochez un événement spatial.',
        );
        return this.promptDraw(next, playerId, 'events');
      case 'swapNearest':
        return this.applySwapNearest(next, playerId);
      case 'goto':
        if (typeof tile.target === 'number') {
          const targetIndex = Math.max(
            0,
            Math.min(tile.target - 1, meta.tiles.length - 1),
          );
          if (targetIndex !== pos) {
            next = this.setPos(next, playerId, targetIndex);
            return this.applyLanding(next, playerId);
          }
        }
        break;
      case 'finish':
        return this.finishGame(next, playerId);
      default:
    }

    if (tile.keepTurn) {
      meta = this.getMeta(next);
      const updatedMeta: MissionGalaxieMetadataWithFlags = {
        ...meta,
        keepTurn: true,
      };
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...updatedMeta },
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} reçoit un tour bonus.`,
      );
    }

    return next;
  }

  private promptDraw(
    state: GameStateEntity,
    playerId: number,
    deck: MissionGalaxieDeckName,
  ): GameStateEntity {
    const pending: PendingState = {
      type: 'draw',
      playerId,
      blocking: true,
      label:
        deck === 'events'
          ? 'Piochez un événement spatial.'
          : deck === 'questions'
            ? 'Piochez une question galactique.'
            : 'Piochez un défi cosmique.',
      data: { deck },
    };
    return { ...state, pending };
  }

  private applySwapNearest(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const pos = meta.positions?.[playerId] ?? 0;
    const entries = Object.entries(meta.positions ?? {})
      .map(([key, value]) => ({ id: Number(key), pos: value ?? 0 }))
      .filter((entry) => Number.isFinite(entry.id) && entry.id !== playerId);
    if (!entries.length) return next;
    const closest = entries.reduce(
      (best, current) => {
        const diff = Math.abs(current.pos - pos);
        return best === null || diff < Math.abs(best.pos - pos)
          ? current
          : best;
      },
      null as { id: number; pos: number } | null,
    );
    if (!closest) return next;

    const nextPositions = {
      ...(meta.positions ?? {}),
      [playerId]: closest.pos,
      [closest.id]: pos,
    };
    meta = { ...meta, positions: nextPositions };
    next = {
      ...next,
      metadata: { ...(next.metadata ?? {}), ...meta },
    };
    return this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} échangée sa position avec ${this.playerName(next, closest.id)}.`,
    );
  }

  private applyEventCard(
    state: GameStateEntity,
    playerId: number,
    card: MissionGalaxieEventCard,
  ): GameStateEntity {
    let next = this.core.appendLog(
      state,
      `${this.playerName(state, playerId)} déclenche l'événement "${card.title}".`,
    );
    const effect = card.effect;
    switch (effect.kind) {
      case 'move':
        next = this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} avance de ${effect.delta} cases.`,
        );
        next = this.move(next, playerId, effect.delta);
        return this.applyLanding(next, playerId);
      case 'skip':
        next = this.addSkip(next, playerId, effect.turns);
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} doit sauter ${effect.turns} tour(s).`,
        );
      case 'none':
        return next;
      case 'reroll':
        next = this.setKeepTurn(next, playerId);
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} relance immédiatement le dé.`,
        );
      case 'keepTurn':
        next = this.setKeepTurn(next, playerId);
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} rejoue immédiatement.`,
        );
      case 'goto':
        next = this.setPos(
          next,
          playerId,
          Math.max(
            0,
            Math.min(effect.target - 1, this.getMeta(next).tiles.length - 1),
          ),
        );
        next = this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} avance jusqu'à la case ${effect.target}.`,
        );
        return this.applyLanding(next, playerId);
      case 'skipOthers':
        next = this.skipOthers(next, playerId, effect.turns);
        return this.core.appendLog(
          next,
          `${this.playerName(next, playerId)} force les autres à sauter ${effect.turns} tour(s).`,
        );
      case 'choosePlayerMove':
        return this.promptPlayerMove(next, playerId, effect.deltas);
      default:
        return next;
    }
  }

  private promptPlayerMove(
    state: GameStateEntity,
    playerId: number,
    deltas: number[],
  ): GameStateEntity {
    let next = state;
    const players = Array.isArray(state.players) ? state.players : [];
    const options: Array<{
      targetPlayerId: number;
      delta: number;
      label: string;
    }> = [];
    const meta = this.getMeta(state);
    const me = players.find((p) => p?.id === playerId);
    const targetPlayers = players.filter((p) => p?.id != null);
    for (const delta of deltas) {
      for (const player of targetPlayers) {
        const targetId = player.id;
        options.push({
          targetPlayerId: targetId,
          delta,
          label: `${this.playerName(next, targetId)} ${delta >= 0 ? `avance de ${delta}` : `recule de ${Math.abs(delta)}`}`,
        });
      }
    }

    const pending: PendingState = {
      type: 'choose_event_move',
      playerId,
      blocking: true,
      label: 'Choisissez un joueur et un mouvement.',
      data: { options },
    };
    const nextMeta: MissionGalaxieMetadataWithFlags = {
      ...this.getMeta(next),
      pendingContext: {
        kind: 'choosePlayerMove',
        actorId: playerId,
        deltas,
      },
    };
    next = {
      ...next,
      pending,
      metadata: { ...(next.metadata ?? {}), ...nextMeta },
    };
    return next;
  }

  private addSkip(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const currentSkip = meta.statuses?.skipTurn?.[playerId] ?? 0;
    const nextMeta = {
      ...meta,
      statuses: {
        ...meta.statuses,
        skipTurn: {
          ...(meta.statuses.skipTurn ?? {}),
          [playerId]: currentSkip + turns,
        },
      },
    };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
  }

  private setKeepTurn(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: MissionGalaxieMetadataWithFlags = {
      ...meta,
      keepTurn: true,
    };
    return {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };
  }

  private skipOthers(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const skip = { ...(meta.statuses.skipTurn ?? {}) };
    const players = Array.isArray(state.players) ? state.players : [];
    for (const player of players) {
      if (player?.id == null || player.id === playerId) continue;
      skip[player.id] = (skip[player.id] ?? 0) + turns;
    }
    const nextMeta = {
      ...meta,
      statuses: { ...meta.statuses, skipTurn: skip },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private finishGame(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...meta, winnerId: playerId },
      status: 'finished',
    };
    return this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} atteint la planète légendaire !`,
    );
  }

  private move(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const position = meta.positions?.[playerId] ?? 0;
    const newPosition = Math.max(
      0,
      Math.min(position + delta, (meta.tiles?.length ?? 1) - 1),
    );
    return this.setPos(state, playerId, newPosition);
  }

  private setPos(
    state: GameStateEntity,
    playerId: number,
    pos: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const nextMeta: MissionGalaxieMetadata = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: pos },
    };
    return { ...state, metadata: { ...(state.metadata ?? {}), ...nextMeta } };
  }

  private drawCard(
    meta: MissionGalaxieMetadata,
    deck: MissionGalaxieDeckName,
  ): {
    card: MissionGalaxieChoiceCard | MissionGalaxieEventCard | null;
    meta: MissionGalaxieMetadata;
  } {
    const deckList = Array.isArray(meta.decks[deck]) ? meta.decks[deck] : [];
    const discardList = Array.isArray(meta.discards[deck])
      ? meta.discards[deck]
      : [];
    if (!deckList.length && discardList.length) {
      const reshuffle = this.random.shuffle(meta as any, discardList as any[]);
      const reshuffled: MissionGalaxieMetadata = {
        ...meta,
        decks: { ...meta.decks, [deck]: reshuffle.values as any },
        discards: { ...meta.discards, [deck]: [] },
      };
      return this.drawCard(
        {
          ...reshuffled,
          ...(reshuffle.meta ?? {}),
        } as MissionGalaxieMetadata,
        deck,
      );
    }
    if (!deckList.length) return { card: null, meta };
    const [card, ...rest] = deckList;
    const nextMeta: MissionGalaxieMetadata = {
      ...meta,
      decks: { ...meta.decks, [deck]: rest },
      discards: { ...meta.discards, [deck]: [...discardList, card as any] },
    };
    return { card, meta: nextMeta };
  }

  private playerName(state: GameStateEntity, id: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((p) => p?.id === id);
    const username =
      player?.username && String(player.username).trim()
        ? String(player.username).trim()
        : null;
    return username ?? `Joueur ${id}`;
  }

  private pawnLabel(state: GameStateEntity, id: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const player = players.find((p: any) => p?.id === id) as any;
    const pawn =
      typeof player?.pawn === 'string' ? String(player.pawn).trim() : '';
    const resolved = pawn || this.playerName(state, id);
    return `le pion "${resolved}"`;
  }

  private getMeta(state: GameStateEntity): MissionGalaxieMetadata {
    return (state.metadata ?? {}) as MissionGalaxieMetadata;
  }
}
