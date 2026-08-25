import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../core/application/models/game-action.model';

import { formatPresenterActions } from '../../../../../core/application/helpers/actions-presenter.helper';
import * as Rulebook from '../../rulebook/rulebook';
import { ZIG_ET_ZAG_GAME } from '../../definitions/game.definition';
import type { ZigEtZagMetadata } from '../../model/zig-et-zag-state.model';
import { ZIG_ET_ZAG_CARD_BY_ID } from '../../model/zig-et-zag-cards';
import {
  buildLamaLikePanels,
  summarizeHandCounts,
} from '../../../../../core/application/helpers/lamalike-presenter.helper';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export class ZigEtZagPresenterService {
  exposeStateForUser(
    state: GameStateEntity,
    userId: number,
  ): GameStateWithActions {
    const meta = (state.metadata ?? {}) as ZigEtZagMetadata;
    const deckCounts: Record<number, number> = {};
    const initialDeckCounts = meta.initialDeckCounts ?? {};
    const handCounts = summarizeHandCounts(meta.playerDecks);
    const panels = buildLamaLikePanels({
      hand: [],
      handCounts,
      discardLabel: 'Paquet',
      playMessage: 'Main : (cachée). Espace piocher.',
      tableMessage: `Statut: ${state.status ?? 'en attente'}`,
    });
    Object.entries(meta.playerDecks ?? {}).forEach(([key, cards]) => {
      const pid = Number(key);
      deckCounts[pid] = Array.isArray(cards) ? cards.length : 0;
    });
    const playerList = Array.isArray(state.players) ? state.players : [];
    const deckSummary = playerList
      .map((player) => {
        const pid = Number(player?.id);
        if (!Number.isFinite(pid)) return null;
        const name =
          String(player?.username ?? `Joueur ${pid}`).trim() || `Joueur ${pid}`;
        const current = deckCounts[pid] ?? 0;
        const base = initialDeckCounts[pid] ?? current;
        return `${name}: ${current}/${base}`;
      })
      .filter((line): line is string => Boolean(line));
    panels.decks = {
      title: 'Cartes',
      message: deckSummary.length
        ? deckSummary.join('. ')
        : 'Aucune carte distribuee.',
    };

    const stage = meta.roundState?.stage ?? 'selection';
    const waitingPlayers = meta.roundState?.waitingPlayers ?? [];

    const handRows: string[] = [];

    const actions = Rulebook.getAvailableActions(state, userId);

    return {
      ...state,
      catalog: {
        phases: ZIG_ET_ZAG_GAME.phaseOrder.map((phase) => phase.id),
        victory: null,
      },
      actions: formatPresenterActions(actions, (action) =>
        this.actionLabel(action),
      ),
      extras: {
        hand: handRows,
        stage,
        waitingPlayers,
        deckCounts,
        lastRound: meta.lastRound ?? null,
        ui: { panels },
      },
      pending: state.pending ?? null,
    };
  }

  private actionLabel(action: GameSingleActionDto): string {
    const type = String(action.type ?? '').toLowerCase();
    if (type === 'draw_card') {
      return 'Piocher une carte';
    }
    if (type === 'select_card') {
      const cardId = String(asRecord(action.payload).cardId ?? '').trim();
      const definition = ZIG_ET_ZAG_CARD_BY_ID[cardId];
      return `Jouer ${definition?.name ?? 'une carte'}`;
    }
    return 'Jouer une carte';
  }
}


