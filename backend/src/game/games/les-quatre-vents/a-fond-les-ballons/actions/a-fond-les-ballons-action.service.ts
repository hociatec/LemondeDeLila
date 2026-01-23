import { Injectable } from '@nestjs/common';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import type {
  AFondLesBallonsCard,
  AFondLesBallonsMetadata,
  AFondLesBallonsPendingSwap,
  AFondLesBallonsTile,
} from '../model/a-fond-les-ballons-state.entity';

@Injectable()
export class AFondLesBallonsActionService {
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
        continue;
      }
      if (type === 'swap_choose_target') {
        next = this.handleSwapChooseTarget(next, action);
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
    next = this.moveBy(next, currentId, roll, 0);

    const afterMeta = this.getMeta(next);
    if (afterMeta.winnerId != null) {
      next = this.core.appendLog(
        next,
        `${this.playerName(next, afterMeta.winnerId)} remporte la partie !`,
      );
      return { ...next, status: 'finished' };
    }

    if (next.pending) return next;

    const keepTurn = Boolean((next.metadata as any)?.aFondKeepTurn);
    if (keepTurn) {
      const cleaned = { ...(next.metadata ?? {}) } as any;
      delete cleaned.aFondKeepTurn;
      return { ...next, metadata: cleaned };
    }

    next = this.decrementTrapImmunity(next, currentId);
    return this.advanceTurnWithSkipLogs(next);
  }

  private handleSwapChooseTarget(
    state: GameStateEntity,
    action: GameSingleActionDto,
  ): GameStateEntity {
    const status = String(state.status ?? '').toLowerCase();
    if (status !== 'started') return state;

    const pending = state.pending as any as AFondLesBallonsPendingSwap | null;
    if (!pending || pending.type !== 'swap') return state;

    const currentId = pending.playerId;
    const payload = (action?.payload ?? {}) as any;
    const targetPlayerId =
      typeof payload.targetPlayerId === 'number'
        ? payload.targetPlayerId
        : Number(payload.targetPlayerId);
    if (!Number.isFinite(targetPlayerId)) return state;

    const target = (pending.data.targets ?? []).find(
      (t) => t.targetPlayerId === targetPlayerId,
    );
    if (!target) return state;

    let next: GameStateEntity = { ...state, pending: null };
    const meta = this.getMeta(next);
    const positions = { ...(meta.positions ?? {}) };

    const fromPos = positions[currentId] ?? 0;
    const toPos = positions[targetPlayerId] ?? 0;

    positions[currentId] = toPos;
    positions[targetPlayerId] = fromPos;

    next = {
      ...next,
      metadata: { ...(next.metadata ?? {}), ...meta, positions },
    };

    next = this.core.appendLog(
      next,
      `${this.playerName(next, currentId)} échange sa place avec ${this.playerName(next, targetPlayerId)}.`,
    );

    next = this.decrementTrapImmunity(next, currentId);
    return this.advanceTurnWithSkipLogs(next);
  }

  private advanceTurnWithSkipLogs(state: GameStateEntity): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    if (!players.length) return state;

    const meta: any = state.metadata ?? {};
    const statuses: any = meta.statuses ?? {};
    const skipTurn: Record<number, number> = statuses.skipTurn ?? {};
    const updatedSkip = { ...skipTurn };

    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex =
      currentId != null
        ? players.findIndex((p: any) => p?.id === currentId)
        : state.turnIndex;

    let nextIndex = currentIndex >= 0 ? currentIndex : state.turnIndex;
    let attempts = 0;
    let next = state;

    do {
      nextIndex = (nextIndex + 1) % players.length;
      const pid = (players[nextIndex] as any)?.id;
      const remaining = updatedSkip[pid] ?? 0;
      if (remaining > 0) {
        updatedSkip[pid] = remaining - 1;
        next = this.core.appendLog(
          next,
          `${this.playerName(next, pid)} passe son tour.`,
        );
        attempts += 1;
        continue;
      }
      break;
    } while (attempts < players.length);

    return {
      ...next,
      turnIndex: nextIndex,
      turn: { currentPlayerId: (players[nextIndex] as any).id, direction: 1 },
      metadata: {
        ...meta,
        statuses: { ...statuses, skipTurn: updatedSkip },
      },
    };
  }

  private moveBy(
    state: GameStateEntity,
    playerId: number,
    delta: number,
    depth: number,
  ): GameStateEntity {
    if (!delta) return state;
    if (depth > 10)
      return this.core.appendLog(state, 'Effet en chaîne interrompu.');

    const meta = this.getMeta(state);
    const current = meta.positions?.[playerId] ?? 0;
    const target = this.computeTarget(current, delta, meta.tiles.length - 1);
    return this.applyLanding(state, playerId, target, depth + 1);
  }

  private applyLanding(
    state: GameStateEntity,
    playerId: number,
    position: number,
    depth: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const tile: AFondLesBallonsTile | undefined = tiles[position];

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

    if (tile.description && String(tile.description).trim().length > 0) {
      next = this.core.appendLog(next, String(tile.description).trim());
    }

    if (tile.type === 'finish') {
      meta = this.getMeta(next);
      meta = { ...meta, winnerId: playerId };
      return { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };
    }

    if (tile.type === 'bonus') {
      next = this.core.appendLog(next, 'Bonus : avancez de 2 cases.');
      return this.moveBy(next, playerId, 2, depth);
    }

    if (tile.type === 'piege') {
      if (this.hasTrapImmunity(next, playerId)) {
        return this.core.appendLog(next, 'Piège ignoré.');
      }
      next = this.core.appendLog(next, 'Piège : reculez de 2 cases.');
      return this.moveBy(next, playerId, -2, depth);
    }

    if (tile.type === 'glissade') {
      const metaNow = this.getMeta(next);
      const magOut = this.random.nextInt(metaNow as any, 3);
      const dirOut = this.random.nextInt(magOut.meta, 2);
      next = {
        ...next,
        metadata: { ...(next.metadata ?? {}), ...dirOut.meta },
      };
      const mag = magOut.value + 1;
      const isForward = dirOut.value % 2 === 0;
      const delta = isForward ? mag : -mag;
      next = this.core.appendLog(
        next,
        `Glissade : ${delta > 0 ? 'avancez' : 'reculez'} de ${Math.abs(delta)} case(s).`,
      );
      return this.moveBy(next, playerId, delta, depth);
    }

    if (tile.type === 'tornade') {
      return this.startSwapPending(
        next,
        playerId,
        'Tornade : choisissez un joueur à échanger dans la liste, puis Entrée.',
      );
    }

    if (tile.type === 'chaton') {
      next = this.core.appendLog(next, 'Chaton : retour à la case départ.');
      return this.applyLanding(next, playerId, 0, depth + 1);
    }

    if (tile.type === 'folie') {
      return this.drawAndApplyLoufoque(next, playerId, depth);
    }

    return next;
  }

  private drawAndApplyLoufoque(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const draw = this.drawLoufoque(meta);
    meta = draw.meta;
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    const card = draw.card;
    if (!card)
      return this.core.appendLog(next, 'Aucune carte Loufoque disponible.');

    next = this.core.appendLog(next, `Carte Loufoque : ${card.text}`);
    return this.applyCardEffect(next, playerId, card, depth);
  }

  private applyCardEffect(
    state: GameStateEntity,
    playerId: number,
    card: AFondLesBallonsCard,
    depth: number,
  ): GameStateEntity {
    let next = state;
    const meta = this.getMeta(next);
    const roll = typeof next.lastRoll === 'number' ? next.lastRoll : 0;

    switch (card.id) {
      case 1:
        return this.moveBy(next, playerId, -2, depth);
      case 2:
        return this.skipTurns(next, playerId, 1);
      case 3:
        return this.moveBy(next, playerId, 1, depth);
      case 4:
        next = this.core.appendLog(
          next,
          'La partie est figée : tous les joueurs passent un tour.',
        );
        for (const p of next.players ?? []) {
          next = this.core.appendLog(
            next,
            `${this.playerName(next, p.id)} passera son prochain tour.`,
          );
          next = this.skipTurns(next, p.id, 1);
        }
        return next;
      case 5:
        return this.moveBy(next, playerId, 4, depth);
      case 6:
        for (const p of next.players ?? []) {
          next = this.moveBy(next, p.id, -1, depth);
        }
        return next;
      case 7:
        return this.moveBy(next, playerId, 2, depth);
      case 8:
        return this.moveBy(next, playerId, -1, depth);
      case 9:
        return this.skipTurns(next, playerId, 1);
      case 10:
        return this.moveToNextType(next, playerId, 'bonus', depth);
      case 11:
        return this.skipTurns(next, playerId, 1);
      case 12:
        return this.moveBy(next, playerId, -1, depth);
      case 13:
        return this.moveBy(next, playerId, 1, depth);
      case 14:
        return this.moveBy(next, playerId, 3, depth);
      case 15:
        return this.moveBy(next, playerId, -1, depth);
      case 16:
        return this.moveToNextType(next, playerId, 'folie', depth);
      case 17:
        return this.skipTurns(next, playerId, 1);
      case 18:
        return this.moveBy(next, playerId, 2, depth);
      case 19:
        return this.moveBy(next, playerId, 1, depth);
      case 20:
        return this.skipTurns(next, playerId, 1);
      case 21:
        for (const p of next.players ?? []) {
          next = this.moveBy(next, p.id, 1, depth);
        }
        return next;
      case 22:
        return this.skipTurns(next, playerId, 2);
      case 23:
        return this.moveBy(next, playerId, 4, depth);
      case 24:
        return this.skipTurns(next, playerId, 1);
      case 25:
        return {
          ...next,
          metadata: { ...(next.metadata ?? {}), ...meta, aFondKeepTurn: true },
        } as any;
      case 26:
        if (roll > 0) {
          for (const p of next.players ?? []) {
            next = this.moveBy(next, p.id, roll, depth);
          }
        }
        return next;
      case 27:
        next = this.moveBy(next, playerId, 1, depth);
        next = this.moveBy(next, playerId, -2, depth);
        return next;
      case 28:
        return this.startSwapPending(
          next,
          playerId,
          'Échange : choisissez un joueur à échanger dans la liste, puis Entrée.',
        );
      case 29:
        return this.applyLanding(next, playerId, 12, depth + 1);
      case 30:
        return this.skipTurns(next, playerId, 1);
      case 31:
        return this.moveBy(next, playerId, 1, depth);
      case 32:
        return this.moveBy(next, playerId, 2, depth);
      case 33:
        return this.moveBy(next, playerId, 3, depth);
      case 34:
        return this.applyBoutiqueWorstCard(next, playerId, depth);
      case 35:
        return this.applyLanding(next, playerId, 0, depth + 1);
      case 36:
        return this.grantTrapImmunity(next, playerId, 2);
      case 37:
        return this.moveBy(next, playerId, -5, depth);
      case 38:
        for (const p of next.players ?? []) {
          const m1 = this.random.nextInt(this.getMeta(next) as any, 2);
          next = {
            ...next,
            metadata: { ...(next.metadata ?? {}), ...m1.meta },
          };
          const delta = m1.value % 2 === 0 ? 1 : -1;
          next = this.moveBy(next, p.id, delta, depth);
        }
        return next;
      case 39:
        return this.moveBy(next, playerId, 2, depth);
      case 40: {
        const pos = (this.getMeta(next).positions ?? {})[playerId] ?? 0;
        const tile = (this.getMeta(next).tiles ?? [])[pos];
        if (tile?.type === 'glissade') {
          return this.applyLanding(
            next,
            playerId,
            (this.getMeta(next).tiles.length ?? 40) - 1,
            depth + 1,
          );
        }
        return next;
      }
      default:
        return next;
    }
  }

  private applyBoutiqueWorstCard(
    state: GameStateEntity,
    playerId: number,
    depth: number,
  ): GameStateEntity {
    let next = state;
    let meta = this.getMeta(next);
    const d1 = this.drawLoufoque(meta);
    meta = d1.meta;
    const d2 = this.drawLoufoque(meta);
    meta = d2.meta;
    next = { ...next, metadata: { ...(next.metadata ?? {}), ...meta } };

    const c1 = d1.card;
    const c2 = d2.card;
    if (!c1 && !c2) return next;
    if (c1) next = this.core.appendLog(next, `Boutique : carte 1 : ${c1.text}`);
    if (c2) next = this.core.appendLog(next, `Boutique : carte 2 : ${c2.text}`);

    const chosen = pickMostReculer(c1, c2);
    if (!chosen) return next;
    next = this.core.appendLog(
      next,
      'Boutique : application de la carte la plus défavorable.',
    );
    return this.applyCardEffect(next, playerId, chosen, depth);
  }

  private startSwapPending(
    state: GameStateEntity,
    playerId: number,
    label: string,
  ): GameStateEntity {
    const players = Array.isArray(state.players) ? state.players : [];
    const targets = players
      .filter((p) => p?.id !== playerId)
      .map((p: any) => ({
        targetPlayerId: p.id,
        targetUsername: p.username ?? `Joueur ${p.id}`,
      }));
    if (!targets.length) {
      return this.core.appendLog(
        state,
        'Aucun joueur disponible pour un échange de place.',
      );
    }
    const pending: AFondLesBallonsPendingSwap = {
      type: 'swap',
      label,
      playerId,
      blocking: true,
      choices: targets.map((t) => t.targetUsername),
      data: { targets },
    };
    return { ...state, pending };
  }

  private moveToNextType(
    state: GameStateEntity,
    playerId: number,
    type: AFondLesBallonsTile['type'],
    depth: number,
  ): GameStateEntity {
    const meta = this.getMeta(state);
    const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
    const current = meta.positions?.[playerId] ?? 0;
    const idx = tiles.findIndex((t, i) => i > current && t?.type === type);
    if (idx < 0) return state;
    return this.applyLanding(state, playerId, idx, depth + 1);
  }

  private skipTurns(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state) as any;
    const statuses = meta.statuses ?? { skipTurn: {}, trapImmunityTurns: {} };
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

  private grantTrapImmunity(
    state: GameStateEntity,
    playerId: number,
    turns: number,
  ): GameStateEntity {
    const meta = this.getMeta(state) as any;
    const statuses = meta.statuses ?? { skipTurn: {}, trapImmunityTurns: {} };
    const current = statuses.trapImmunityTurns?.[playerId] ?? 0;
    return {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        statuses: {
          ...statuses,
          trapImmunityTurns: {
            ...(statuses.trapImmunityTurns ?? {}),
            [playerId]: current + turns,
          },
        },
      },
    };
  }

  private hasTrapImmunity(state: GameStateEntity, playerId: number): boolean {
    const meta = this.getMeta(state) as any;
    const turns = meta?.statuses?.trapImmunityTurns?.[playerId] ?? 0;
    return Number(turns) > 0;
  }

  private decrementTrapImmunity(
    state: GameStateEntity,
    playerId: number,
  ): GameStateEntity {
    const meta = this.getMeta(state) as any;
    const statuses = meta.statuses ?? { skipTurn: {}, trapImmunityTurns: {} };
    const current = Number(statuses.trapImmunityTurns?.[playerId] ?? 0);
    if (!Number.isFinite(current) || current <= 0) return state;
    const nextValue = current - 1;
    return {
      ...state,
      metadata: {
        ...(state.metadata ?? {}),
        ...meta,
        statuses: {
          ...statuses,
          trapImmunityTurns: {
            ...(statuses.trapImmunityTurns ?? {}),
            [playerId]: nextValue,
          },
        },
      },
    };
  }

  private drawLoufoque(meta: AFondLesBallonsMetadata): {
    card: AFondLesBallonsCard | null;
    meta: AFondLesBallonsMetadata;
  } {
    const decks = meta.decks ?? ({} as any);
    const pile: AFondLesBallonsCard[] = [...(decks.loufoque ?? [])];
    const discard: AFondLesBallonsCard[] = [...(decks.discardLoufoque ?? [])];

    let updatedMeta = meta;
    let drawPile = pile;

    if (drawPile.length === 0) {
      const defaults = defaultLoufoqueDeck();
      const shuffled = this.random.shuffle(updatedMeta as any, defaults);
      updatedMeta = { ...updatedMeta, ...shuffled.meta };
      drawPile = shuffled.values;
      discard.length = 0;
    }

    const card = drawPile.shift() ?? null;
    if (card) discard.push(card);

    return {
      card,
      meta: {
        ...updatedMeta,
        decks: {
          ...decks,
          loufoque: drawPile,
          discardLoufoque: discard,
        },
      },
    };
  }

  private computeTarget(
    current: number,
    delta: number,
    finalIndex: number,
  ): number {
    let value = current + delta;
    if (value < 0) return 0;
    while (value > finalIndex) {
      const overshoot = value - finalIndex;
      value = finalIndex - overshoot;
      if (value < 0) return 0;
    }
    return value;
  }

  private getMeta(state: GameStateEntity): AFondLesBallonsMetadata {
    return (state.metadata ?? {}) as any as AFondLesBallonsMetadata;
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

function pickMostReculer(
  a: AFondLesBallonsCard | null,
  b: AFondLesBallonsCard | null,
): AFondLesBallonsCard | null {
  const score = (c: AFondLesBallonsCard | null): number => {
    if (!c) return Number.POSITIVE_INFINITY;
    if (c.id === 37) return -5;
    if (c.id === 29) return -100;
    if (c.id === 35) return -200;
    if (c.id === 1) return -2;
    if (c.id === 6 || c.id === 8 || c.id === 12 || c.id === 15) return -1;
    if (c.id === 27) return -1;
    return 0;
  };
  const sa = score(a);
  const sb = score(b);
  if (sa === Number.POSITIVE_INFINITY && sb === Number.POSITIVE_INFINITY)
    return null;
  return sa <= sb ? a : b;
}

function defaultLoufoqueDeck(): AFondLesBallonsCard[] {
  return [
    {
      id: 1,
      text: 'Vous glissez sur une peau de banane séchée. Reculez de 2 cases.',
    },
    {
      id: 2,
      text: 'Un muscardin vous livre un cookie géant, beaucoup trop lourd. Passez votre tour.',
    },
    {
      id: 3,
      text: 'Vous sautez dans une flaque de confiture collante. Avancez d’une case.',
    },
    {
      id: 4,
      text: 'Une noix étrange chante et perturbe la tanière. La partie est figée : aucun joueur n’agit pendant ce tour.',
    },
    {
      id: 5,
      text: 'Un écureuil volant vous prend pour un ami et vous emporte dans les airs. Avancez de 4 cases.',
    },
    {
      id: 6,
      text: 'Vous renversez une bouteille de sirop magique. Tous les joueurs reculent d’une case.',
    },
    {
      id: 7,
      text: 'Vous trouvez une corde à sauter en réglisse enchantée. Avancez de 2 cases.',
    },
    { id: 8, text: 'Le Grand Chaton éternue violemment. Reculez d’une case.' },
    {
      id: 9,
      text: 'Vous vous prenez les pattes dans du chewing-gum collant. Passez votre tour.',
    },
    {
      id: 10,
      text: 'Un lérot ninja surgit et vous tend une noisette turbo. Avancez jusqu’à la prochaine case Bonus.',
    },
    {
      id: 11,
      text: 'Vous mangez trop de pop-corn et avez mal au ventre. Passez votre tour.',
    },
    {
      id: 12,
      text: 'Votre museau vous démange sans raison. Reculez d’une case.',
    },
    {
      id: 13,
      text: 'Une gerboise farceuse vous chatouille les pattes. Sautez d’une case.',
    },
    {
      id: 14,
      text: 'Vous chevauchez un ragondin en trottinette. Avancez de 3 cases.',
    },
    {
      id: 15,
      text: 'Vous faites tomber une montagne de cacahuètes. Distrait, vous reculez d’une case.',
    },
    {
      id: 16,
      text: 'Une bulle de savon géante vous emporte. Avancez jusqu’à la prochaine case Folie.',
    },
    {
      id: 17,
      text: 'Un capybara vous invite à une sieste improvisée. Passez votre tour et ronflez à ses côtés.',
    },
    {
      id: 18,
      text: 'Une souris malicieuse vous pique une noisette et file à toute vitesse. Vous la poursuivez et avancez de 2 cases.',
    },
    {
      id: 19,
      text: 'Un loir vous montre le chemin en remuant la queue. Avancez d’une case en souriant.',
    },
    {
      id: 20,
      text: 'Vous confondez une chaussette avec un bonnet, et ne voyez plus rien. Passez votre tour.',
    },
    {
      id: 21,
      text: 'Vous renversez un pot de peinture fluo. Tout le monde avance d’une case.',
    },
    {
      id: 22,
      text: 'Une baguette magique vous transforme temporairement en fromage. Passez deux tours.',
    },
    { id: 23, text: 'Vous trouvez un trampoline géant. Avancez de 4 cases.' },
    {
      id: 24,
      text: 'Un agouti philosophe vous parle longuement. Passez votre tour.',
    },
    {
      id: 25,
      text: 'Vous construisez une solide cabane en biscuits. Rejouez.',
    },
    {
      id: 26,
      text: 'Vous éternuez des confettis multicolores. Tous les joueurs avancent du même nombre de cases obtenu précédemment.',
    },
    {
      id: 27,
      text: 'Un petit avion de carton vous emporte maladroitement. Avancez d’une case, puis reculez de deux.',
    },
    {
      id: 28,
      text: 'Vous lisez un vieux grimoire ronronique. Échangez votre position avec le joueur de votre choix.',
    },
    {
      id: 29,
      text: 'Une catapulte de fromage rebondit sur vous. Allez en case 13.',
    },
    {
      id: 30,
      text: 'Vous tombez dans une mare d’épaisse mousse. Passez votre tour.',
    },
    {
      id: 31,
      text: 'Un hutia curieux bondit sur votre chemin et vous bouscule gentiment. Avancez d’une case… un peu étourdi.',
    },
    {
      id: 32,
      text: 'Un fromage qui parle vous raconte une irrésistible blague. Avancez de 2 cases.',
    },
    {
      id: 33,
      text: 'Vous jouez à saute-rongeur avec un paca. Avancez de 3 cases.',
    },
    {
      id: 34,
      text: 'Vous entrez dans la Boutique des Rongeurs Fous. Piochez deux cartes Loufoques et appliquez celle qui vous fait le plus reculer.',
    },
    {
      id: 35,
      text: 'Un tunnel défectueux vous mène droit chez le Chaton gourmand. Retournez à la case départ.',
    },
    {
      id: 36,
      text: 'Vous devenez temporairement invisible. Durant deux tours, vous ignorez les effets des cases Piège.',
    },
    {
      id: 37,
      text: 'Vous mangez un piment super piquant. Reculez de 5 cases.',
    },
    {
      id: 38,
      text: 'Un biscuit géant explose. Tous les joueurs se déplacent d’une case aléatoire.',
    },
    {
      id: 39,
      text: 'Une pluie de bonbons tombe sur vous. Avancez de 2 cases.',
    },
    {
      id: 40,
      text: 'La Reine des Rongeurs vous envoie un message. Si vous êtes sur une case Glissade, avancez jusqu’à la case 40.',
    },
  ];
}
