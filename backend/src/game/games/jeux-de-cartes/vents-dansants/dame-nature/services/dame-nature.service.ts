import { Injectable } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { GameStateEntity, PlayerStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameSingleActionDto } from '../../../../../engine/dto/game-action.dto';
import { GameRulesAdapter } from '../../../../../engine/interfaces/game-rules-adapter.interface';
import { DeckManagerService } from '../../../../../modules/cards/services/deck-manager.service';
import { TurnService } from '../../../../../modules/turn/services/turn.service';
import { dameNatureLog } from '../../../../../../common/utils/damenature-logger';
import { playingLog } from '../../../../../../common/utils/playing-logger';
import { suggestDameNatureBotActions } from '../bot/dame-nature-bot.strategy';

type FamilyCard = {
  familyId: string;
  familyName: string;
  memberId: string;
  memberName: string;
  role: string;
};

export type DameNatureMetadata = {
  deck: FamilyCard[];
  discards: FamilyCard[];
  familyGoal: number;
  pollution: number;
  maxPollution: number;
  catalog: { families: { id: string; name: string }[] };
};

type PlayerExt = PlayerStateEntity & {
  hand: FamilyCard[];
  handCount: number;
  books: string[];
};

@Injectable()
export class DameNatureService implements GameRulesAdapter {
  readonly gameType = 'dame-nature';
  readonly category = 'JeuxDeCartes';
  readonly subcategory = 'VentsDansants';
  readonly displayName = 'Dame Nature';
  readonly description = 'Jeu de familles coopératif avec pollution et quiz.';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;

  constructor(
    private readonly core: GameCoreService,
    private readonly decks: DeckManagerService,
    private readonly turns: TurnService,
  ) {}

  hydrateInitialState(baseState: GameStateEntity): GameStateEntity {
    const metadata = this.buildMetadata();
    const players = this.initializePlayers(baseState, metadata);
    const initial: GameStateEntity = {
      ...baseState,
      players,
      status: baseState.status ?? 'open',
      turn: {
        currentPlayerId: players[0]?.id ?? null,
        direction: 1 as const,
      },
      turnIndex: players.length ? 0 : -1,
      metadata,
    };
    dameNatureLog('init', {
      status: initial.status,
      turnIndex: initial.turnIndex,
      players: players.map((p) => ({ id: p.id, bot: p.isBot })),
    });
    return initial;
  }

  applyActions(state: GameStateEntity, actions: GameSingleActionDto[]): GameStateEntity {
    let next = this.ensureMetadata(state);
    next = this.ensurePlayersState(next);
    if (!Array.isArray(actions)) {
      return next;
    }
    // Démarrage implicite dès la première action
    if (!this.isStarted(next)) {
      next = { ...next, status: 'started' };
      if (!next.turn || next.turn.currentPlayerId == null) {
        const players = this.ensurePlayers(next);
        next = {
          ...next,
          turnIndex: players.length ? 0 : -1,
          turn: {
            currentPlayerId: players[0]?.id ?? null,
            direction: 1 as const,
          },
        };
      }
      dameNatureLog('start', { turnIndex: next.turnIndex, current: next.turn?.currentPlayerId ?? null });
    }
    for (const action of actions) {
      if (!action?.type) continue;
      // Verrou : seule l'action du joueur courant est acceptée.
      const actorId = this.extractActorId(action);
      if (next.turn?.currentPlayerId != null) {
        const currentId = next.turn.currentPlayerId;
        if (actorId != null && actorId !== currentId) {
          continue;
        }
        const currentIsBot = this.isBotId(currentId, next);
        if (currentIsBot && actorId == null) {
          // On ignore toute action humaine quand c'est le tour du bot.
          continue;
        }
      }
      switch (action.type.toLowerCase()) {
        case 'draw':
          next = this.handleDraw(next);
          break;
        case 'ask_card':
          next = this.handleAskCard(next, action);
          break;
        default:
          next = this.core.appendLog(next, `Action non gérée: ${action.type}`);
      }
    }
    // Si le tour reste sur un bot, marquer l'état comme botThinking pour déclencher le timer côté moteur
    if (next.turn?.currentPlayerId != null && this.isBotId(next.turn.currentPlayerId, next)) {
      next = { ...next, botThinking: true };
      const currentId = next.turn?.currentPlayerId ?? null;
      playingLog('damenature.bot.thinking', { currentPlayerId: currentId, turnIndex: next.turnIndex });
    } else {
      next = { ...next, botThinking: false };
    }
    return next;
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];
    const players = this.ensurePlayers(state);
    return suggestDameNatureBotActions(state, botPlayerId, players, this.families());
  }

  getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    const meta = state.metadata as DameNatureMetadata;
    const deckAvailable = (meta.deck?.length ?? 0) + (meta.discards?.length ?? 0) > 0;
    const actions: GameSingleActionDto[] = [];
    if (deckAvailable) {
      actions.push({ type: 'draw' });
    }
    actions.push({ type: 'ask_card' }); // le client enverra le payload exact
    return actions;
  }

  private handleDraw(state: GameStateEntity): GameStateEntity {
    const meta = state.metadata as DameNatureMetadata;
    const players = this.ensurePlayers(state);
    const currentId = state.turn?.currentPlayerId ?? null;
    const current = currentId != null ? players.find((p) => p.id === currentId) : null;
    if (!current) {
      // Corriger un tour invalide en avançant
      const fixed = this.advanceTurn(state);
      return fixed;
    }
    const { card, metadata } = this.drawCard(meta);
    if (!card) {
      const logged = this.core.appendLog(state, `Pioche vide : ${current.username} passe son tour.`);
      return this.advanceTurn({ ...logged, metadata });
    }
    current.hand.push(card);
    current.handCount = current.hand.length;
    dameNatureLog('draw', { player: current.id, card: `${card.familyId}:${card.memberId}` });
    const nextState: GameStateEntity = {
      ...state,
      players: players,
      metadata,
    };
    let next = this.core.appendLog(
      nextState,
      `${current.username} pioche ${card.familyName} - ${card.memberName}.`,
    );
    next = this.checkBooks(next, current);
    next = this.advanceTurn(next);
    return next;
  }

  private handleAskCard(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    const familyId = action.payload?.familyId;
    const memberId = action.payload?.memberId;
    const targetId = action.payload?.target;
    const players = this.ensurePlayers(state);
    const currentId = state.turn?.currentPlayerId ?? null;
    const current = currentId != null ? players.find((p) => p.id === currentId) : null;
    const target = typeof targetId === 'number' ? players.find((p) => p.id === targetId) : null;
    if (!current || !target || !familyId) {
      return this.core.appendLog(state, `Demande invalide (adversaire ou famille manquants).`);
    }
    const match = target.hand.find((c) => (memberId ? c.memberId === memberId : c.familyId === familyId));
    if (match) {
      target.hand = target.hand.filter((c) => c !== match);
      target.handCount = target.hand.length;
      current.hand.push(match);
      current.handCount = current.hand.length;
      dameNatureLog('ask.success', { from: current.id, target: target.id, familyId, memberId: match.memberId });
      let next: GameStateEntity = { ...state, players };
      next = this.core.appendLog(
        next,
        `${current.username} obtient ${match.memberName} (${match.familyName}) de ${target.username}.`,
      );
      next = this.checkBooks(next, current);
      next = this.advanceTurn(next);
      return next;
    }
    let next = this.core.appendLog(
      state,
      `${current.username} demande ${familyId} à ${target.username} : refus.`,
    );
    dameNatureLog('ask.fail', { from: current.id, target: target.id, familyId, memberId: memberId ?? null });
    next = this.advanceTurn(next);
    return next;
  }

  private checkBooks(state: GameStateEntity, player: PlayerExt): GameStateEntity {
    const families = this.families();
    const toBook: string[] = [];
    for (const fam of families) {
      const members = fam.members.map((m) => m.id);
      const hasAll = members.every((m) => player.hand.some((c) => c.memberId === m));
      if (hasAll && !player.books.includes(fam.id)) {
        toBook.push(fam.id);
      }
    }
    if (!toBook.length) {
      return state;
    }
    player.books.push(...toBook);
    player.hand = player.hand.filter((c) => !toBook.includes(c.familyId));
    player.handCount = player.hand.length;
    return this.core.appendLog(
      state,
      `${player.username} complète ${toBook.length} famille(s): ${toBook.join(', ')}.`,
    );
  }

  private advanceTurn(state: GameStateEntity): GameStateEntity {
    const players = this.ensurePlayers(state);
    if (!players.length) return state;
    const currentId = state.turn?.currentPlayerId ?? null;
    const currentIndex = currentId != null ? players.findIndex((p) => p.id === currentId) : state.turnIndex;
    const next = this.turns.nextTurn(players as any, currentIndex >= 0 ? currentIndex : -1, {});
    const updated: GameStateEntity = {
      ...state,
      turnIndex: next.turnIndex,
      turn: {
        currentPlayerId: next.currentPlayerId,
        direction: 1 as const,
      },
    };
    dameNatureLog('turn', { turnIndex: next.turnIndex, current: next.currentPlayerId });
    return updated;
  }

  private initializePlayers(baseState: GameStateEntity, metadata: DameNatureMetadata): PlayerExt[] {
    const allPlayers: PlayerExt[] = [];
    (baseState.players ?? []).forEach((p) => {
      allPlayers.push({
        id: p.id,
        username: p.username,
        isBot: (p as any).isBot ?? false,
        basket: p.basket ?? [],
        inventory: p.inventory ?? [],
        shoppingList: p.shoppingList ?? [],
        hand: [],
        handCount: 0,
        books: [],
      });
    });
    // distribution initiale (5 cartes)
    for (let i = 0; i < 5; i += 1) {
      for (const player of allPlayers) {
        const draw = this.drawCard(metadata);
        if (!draw.card) break;
        metadata.deck = draw.metadata.deck;
        metadata.discards = draw.metadata.discards;
        player.hand.push(draw.card);
        player.handCount = player.hand.length;
      }
    }
    return allPlayers;
  }

  private ensureMetadata(state: GameStateEntity): GameStateEntity {
    if (state.metadata && (state.metadata as any).deck) {
      return state;
    }
    return { ...state, metadata: this.buildMetadata() };
  }

  /**
   * Garantit que les joueurs incluent les champs requis du moteur et nos extensions Dame Nature.
   */
  private ensurePlayersState(state: GameStateEntity): GameStateEntity {
    const players = this.ensurePlayers(state);
    return { ...state, players };
  }

  private ensurePlayers(state: GameStateEntity): PlayerExt[] {
    const players = state.players ?? [];
    return players.map((p) => {
      const anyPlayer = p as any;
      const hand: FamilyCard[] = Array.isArray(anyPlayer.hand) ? anyPlayer.hand : [];
      const books: string[] = Array.isArray(anyPlayer.books) ? anyPlayer.books : [];
      return {
        id: p.id,
        username: p.username,
        isBot: anyPlayer.isBot ?? false,
        basket: p.basket ?? [],
        inventory: p.inventory ?? [],
        shoppingList: p.shoppingList ?? [],
        hand,
        handCount: anyPlayer.handCount ?? hand.length,
        books,
      };
    });
  }

  private isStarted(state: GameStateEntity): boolean {
    return state.status?.toLowerCase() === 'started';
  }

  private extractActorId(action: GameSingleActionDto): number | null {
    const candidate = (action as any).playerId ?? action.payload?.playerId ?? action.payload?.actorId;
    return typeof candidate === 'number' ? candidate : null;
  }

  private isBotId(id: number, state: GameStateEntity): boolean {
    const players = this.ensurePlayers(state);
    const found = players.find((p) => p.id === id);
    return found?.isBot ?? false;
  }

  private buildMetadata(): DameNatureMetadata {
    const families = this.families();
    const deck: FamilyCard[] = [];
    families.forEach((fam) => {
      fam.members.forEach((m) => {
        deck.push({
          familyId: fam.id,
          familyName: fam.name,
          memberId: m.id,
          memberName: m.name,
          role: m.role,
        });
      });
    });
    return {
      deck: this.decks.shuffle(deck),
      discards: [],
      familyGoal: 4,
      pollution: 0,
      maxPollution: 12,
      catalog: { families: families.map((f) => ({ id: f.id, name: f.name })) },
    };
  }

  private drawCard(meta: DameNatureMetadata): { card: FamilyCard | null; metadata: DameNatureMetadata } {
    if (!meta.deck.length && meta.discards.length) {
      const reshuffled = this.decks.shuffle(meta.discards);
      return this.drawCard({ ...meta, deck: reshuffled, discards: [] });
    }
    if (!meta.deck.length) {
      return { card: null, metadata: meta };
    }
    const [card, ...rest] = meta.deck;
    const metadata: DameNatureMetadata = {
      ...meta,
      deck: rest,
      discards: card ? [...meta.discards, card] : meta.discards,
    };
    return { card: card ?? null, metadata };
  }

  private families() {
    return [
      {
        id: 'arbres',
        name: 'Famille des Arbres',
        members: [
          { id: 'chene', name: 'Chêne', role: 'Parent' },
          { id: 'sapin', name: 'Sapin', role: 'Parent' },
          { id: 'bouleau', name: 'Bouleau', role: 'Enfant' },
          { id: 'erable', name: 'Érable', role: 'Enfant' },
        ],
      },
      {
        id: 'animaux',
        name: 'Famille des Animaux',
        members: [
          { id: 'loup', name: 'Loup', role: 'Parent' },
          { id: 'ours', name: 'Ours', role: 'Parent' },
          { id: 'renard', name: 'Renard', role: 'Enfant' },
          { id: 'biche', name: 'Biche', role: 'Enfant' },
        ],
      },
      {
        id: 'fleurs',
        name: 'Famille des Fleurs',
        members: [
          { id: 'rose', name: 'Rose', role: 'Parent' },
          { id: 'tulipe', name: 'Tulipe', role: 'Parent' },
          { id: 'lys', name: 'Lys', role: 'Enfant' },
          { id: 'violette', name: 'Violette', role: 'Enfant' },
        ],
      },
      {
        id: 'ocean',
        name: 'Famille de l’Océan',
        members: [
          { id: 'baleine', name: 'Baleine', role: 'Parent' },
          { id: 'requin', name: 'Requin', role: 'Parent' },
          { id: 'dauphin', name: 'Dauphin', role: 'Enfant' },
          { id: 'tortue', name: 'Tortue', role: 'Enfant' },
        ],
      },
      {
        id: 'montagne',
        name: 'Famille de la Montagne',
        members: [
          { id: 'chamois', name: 'Chamois', role: 'Parent' },
          { id: 'aigle', name: 'Aigle', role: 'Parent' },
          { id: 'marmotte', name: 'Marmotte', role: 'Enfant' },
          { id: 'bouquetin', name: 'Bouquetin', role: 'Enfant' },
        ],
      },
    ];
  }
}
