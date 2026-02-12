import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import type {
  AventureSauvageCard,
  AventureSauvageMetadata,
  AventureSauvageTile,
} from '../model/aventure-sauvage-state.entity';
import { AVENTURE_SAUVAGE_PAWNS, resolvePawnId } from '../aventure-sauvage.pawns';

@Injectable()
export class AventureSauvageActionService {
  constructor(
    private readonly core: GameCoreService,
    private readonly random: RandomService,
  ) {}

  applyActions(
    state: GameStateEntity,
    actions: GameSingleActionDto[],
  ): GameStateEntity {
    let next = state;
    for (const action of actions ?? []) {
      const type = String(action?.type ?? '').trim();
      if (type === 'choose_pawn') {
        next = this.handleChoosePawn(next, action);
        continue;
      }
      if (type === 'roll' || type === 'ROLL_DICE' || type === 'roll_dice') {
        next = this.handleRoll(next);
        continue;
      }
      if (type === 'draw') {
        next = this.handleDraw(next);
        continue;
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

    const autoSkipped = this.autoSkipIfNeeded(state);
    if (autoSkipped !== state) return autoSkipped;

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
      `${this.playerName(next, currentId)} lance le dÈ : "${roll}".`,
    );

    const currentPos = meta.positions?.[currentId] ?? 0;
    const target = this.clampMove(currentPos + roll, meta.tiles.length);
    next = this.applyLanding(next, currentId, target);
    if (next.pending) return next;

    const afterMeta = this.getMeta(next);
    if (afterMeta.winnerId != null) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, afterMeta.winnerId)} remporte la partie !`,
      );
      return { ...next, status: 'finished' };
    }

    return this.advanceTurn(next);
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    const pending = state.pending as any;
    if (!pending || pending.type !== 'draw') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (!playerId) return state;

    const deckRaw = String(pending?.data?.deck ?? '').trim().toLowerCase();
    const deck = deckRaw === 'patte' ? 'patte' : 'animal';

    const cleared: GameStateEntity = { ...state, pending: null };
    let next = this.drawAndApplyCard(cleared, playerId, deck);

    const reroll = Boolean((next.metadata as any)?.aventureReroll);
    if (reroll) {
      const cleaned = { ...(next.metadata ?? {}) } as any;
      delete cleaned.aventureReroll;
      next = { ...next, metadata: cleaned };
    }

    if (next.pending) return next;

    const afterMeta = this.getMeta(next);
    if (afterMeta.winnerId != null) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, afterMeta.winnerId)} remporte la partie !`,
      );
      return { ...next, status: 'finished' };
    }

    if (reroll) {
      return next;
    }

    return this.advanceTurn(next);
  }

  private handleChoosePawn(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    const pending = state.pending as any;
    if (!pending || pending.type !== 'choose_pawn') return state;

    const playerId =
      typeof pending.playerId === 'number'
        ? pending.playerId
        : state.turn?.currentPlayerId ?? null;
    if (playerId == null) return state;

    const payload = (action?.payload ?? {}) as any;
    const rawPawn = payload.pawnId ?? payload.pawn ?? payload.value ?? null;
    const resolved = resolvePawnId(rawPawn);

    const options = Array.isArray(pending?.data?.pawns) ? pending.data.pawns : [];
    const chosen =
      resolved != null
        ? options.find((p: any) => resolvePawnId(p?.id) === resolved)
        : null;
    if (!chosen) return state;

    const meta = this.getMeta(state);
    const assigned = { ...(meta.pawnByPlayerId ?? {}) } as Record<number, string>;
    if (assigned[playerId]) return state;
    if (Object.values(assigned).some((id) => id === chosen.id)) return state;

    const nextMeta: AventureSauvageMetadata = {
      ...meta,
      pawns: Array.isArray(meta.pawns) && meta.pawns.length > 0 ? meta.pawns : AVENTURE_SAUVAGE_PAWNS,
      pawnByPlayerId: { ...assigned, [playerId]: chosen.id },
    };

    let next: GameStateEntity = {
      ...state,
      pending: null,
      metadata: { ...(state.metadata ?? {}), ...nextMeta },
    };

    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} choisit le pion : ${String(chosen.label ?? 'pion').trim()}.`,
    );

    const pendingInfo = this.buildPawnPending(next, playerId);
    if (pendingInfo) {
      return {
        ...next,
        pending: pendingInfo.pending,
        turnIndex: pendingInfo.turnIndex,
        turn: { ...(next.turn ?? { direction: 1 }), currentPlayerId: pendingInfo.playerId, direction: 1 },
      };
    }

    const players = Array.isArray(next.players) ? next.players : [];
    const starterId =
      typeof nextMeta.setupStarterId === 'number'
        ? nextMeta.setupStarterId
        : (state.turn?.currentPlayerId ?? players[0]?.id ?? null);
    const starterIndex =
      starterId != null ? players.findIndex((p) => p?.id === starterId) : -1;
    const resolvedStarterId =
      starterId != null && starterIndex >= 0
        ? starterId
        : players[0]?.id ?? null;

    const started: GameStateEntity = {
      ...next,
      pending: null,
      turnIndex: starterIndex >= 0 ? starterIndex : next.turnIndex,
      turn: { ...(next.turn ?? { direction: 1 }), currentPlayerId: resolvedStarterId, direction: 1 },
    };
    const starterName = this.playerName(started, resolvedStarterId ?? players[0]?.id ?? 0);
    let withLogs = this.core.appendLog(started, `DÈbut de partie : ${starterName} commence.`);
    withLogs = this.appendTurnAnnouncement(withLogs, resolvedStarterId);
    return withLogs;
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

    const labelRaw = String(tile?.label ?? '').trim();
    const label = labelRaw
      ? /^(case|dÈpart|arrivÈe)\b/i.test(labelRaw)
        ? labelRaw
        : `Case ${position + 1} - ${labelRaw}`
      : `Case ${position + 1}`;
    next = this.core.appendLog(
      next,
      `${this.playerName(next, playerId)} arrive sur ${label}.`,
    );
    const desc = typeof tile?.description === 'string' ? tile.description.trim() : '';
    if (desc) {
      next = this.core.appendLog(next, desc);
    }

    if (!tile) return next;

    if (tile.type === 'finish') {
      meta = this.getMeta(next);
      meta = { ...meta, winnerId: playerId };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (tile.type === 'animal') {
      next = this.core.appendLog(next, `Piochez une carte Animal rigolo.`);
    } else if (tile.type === 'patte') {
      next = this.core.appendLog(next, `Piochez une carte Coup de patte.`);
    }

    if (tile.type === 'animal') {
      return {
        ...next,
        pending: {
          type: 'draw',
          playerId,
          blocking: true,
          label: 'Piocher une carte Animal rigolo (Espace).',
          data: { deck: 'animal' },
        },
      };
    }

    if (tile.type === 'patte') {
      return {
        ...next,
        pending: {
          type: 'draw',
          playerId,
          blocking: true,
          label: 'Piocher une carte Coup de patte (Espace).',
          data: { deck: 'patte' },
        },
      };
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

    // Cas spÈcial carte 17 (animal) : -1 puis +1 (net 0)
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
        metadata: { ...(next.metadata ?? {}), aventureReroll: true },
      };
      next = this.core.appendLog(
        next,
        `${this.playerName(next, playerId)} rejoue.`,
      );
    }

    return next;
  }

  private buildPawnPending(
    state: GameStateEntity,
    startId: number | null,
  ): { pending: any; playerId: number; turnIndex: number } | null {
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return null;

    const meta = this.getMeta(state);
    const pawnByPlayerId = (meta.pawnByPlayerId ?? {}) as Record<number, string>;
    const startIndex =
      startId != null ? players.findIndex((p) => p?.id === startId) : -1;
    const count = players.length;
    const baseIndex = startIndex >= 0 ? startIndex : 0;
    let nextIndex = -1;
    for (let i = 0; i < count; i += 1) {
      const idx = (baseIndex + i) % count;
      const pid = players[idx]?.id;
      if (pid == null) continue;
      if (!pawnByPlayerId[pid]) {
        nextIndex = idx;
        break;
      }
    }
    if (nextIndex < 0) return null;

    const choices = this.availablePawns(meta, pawnByPlayerId);
    if (choices.length === 0) return null;

    return {
      playerId: players[nextIndex].id,
      turnIndex: nextIndex,
      pending: {
        type: 'choose_pawn',
        playerId: players[nextIndex].id,
        blocking: true,
        label: 'Choisissez votre pion.',
        choices: choices.map((p) =>
          p.description && String(p.description).trim().length > 0
            ? `${p.label}: ${p.description}`
            : p.label,
        ),
        data: {
          pawns: choices.map((p) => ({
            id: p.id,
            label: p.label,
            description: p.description,
          })),
        },
      },
    };
  }

  private availablePawns(
    meta: AventureSauvageMetadata,
    pawnByPlayerId: Record<number, string>,
  ): Array<{ id: string; label: string; description: string }> {
    const pawns =
      Array.isArray(meta.pawns) && meta.pawns.length > 0
        ? meta.pawns
        : AVENTURE_SAUVAGE_PAWNS;
    const used = new Set(
      Object.values(pawnByPlayerId).filter((v) => typeof v === 'string'),
    );
    return pawns.filter((p) => !used.has(p.id));
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
      // RÈinitialiser le deck (simple).
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

  private appendTurnAnnouncement(
    state: GameStateEntity,
    playerId: number | null | undefined,
  ): GameStateEntity {
    if (typeof playerId !== 'number' || !Number.isFinite(playerId)) {
      return state;
    }
    return this.core.appendLog(state, `C'est au tour de ${this.playerName(state, playerId)}.`);
  }

  private advanceTurn(state: GameStateEntity): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;

    const meta: any = state.metadata ?? {};
    const statuses: any = meta.statuses ?? {};
    const baseSkipTurn: Record<number, number> = statuses.skipTurn ?? {};

    const skipTurn: Record<number, number> = { ...baseSkipTurn };

    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex =
      currentId != null
        ? players.findIndex((p: any) => p?.id === currentId)
        : state.turnIndex;
    const startIndex =
      currentIndex >= 0 ? currentIndex : (typeof state.turnIndex === 'number' ? state.turnIndex : 0);

    let nextIndex = startIndex;
    const skipped: number[] = [];
    for (let attempts = 0; attempts < players.length * 2; attempts += 1) {
      nextIndex = (nextIndex + 1) % players.length;
      const pid = players[nextIndex]?.id;
      if (typeof pid !== 'number' || !Number.isFinite(pid)) continue;
      const remaining = skipTurn[pid] ?? 0;
      if (remaining > 0) {
        skipTurn[pid] = remaining - 1;
        skipped.push(pid);
        continue;
      }
      break;
    }

    let next: GameStateEntity = {
      ...state,
      turnIndex: nextIndex,
      turn: { currentPlayerId: players[nextIndex].id, direction: 1 },
      metadata: {
        ...meta,
        statuses: { ...statuses, skipTurn },
      },
    };

    // Important UX: si un joueur est saut√©, on l'annonce, sinon on a l'impression que "rien ne se passe".
    for (const pid of skipped) {
      next = this.core.appendLog(next, `${this.playerName(next, pid)} passe son tour.`);
    }

    return this.appendTurnAnnouncement(next, players[nextIndex].id);
  }

  private autoSkipIfNeeded(state: GameStateEntity): GameStateEntity {
    if (state.pending) return state;
    const meta = this.getMeta(state) as any;
    const currentId = state.turn?.currentPlayerId ?? null;
    if (currentId == null) return state;
    const statuses = meta.statuses ?? { skipTurn: {} };
    const remaining = Number(statuses.skipTurn?.[currentId] ?? 0);
    if (!Number.isFinite(remaining) || remaining <= 0) return state;

    const updatedSkip = {
      ...(statuses.skipTurn ?? {}),
      [currentId]: Math.max(0, remaining - 1),
    };

    let next: GameStateEntity = {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        statuses: { ...statuses, skipTurn: updatedSkip },
      },
    };

    next = this.core.appendLog(next, `${this.playerName(next, currentId)} passe son tour.`);
    return this.advanceTurn(next);
  }
}

function defaultAnimalDeck(): AventureSauvageCard[] {
  const deck: AventureSauvageCard[] = [
    {
      id: 1,
      deck: 'animal',
      text: "Vous entendez soudain le rire strident d'une hyËne tout prËs de vous. Surpris, vous trÈbuchez, tombez au sol et effectuez un roulÈ-boulÈ incontrÙlÈ qui vous propulse plus loin sur le chemin. Avancez de deux cases.",
      moveDelta: 2,
    },
    {
      id: 2,
      deck: 'animal',
      text: "Vous surprenez un hippopotame en train de b‚iller largement dans l'eau. EffrayÈ par sa gueule immense, vous reculez d'une case avant de retrouver votre Èquilibre en riant.",
      moveDelta: -1,
    },
    {
      id: 3,
      deck: 'animal',
      text: "Vous voyez un impala sauter agilement devant vous. Vous dÈcidez de le suivre et avancez de 3 cases.",
      moveDelta: 3,
    },
    {
      id: 4,
      deck: 'animal',
      text: 'Vous apercevez un suricate se redresser curieusement. Relancez le dÈ.',
      reroll: true,
    },
    {
      id: 5,
      deck: 'animal',
      text: "Vous observez un flamant rose glisser avec gr‚ce ‡ la surface de l'eau. FascinÈ par sa dÈmarche ÈlÈgante, vous restez un instant figÈ ‡ le contempler. Passez votre tour.",
      skipTurns: 1,
    },
    {
      id: 6,
      deck: 'animal',
      text: "Vous entendez le cri joyeux d'un guÈpard. Avancez de 1 case.",
      moveDelta: 1,
    },
    {
      id: 7,
      deck: 'animal',
      text: "Vous surprenez un buffle en train de se secouer aprËs s'Ítre roulÈ dans la boue. Ce spectacle vous amuse et vous fait avancer d'une case.",
      moveDelta: 1,
    },
    {
      id: 8,
      deck: 'animal',
      text: 'Vous marchez silencieusement comme un serpent dans la savane. Avancez de 2 cases.',
      moveDelta: 2,
    },
    {
      id: 9,
      deck: 'animal',
      text: "Vous apercevez un calao majestueux battre des ailes au-dessus de vous. Le souffle de son vol vous pousse lÈgËrement : avancez d'une case.",
      moveDelta: 1,
    },
    {
      id: 10,
      deck: 'animal',
      text: "Vous Ítes surpris par un babouin facÈtieux faisant tomber un rÈgime de bananes sur votre tÍte. …tourdi, vous passez votre tour.",
      skipTurns: 1,
    },
    {
      id: 11,
      deck: 'animal',
      text: "Vous entendez le chant joyeux d'un tisserin aux couleurs vives perchÈ dans un arbre. Son rythme farfelu vous fait battre des mains et taper des pieds : avancez de 2 cases.",
      moveDelta: 2,
    },
    {
      id: 12,
      deck: 'animal',
      text: 'Vous improvisez une mÈlodie avec des branches, des feuilles et des fruits tombÈs autour de vous. La musique de la jungle vous emporte, et sans vous en rendre compte, vous avancez de 3 cases.',
      moveDelta: 3,
    },
    {
      id: 13,
      deck: 'animal',
      text: "Vous voyez un phacochËre tournoyer sur lui-mÍme dans un Èlan de folie. Vous rigolez tellement que vous avancez d'une case en suivant son rythme.",
      moveDelta: 1,
    },
    {
      id: 14,
      deck: 'animal',
      text: "Vous surprenez un gecko en train de taper du pied sur une feuille. L'effet est si drÙle que vous avancez d'une case.",
      moveDelta: 1,
    },
    {
      id: 15,
      deck: 'animal',
      text: "Vous observez un petit pangolin qui se tortille en rythme sur le chemin. Cela vous amuse tellement que vous avancez d'une case.",
      moveDelta: 1,
    },
    {
      id: 16,
      deck: 'animal',
      text: "Vous comptabilisez les pas d'un grand marabout. Avancez de 2 cases.",
      moveDelta: 2,
    },
    {
      id: 17,
      deck: 'animal',
      text: "Vous poursuivez une grenouille gÈante de nÈnuphar en nÈnuphar. ¿ chaque saut, vous glissez, tournez en rond et finissez par reculer d'une case avant de rebondir aussitÙt en avant d'une case, en Èclatant de rire.",
    },
    {
      id: 18,
      deck: 'animal',
      text: "Vous apercevez une petite mangouste curieuse sur votre chemin. En essayant de l'Èviter, vous bondissez maladroitement et atterrissez avec un petit plouf sur une racine. Avancez de 1 case en riant de vous-mÍme.",
      moveDelta: 1,
    },
    {
      id: 19,
      deck: 'animal',
      text: 'Un rhinocÈros passe juste ‡ cÙtÈ de vous. Vous grimpez sur son dos et, ÈmerveillÈ, vous avancez de trois cases.',
      moveDelta: 3,
    },
    {
      id: 20,
      deck: 'animal',
      text: "Vous tentez de grimper ‡ un arbre pour observer la savane, mais vous vous retrouvez coincÈ dans les branches, les pieds dans le vide ! Vous passez votre tour bÍtement.",
      skipTurns: 1,
    },
  ];
  return deck;
}

function defaultPatteDeck(): AventureSauvageCard[] {
  const deck: AventureSauvageCard[] = [
    {
      id: 1,
      deck: 'patte',
      text: 'Vous croisez une civette endormie en travers du chemin. Surpris, vous restez immobile pour ne pas la rÈveiller. Passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 2,
      deck: 'patte',
      text: "Une pluie tropicale tombe soudainement. Vous vous faites Èclabousser et glissez un peu. Reculez d'une case.",
      moveDelta: -1,
    },
    {
      id: 3,
      deck: 'patte',
      text: "Le vent fait tomber un nid d'aigles serpentier juste devant vous. Vous restez bouche bÈe ‡ observer les petits oisillons s'agiter dans le nid. Passez votre tour.",
      skipTurns: 1,
    },
    {
      id: 4,
      deck: 'patte',
      text: "Un jeune scorpion forestier bloque votre chemin et s'amuse ‡ faire des pirouettes, sa queue tourbillonnant dans les airs. Vous sursautez en riant et reculez d'une case.",
      moveDelta: -1,
    },
    {
      id: 5,
      deck: 'patte',
      text: "Un trËs jeune fourmilier curieux s'approche de vous et renifle vos bottes comme un petit enfant intriguÈ. AmusÈ, il se jette au sol et se roule ‡ vos pieds. …clatant de rire, vous restez bloquÈ un instant et ne bougez pas de votre case. Passez votre tour.",
      skipTurns: 1,
    },
    {
      id: 6,
      deck: 'patte',
      text: 'Vous vous reposez sous un baobab pour reprendre des forces. Passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 7,
      deck: 'patte',
      text: 'Vous vous arrÍtez sous un manguier o˘ un loriquet farceur vous pique votre casquette. Passez votre tour pour la rÈcupÈrer.',
      skipTurns: 1,
    },
    {
      id: 8,
      deck: 'patte',
      text: 'Vous glissez sur des feuilles de bananier humides tombÈes au sol. Passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 9,
      deck: 'patte',
      text: 'Votre parcours est interrompu par un camÈlÈon changeant de couleur juste devant vous. Vous restez Èbahi. Passez votre tour.',
      skipTurns: 1,
    },
    {
      id: 10,
      deck: 'patte',
      text: "Un perroquet gris du Gabon se met ‡ grimper le long d'un tronc et tombe juste ‡ cÙtÈ de vous. Vous sursautez et reculez d'une case.",
      moveDelta: -1,
    },
  ];
  return deck;
}




