import { Injectable, OnModuleInit } from '@nestjs/common';
import { GameCoreService } from '../../../../../core/services/game-core.service';
import { GameStateEntity, PlayerStateEntity } from '../../../../../core/entities/game-state.entity';
import { GameSingleActionDto, GameStateWithActions } from '../../../../../engine/dto/game-action.dto';
import { GameRulesAdapter } from '../../../../../engine/interfaces/game-rules-adapter.interface';
import { GameRegistryService } from '../../../../../engine/services/game-registry.service';
import { DeckManagerService } from '../../../../../modules/cards/services/deck-manager.service';
import { DeckPoolService, DeckPoolState } from '../../../../../modules/cards/services/deck-pool.service';
import { TurnService } from '../../../../../modules/turn/services/turn.service';
import { ActionResolverService } from '../../../../../modules/action-resolver/services/action-resolver.service';
import { ActionLogService, ActionLogEntry } from '../../../../../modules/actionlog/services/action-log.service';
import { PhaseEngineService, PhaseDefinition } from '../../../../../modules/state/services/phase-engine.service';
import { BotRunnerService } from '../../../../../modules/bot/services/bot-runner.service';
import { VictoryService } from '../../../../../modules/victory/services/victory.service';
import { dameNatureLog } from '../../../../../../common/utils/damenature-logger';
import { DAME_NATURE_PHASES } from '../definitions/rules.definition';
import { DAME_NATURE_VICTORY } from '../definitions/victory.definition';
import { playingLog } from '../../../../../../common/utils/playing-logger';

type FamilyCard = {
  familyId: string;
  familyName: string;
  memberId: string;
  memberName: string;
  role: string;
};

export type DameNatureMetadata = {
  decks: DeckPoolState<FamilyCard>;
  familyGoal: number;
  pollution: number;
  maxPollution: number;
  catalog: { families: { id: string; name: string }[] };
  actionLog: ActionLogEntry[];
  phaseId?: string;
  botProfile?: import('../../../../../modules/bot/services/bot-strategy.service').BotProfile;
  victoryId?: string | null;
  winnerId?: string | number | null;
};

type PlayerExt = PlayerStateEntity & {
  hand: FamilyCard[];
  handCount: number;
  books: string[];
};

@Injectable()
export class DameNatureService implements GameRulesAdapter, OnModuleInit {
  readonly gameType = 'dame-nature';
  readonly category = 'JeuxDeCartes';
  readonly subcategory = 'VentsDansants';
  readonly displayName = 'Dame Nature';
  readonly description = 'Jeu de familles coopératif avec pollution et quiz.';
  readonly minPlayers = 2;
  readonly maxPlayers = 6;
  private readonly phaseOrder: PhaseDefinition<DameNatureMetadata>[] = DAME_NATURE_PHASES;

  constructor(
    private readonly core: GameCoreService,
    private readonly decks: DeckManagerService,
    private readonly deckPool: DeckPoolService,
    private readonly turns: TurnService,
    private readonly resolver: ActionResolverService,
    private readonly actionLog: ActionLogService,
    private readonly phases: PhaseEngineService<DameNatureMetadata>,
    private readonly botRunner: BotRunnerService,
    private readonly victory: VictoryService,
    private readonly registry: GameRegistryService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

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
    next = this.resolver.apply(next, actions, (s, a) => this.dispatchAction(s, a));
    next = this.applyVictory(next);
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

  private dispatchAction(state: GameStateEntity, action: GameSingleActionDto): GameStateEntity {
    if (!action?.type) return state;

    let next = this.ensureStarted(state);
    // Verrou : seule l'action du joueur courant est acceptée.
    const actorId = this.extractActorId(action);
    if (next.turn?.currentPlayerId != null) {
      const currentId = next.turn.currentPlayerId;
      if (actorId != null && actorId !== currentId) {
        return next;
      }
      const currentIsBot = this.isBotId(currentId, next);
      if (currentIsBot && actorId == null) {
        // On ignore toute action humaine quand c'est le tour du bot.
        return next;
      }
    }

    switch (action.type.toLowerCase()) {
      case 'draw':
        next = this.handleDraw(next);
        next = this.appendAction(next, { actorId, type: 'draw' });
        break;
      case 'ask_card':
        next = this.handleAskCard(next, action);
        next = this.appendAction(next, { actorId, type: 'ask_card', payload: action.payload });
        break;
      default:
        next = this.core.appendLog(next, `Action non gérée: ${action.type}`);
    }
    return this.advancePhase(next);
  }

  getBotActions(state: GameStateEntity, botPlayerId: number): GameSingleActionDto[] {
    const current = state.turn?.currentPlayerId ?? null;
    if (current !== botPlayerId) return [];
    const profile = (state.metadata as DameNatureMetadata)?.botProfile ?? 'greedy';
    const players = this.ensurePlayers(state);
    const me = players.find((p) => p.id === botPlayerId);
    const others = players.filter((p) => p.id !== botPlayerId);
    const families = this.families();
    const meta = state.metadata as DameNatureMetadata;
    const recentRequests = new Set<string>(
      (meta.actionLog ?? [])
        .filter((e) => e.actorId === botPlayerId && e.type === 'ask_card')
        .slice(-5)
        .map((e) => {
          const fam = e.payload?.familyId ?? '';
          const member = e.payload?.memberId ?? '';
          const target = e.payload?.target ?? e.payload?.targetId ?? '';
          return `${fam}:${member}:${target}`;
        }),
    );

    // Si main vide ou personne en face : pioche
    if (!me || !me.hand.length || !others.length) {
      return this.botRunner.choose([{ type: 'draw' }], { state, playerId: botPlayerId }, profile, {
        preferTypes: ['draw'],
      });
    }

    // Choix de famille où le bot a le plus de cartes non bookées
    const familyCounts: Record<string, { count: number; cards: FamilyCard[] }> = {};
    me.hand.forEach((c) => {
      if (!familyCounts[c.familyId]) familyCounts[c.familyId] = { count: 0, cards: [] };
      familyCounts[c.familyId].count += 1;
      familyCounts[c.familyId].cards.push(c);
    });
    const candidateFamilies = Object.entries(familyCounts)
      .filter(([fid]) => !(me.books ?? []).includes(fid))
      .sort((a, b) => b[1].count - a[1].count);
    const picked = candidateFamilies[0];

    const familyCatalog = picked ? families.find((f) => f.id === picked[0]) : null;
    const owned = new Set(picked?.[1].cards.map((c) => c.memberId) ?? []);
    const missing = familyCatalog ? familyCatalog.members.filter((m) => !owned.has(m.id)) : [];
    const memberId = missing.length
      ? missing[Math.floor(Math.random() * missing.length)].id
      : picked?.[1].cards[0]?.memberId;
    // Choix du joueur avec le plus de cartes pour maximiser les chances
    const sortedOthers = [...others].sort((a, b) => (b.handCount ?? 0) - (a.handCount ?? 0));
    const target = sortedOthers[0] ?? null;

    const actions: GameSingleActionDto[] = [];
    if (memberId != null && target != null) {
      const key = `${picked?.[0] ?? ''}:${memberId}:${target.id}`;
      if (!recentRequests.has(key)) {
        actions.push({
          type: 'ask_card',
          payload: { familyId: picked?.[0] ?? families[0].id, memberId, target: target.id, playerId: botPlayerId },
        });
      }
    }
    actions.push({ type: 'draw', payload: { playerId: botPlayerId } });

    return this.botRunner.choose(actions, { state, playerId: botPlayerId }, profile, {
      preferTypes: ['ask_card', 'draw'],
      fallbackTypes: ['draw'],
      score: (action) => {
        if (action.type === 'ask_card') return 5;
        // Piocher devient prioritaire si peu de cartes ou aucune famille majoritaire
        if (action.type === 'draw') {
          const maxFamilyCount = picked != null ? picked[1].count : 0;
          return maxFamilyCount < 2 ? 6 : 3;
        }
        return 0;
      },
    });
  }

  getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
    const meta = state.metadata as DameNatureMetadata;
    const familyDeck = meta.decks?.family ?? { deck: [], discards: [] };
    const deckAvailable = (familyDeck.deck?.length ?? 0) + (familyDeck.discards?.length ?? 0) > 0;
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
    return this.appendAction(next, { actorId: current.id, type: 'draw', payload: { cardId: card.memberId } });
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
      return this.appendAction(
        this.core.appendLog(state, `Demande invalide (adversaire ou famille manquants).`),
        { actorId: currentId ?? null, type: 'ask_card_invalid', payload: action.payload },
      );
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
      this.appendAction(state, { actorId: player.id, type: 'book', payload: { families: toBook } }),
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
    return this.advancePhase(updated);
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
        metadata.decks = draw.metadata.decks;
        player.hand.push(draw.card);
        player.handCount = player.hand.length;
      }
    }
    return allPlayers;
  }

  private ensureMetadata(state: GameStateEntity): GameStateEntity {
    const base = this.buildMetadata();
    const meta = (state.metadata as DameNatureMetadata | undefined) ?? base;
    return {
      ...state,
      metadata: {
        ...base,
        ...meta,
        actionLog: meta.actionLog ?? [],
      catalog: meta.catalog ?? base.catalog,
      decks: meta.decks ?? base.decks,
      phaseId: meta.phaseId ?? 'turn',
      botProfile: meta.botProfile ?? 'greedy',
        victoryId: meta.victoryId ?? null,
        winnerId: meta.winnerId ?? null,
      },
    };
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

  private ensureStarted(state: GameStateEntity): GameStateEntity {
    if (this.isStarted(state)) return state;
    if ((state.status || '').toLowerCase() !== 'starting') return state;
    const players = this.ensurePlayers(state);
    if (players.length < this.minPlayers) return { ...state, players };
    const next: GameStateEntity = {
      ...state,
      players,
      status: 'started',
      turnIndex: players.length ? 0 : -1,
      turn: {
        currentPlayerId: players[0]?.id ?? null,
        direction: 1 as const,
      },
    };
    dameNatureLog('start', { turnIndex: next.turnIndex, current: next.turn?.currentPlayerId ?? null });
    return this.advancePhase(next);
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
      decks: this.deckPool.set<FamilyCard>({}, 'family', this.deckPool.shuffle(deck)),
      familyGoal: 4,
      pollution: 0,
      maxPollution: 12,
      catalog: { families: families.map((f) => ({ id: f.id, name: f.name })) },
      actionLog: [],
      phaseId: 'turn',
      victoryId: null,
      winnerId: null,
    };
  }

  private drawCard(meta: DameNatureMetadata): { card: FamilyCard | null; metadata: DameNatureMetadata } {
    const { card, pool } = this.deckPool.draw<FamilyCard>(meta.decks, 'family');
    const metadata: DameNatureMetadata = { ...meta, decks: pool };
    return { card: card ?? null, metadata };
  }

  private appendAction(state: GameStateEntity, entry: Omit<ActionLogEntry, 'timestamp'>): GameStateEntity {
    const meta = (state.metadata as DameNatureMetadata) ?? this.buildMetadata();
    const actionLog = this.actionLog.append(meta.actionLog, entry);
    return { ...state, metadata: { ...meta, actionLog } };
  }

  exposeState(state: GameStateEntity): GameStateWithActions {
    const currentId = state.turn?.currentPlayerId ?? null;
    const actions = typeof currentId === 'number' ? this.getAvailableActions(state, currentId) : [];
    return {
      ...(state as any),
      catalog: {
        phases: DAME_NATURE_PHASES.map((p) => p.id),
        victory: DAME_NATURE_VICTORY,
      },
      actions: actions.map((a) => ({ type: a.type, label: a.type, payload: a.payload ?? {} })),
      pending: null,
    };
  }

  private advancePhase(state: GameStateEntity): GameStateEntity {
    const meta = (state.metadata as DameNatureMetadata) ?? this.buildMetadata();
    const current = meta.phaseId ?? 'turn';
    const result = this.phases.advance(state, meta, this.phaseOrder, current);
    const nextMeta: DameNatureMetadata = {
      ...(result.state.metadata as DameNatureMetadata),
      phaseId: result.phaseId,
    };
    return this.applyVictory({ ...result.state, metadata: nextMeta });
  }

  private applyPollution(state: GameStateEntity, meta: DameNatureMetadata): GameStateEntity {
    if (meta.pollution >= meta.maxPollution) {
      return { ...state, status: 'finished' };
    }
    return state;
  }

  private applyVictory(state: GameStateEntity): GameStateEntity {
    if ((state.status || '').toLowerCase() === 'finished') return state;
    const result = this.victory.evaluate(state, DAME_NATURE_VICTORY);
    if (!result || !result.finished) {
      return state;
    }
    const meta = (state.metadata as DameNatureMetadata) ?? this.buildMetadata();
    const nextMeta: DameNatureMetadata = {
      ...meta,
      victoryId: result.conditionId,
      winnerId: result.winnerId ?? null,
    };
    const next: GameStateEntity = {
      ...state,
      metadata: nextMeta,
      status: 'finished',
      turn: { currentPlayerId: null, direction: 1 as const },
    };
    const message =
      result.conditionId === 'books-goal'
        ? `Objectif atteint : ${meta.familyGoal} familles complétées.`
        : 'Pollution maximale atteinte.';
    return this.core.appendLog(next, message);
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
