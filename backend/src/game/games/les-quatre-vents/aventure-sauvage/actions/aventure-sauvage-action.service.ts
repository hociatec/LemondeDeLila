import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import type {
  AventureSauvageCard,
  AventureSauvageMetadata,
  AventureSauvageTile,
} from '../model/aventure-sauvage-state.entity';

@Injectable()
export class AventureSauvageActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
    private readonly turns: TurnFlowService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'roll' || type === 'ROLL_DICE' || type === 'roll_dice') {
        next = this.handleRoll(next);
      }
    }
    return next;
  }

  private handleRoll(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;
    if (state.pending) return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;

    const meta = this.getMeta(state);
    const rng = this.random.rollDice(meta as any, 6);
    const roll = rng.roll;

    let next: GameStateEntity = {
      ...state,
      metadata: { ...(state.metadata ?? {}), ...rng.meta },
      lastRoll: roll,
    };

    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} lance le dé : "${roll}".`,
    );

    const currentPos = meta.positions?.[currentId] ?? 0;
    const target = this.clampMove(currentPos + roll, meta.tiles.length);
    next = this.applyLanding(next, currentId, target);

    const afterMeta = this.getMeta(next);
    if (afterMeta.winnerId != null) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, afterMeta.winnerId)} remporte la partie !`,
      );
      return { ...next, status: 'finished' };
    }

    // Si la carte demande de rejouer, on garde le tour.
    const keep = Boolean((next.metadata as any)?.aventureKeepTurn);
    if (keep) {
      const cleaned = { ...(next.metadata ?? {}) } as any;
      delete cleaned.aventureKeepTurn;
      return { ...next, metadata: cleaned };
    }

    return this.turns.advanceTurn(next);
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
    position: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const tile: AventureSauvageTile | undefined = tiles[position];

    meta = {
      ...meta,
      positions: { ...(meta.positions ?? {}), [playerId]: position },
    };
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    const label = tile?.label ?? `Case ${position + 1}`;
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} arrive sur ${label}.`,
    );

    if (!tile) return next;

    if (tile.type === 'finish') {
      meta = this.getMeta(next);
      meta = { ...meta, winnerId: playerId };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (tile.type === 'animal') {
      return this.drawAndApplyCard(next, playerId, 'animal');
    }

    if (tile.type === 'patte') {
      return this.drawAndApplyCard(next, playerId, 'patte');
    }

    return next;
  }

  private drawAndApplyCard(
    state: GameStateEntity,
    playerId: number,
    deck: 'animal' | 'patte',
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const draw = this.drawCard(meta, deck);
    meta = draw.meta;

    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    const card = draw.card;
    if (!card) {
      return this.core.appendLog(next, `Aucune carte disponible (${deck}).`);
    }

    const prefix =
      deck === 'animal' ? 'Carte Animal rigolo' : 'Carte Coup de patte';
    next = this.core.appendLog(next, `${prefix} : ${card.text}`);

    // Cas spécial carte 17 (animal) : -1 puis +1 (net 0)
    if (card.id === 17 && deck === 'animal') {
      next = this.moveBy(next, playerId, -1);
      next = this.moveBy(next, playerId, +1);
      return next;
    }

    if (typeof card.moveDelta === 'number' && card.moveDelta !== 0) {
      next = this.moveBy(next, playerId, card.moveDelta);
    }

    if (card.skipTurns && card.skipTurns > 0) {
      next = this.addSkipTurns(next, playerId, card.skipTurns);
    }

    if (card.reroll) {
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), aventureKeepTurn: true },
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} rejoue.`,
      );
    }

    return next;
  }

  private moveBy(
    state: GameStateEntity,
    playerId: number,
    delta: number,
  ): GameStateEntity {
    if (!delta) return state;
    const meta = this.getMeta(state);
    const current = meta.positions?.[playerId] ?? 0;
    const nextPos = this.clampMove(current + delta, meta.tiles.length);
    return this.applyLanding(state, playerId, nextPos);
  }

  private addSkipTurns(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state) as any;
    const statuses = meta.statuses ?? { skipTurn: {} };
    const current = statuses.skipTurn?.[playerId] ?? 0;
    return {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        statuses: {
          ...statuses,
          skipTurn: {
            ...(statuses.skipTurn ?? {}),
            [playerId]: current + turns,
          },
        },
      },
    };
  }

  private drawCard(
    meta: AventureSauvageMetadata,
    deck: 'animal' | 'patte',
  ): { card: AventureSauvageCard | null; meta: AventureSauvageMetadata } {
    const decks = meta.decks ?? ({} as any);
    const drawPile: AventureSauvageCard[] = [...(decks[deck] ?? [])];
    const discardKey = deck === 'animal' ? 'discardAnimal' : 'discardPatte';
    const discardPile: AventureSauvageCard[] = [...(decks[discardKey] ?? [])];

    let pile = drawPile;
    let updatedMeta = meta;

    if (pile.length === 0) {
      // Réinitialiser le deck (simple).
      const defaults =
        deck === 'animal' ? defaultAnimalDeck() : defaultPatteDeck();
      const shuffled = this.random.shuffle(updatedMeta as any, defaults);
      updatedMeta = { ...updatedMeta, ...shuffled.meta };
      pile = shuffled.values;
      discardPile.length = 0;
    }

    const card = pile.shift() ?? null;
    if (card) {
      discardPile.push(card);
    }

    const nextDecks = {
      ...decks,
      [deck]: pile,
      [discardKey]: discardPile,
    };
    return { card, meta: { ...updatedMeta, decks: nextDecks } };
  }

  private clampMove(value: number, tilesLen: number): number {
    const max = Math.max(1, tilesLen) - 1;
    if (value <= 0) return 0;
    if (value >= max) return max;
    return value;
  }

  private getMeta(state: GameStateEntity): AventureSauvageMetadata {
    return (state.metadata ?? {}) as any as AventureSauvageMetadata;
  }

  private playerName(state: GameStateEntity, id: number): string {
    const players = Array.isArray(state.players) ? state.players : [];
    const p = players.find((x) => x?.id === id);
    const u =
      p?.username && String(p.username).trim()
        ? String(p.username).trim()
        : null;
    return u ?? `Joueur ${id}`;
  }
}

function defaultAnimalDeck(): AventureSauvageCard[] {
  return [
    {
      id: 1,
      deck: 'animal',
      text: 'Hyène : avancez de 2 cases.',
      moveDelta: 2,
    },
    {
      id: 2,
      deck: 'animal',
      text: 'Hippopotame : reculez d’1 case.',
      moveDelta: -1,
    },
    {
      id: 3,
      deck: 'animal',
      text: 'Impala : avancez de 3 cases.',
      moveDelta: 3,
    },
    { id: 4, deck: 'animal', text: 'Suricate : relancez le dé.', reroll: true },
    { id: 5, deck: 'animal', text: 'Flamant rose : restez sur place.' },
    {
      id: 6,
      deck: 'animal',
      text: 'Guépard : avancez d’1 case.',
      moveDelta: 1,
    },
    { id: 7, deck: 'animal', text: 'Buffle : avancez d’1 case.', moveDelta: 1 },
    {
      id: 8,
      deck: 'animal',
      text: 'Serpent : avancez de 2 cases.',
      moveDelta: 2,
    },
    { id: 9, deck: 'animal', text: 'Calao : avancez d’1 case.', moveDelta: 1 },
    { id: 10, deck: 'animal', text: 'Babouin : passez un tour.', skipTurns: 1 },
    {
      id: 11,
      deck: 'animal',
      text: 'Tisserin : avancez de 2 cases.',
      moveDelta: 2,
    },
    {
      id: 12,
      deck: 'animal',
      text: 'Musique : avancez de 3 cases.',
      moveDelta: 3,
    },
    {
      id: 13,
      deck: 'animal',
      text: 'Phacochère : avancez d’1 case.',
      moveDelta: 1,
    },
    { id: 14, deck: 'animal', text: 'Gecko : avancez d’1 case.', moveDelta: 1 },
    {
      id: 15,
      deck: 'animal',
      text: 'Pangolin : avancez d’1 case.',
      moveDelta: 1,
    },
    {
      id: 16,
      deck: 'animal',
      text: 'Marabout : avancez de 2 cases.',
      moveDelta: 2,
    },
    {
      id: 17,
      deck: 'animal',
      text: 'Grenouille : reculez d’1 case puis avancez d’1 case.',
    },
    {
      id: 18,
      deck: 'animal',
      text: 'Mangouste : avancez d’1 case.',
      moveDelta: 1,
    },
    {
      id: 19,
      deck: 'animal',
      text: 'Rhinocéros : avancez de 3 cases.',
      moveDelta: 3,
    },
    { id: 20, deck: 'animal', text: 'Arbre : restez sur place.' },
  ];
}

function defaultPatteDeck(): AventureSauvageCard[] {
  return [
    { id: 1, deck: 'patte', text: 'Civette : passez un tour.', skipTurns: 1 },
    { id: 2, deck: 'patte', text: 'Pluie : reculez d’1 case.', moveDelta: -1 },
    { id: 3, deck: 'patte', text: 'Nid : passez un tour.', skipTurns: 1 },
    {
      id: 4,
      deck: 'patte',
      text: 'Scorpion : reculez d’1 case.',
      moveDelta: -1,
    },
    { id: 5, deck: 'patte', text: 'Fourmilier : restez sur place.' },
    { id: 6, deck: 'patte', text: 'Baobab : passez un tour.', skipTurns: 1 },
    { id: 7, deck: 'patte', text: 'Manguier : passez un tour.', skipTurns: 1 },
    { id: 8, deck: 'patte', text: 'Feuilles : perdez un tour.', skipTurns: 1 },
    { id: 9, deck: 'patte', text: 'Caméléon : passez un tour.', skipTurns: 1 },
    {
      id: 10,
      deck: 'patte',
      text: 'Perroquet : reculez d’1 case.',
      moveDelta: -1,
    },
  ];
}
