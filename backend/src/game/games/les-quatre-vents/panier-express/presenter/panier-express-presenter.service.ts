import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../engine/dto/game-action.dto';
import type { QuizQuestion } from '../../../../modules/quiz/services/quiz-runner.service';
import { sanitizeText } from '../../../../../common/utils/sanitize-text';
import type { PanierExpressMetadata } from '../model/panier-express-state.entity';
import { PanierExpressUtils } from '../model/panier-express-utils.service';
import { PANIER_EXPRESS_PHASES } from '../definitions/rules.definition';
import { PANIER_EXPRESS_VICTORY } from '../definitions/victory.definition';
import { BasePresenterService } from '../../../../engine/abstract/base-presenter.service';
import { BoardPayloadService } from '../../../../modules/board/services/board-payload.service';

type PanierExpressPlayerView = {
  id: number;
  username: string | null;
  isBot: boolean;
  pawn: string | null;
  shoppingList: string[];
  basket: string[];
  inventory: string[];
};

type PanierExpressPlayerSummary = Pick<
  PanierExpressPlayerView,
  'id' | 'username' | 'isBot' | 'pawn' | 'shoppingList' | 'basket' | 'inventory'
>;

type PendingQuizPayload = {
  question: string;
  choices: string[];
};

type PanierPlayerLike = {
  id: number;
  username?: string;
  isBot?: boolean;
  pawn?: string;
  shoppingList?: unknown;
  basket?: unknown;
  inventory?: unknown;
};

@Injectable()
export class PanierExpressPresenterService extends BasePresenterService {
  // Référence au pending quiz pour le partager entre les méthodes
  private pendingQuizRef: QuizQuestion | undefined;
  private rawPendingRef: PendingState | null = null;

  constructor(
    private readonly utils: PanierExpressUtils,
    private readonly boardPayload: BoardPayloadService,
  ) {
    super();
  }

  exposeState(params: {
    state: GameStateEntity;
    actions: GameSingleActionDto[];
    rawPending: PendingState | null;
    pendingQuiz: QuizQuestion | undefined;
    currentId: number | null;
  }): GameStateWithActions {
    const { state, actions, rawPending, pendingQuiz } = params;

    // Stocker les références pour buildPendingState
    this.pendingQuizRef = pendingQuiz;
    this.rawPendingRef = rawPending;

    const meta = this.getPanierMeta(state);
    const currentId = params.currentId ?? null;

    // IMPORTANT:
    // `BasePresenterService.buildExposedState(...)` utilise toujours `turn.currentPlayerId`
    // pour calculer pending/extras. Pour Panier Express, les vues `shoppingList/basket/inventory`
    // doivent refléter l'utilisateur connecté (pas forcément le joueur dont c'est le tour,
    // par exemple quand un bot joue).
    const pending = this.buildPendingState(state, meta, currentId);
    const extras = this.buildExtras(state, meta, currentId);
    const catalog = this.buildCatalog();

    return {
      ...state,
      catalog,
      actions: this.formatActions(Array.isArray(actions) ? actions : []),
      pending,
      extras,
      board: {
        ...this.boardPayload.buildTilesPositionsLaps(
          meta.tiles,
          meta.positions,
          meta.laps,
        ),
        turns: this.buildBoardTurns(state, meta),
      },
    } as GameStateWithActions;
  }

  // ============================================================================
  // Méthodes de template (implémentation de BasePresenterService)
  // ============================================================================

  protected buildCatalog(): { phases: string[]; victory: unknown } {
    return {
      phases: PANIER_EXPRESS_PHASES.map((p) => p.id),
      victory: PANIER_EXPRESS_VICTORY,
    };
  }

  protected buildPendingState(
    _state: GameStateEntity,
    _metadata: PanierExpressMetadata,
    currentPlayerId: number | null,
  ): PendingState | null {
    return this.buildPendingView({
      rawPending: this.rawPendingRef,
      pendingQuiz: this.pendingQuizRef,
      currentId: currentPlayerId,
    });
  }

  protected buildExtras(
    state: GameStateEntity,
    metadata: PanierExpressMetadata,
    currentPlayerId: number | null,
  ): Record<string, unknown> {
    const playerViews = this.buildPlayerViews(state);
    const reveal = toNumberMap(metadata?.statuses?.revealInventory);

    // Ne jamais exposer les listes/panier/inventaire des autres joueurs.
    const sanitizedViews: PanierExpressPlayerView[] =
      typeof currentPlayerId === 'number'
        ? playerViews.map((v) =>
            v.id === currentPlayerId
              ? v
              : {
                  ...v,
                  shoppingList: v.shoppingList,
                  basket: [],
                  inventory: reveal[v.id] > 0 ? v.inventory : [],
                },
          )
        : playerViews.map((v) => ({
            ...v,
            shoppingList: v.shoppingList,
            basket: [],
            inventory: reveal[v.id] > 0 ? v.inventory : [],
          }));

    const players = sanitizedViews.map(
      ({ id, username, isBot, pawn, shoppingList, basket, inventory }) => ({
        id,
        username,
        isBot,
        pawn,
        shoppingList,
        basket,
        inventory,
      }),
    );

    return this.buildExtrasView(state, {
      currentId: currentPlayerId,
      playerViews: sanitizedViews,
      players,
      revealInventory: reveal,
      fullPlayerViews: playerViews,
    });
  }

  // ============================================================================
  // Méthodes utilitaires privées
  // ============================================================================

  private buildBoardTurns(
    state: GameStateEntity,
    meta: PanierExpressMetadata,
  ): Record<number, number> {
    const turns: Record<number, number> = {};
    (state.players ?? []).forEach((p) => {
      const completed =
        typeof meta.laps?.[p.id] === 'number' ? meta.laps[p.id] : 0;
      turns[p.id] = Math.max(0, completed + 1);
    });
    return turns;
  }

  private buildPendingView(params: {
    rawPending: PendingState | null;
    pendingQuiz: QuizQuestion | undefined;
    currentId: number | null;
  }): PendingState | null {
    const quizPayload = this.normalizeQuizPending(params.pendingQuiz);
    if (quizPayload) {
      return {
        type: 'quiz',
        label: 'Réponses possibles',
        question: quizPayload.question,
        choices: quizPayload.choices,
        playerId: params.currentId,
        blocking: true,
      };
    }
    if (params.rawPending && params.rawPending.type === 'exchange') {
      const exchangePending = asRecord(params.rawPending);
      const exchangePlayerId = toNumber(exchangePending.playerId);
      if (
        typeof params.currentId === 'number' &&
        exchangePlayerId != null &&
        exchangePlayerId !== params.currentId
      ) {
        return null;
      }
      if (toText(exchangePending.step) === 'choose_target') {
        const targets = toExchangeTargetArray(exchangePending.targets);
        const choices = targets
          .map((t) => sanitizeText(t.targetUsername))
          .filter((c) => c.length > 0);
        return {
          type: 'exchange',
          playerId: exchangePlayerId,
          blocking: true,
          question: "Choisir un joueur pour l'échange.",
          choices,
          data: { step: 'choose_target', targets },
        };
      }
      if (toText(exchangePending.step) === 'choose_give') {
        const giveChoices = toUnknownArray(exchangePending.giveChoices);
        const choices = giveChoices
          .map((c) => this.utils.formatCourseLabel(sanitizeText(toText(c))))
          .filter((c) => c.length > 0);
        const targetUsername = sanitizeText(
          toText(exchangePending.targetUsername),
        );
        return {
          type: 'exchange',
          playerId: exchangePlayerId,
          targetPlayerId: toNumber(exchangePending.targetPlayerId),
          blocking: true,
          question: targetUsername
            ? `Choisir une carte à donner à ${targetUsername}.`
            : 'Choisir une carte à donner.',
          choices,
          data: {
            step: 'choose_give',
            targetPlayerId: toNumber(exchangePending.targetPlayerId),
            targetUsername: toText(exchangePending.targetUsername) || null,
          },
        };
      }
      if (toText(exchangePending.step) === 'confirm') {
        const initiator = sanitizeText(
          toText(exchangePending.initiatorUsername),
        );
        const give = this.utils.formatCourseLabel(
          sanitizeText(toText(exchangePending.give)),
        );
        const take =
          exchangePending.take != null
            ? this.utils.formatCourseLabel(
                sanitizeText(toText(exchangePending.take)),
              )
            : '';
        const question = take
          ? `${initiator} vous propose un échange : il vous donne "${give}" et vous lui donnez "${take}". (A = accepter, R = refuser)`
          : `${initiator} vous propose un échange : il vous donne "${give}". (A = accepter, R = refuser)`;
        return {
          type: 'exchange',
          playerId: exchangePlayerId,
          blocking: true,
          question,
          choices: ['Accepter', 'Refuser'],
          data: { step: 'confirm' },
        };
      }
    }
    if (
      params.rawPending &&
      params.rawPending.type &&
      params.rawPending.type !== 'quiz'
    ) {
      const pendingRecord = asRecord(params.rawPending);
      const rawChoices = Array.isArray(pendingRecord.choices)
        ? pendingRecord.choices
        : null;
      if (!rawChoices) {
        return params.rawPending;
      }
      return {
        ...params.rawPending,
        choices: rawChoices
          .map((c) => this.utils.formatCourseLabel(sanitizeText(toText(c))))
          .filter((c) => c.length > 0),
      };
    }
    return null;
  }

  private normalizeQuizPending(
    pendingQuiz: QuizQuestion | undefined,
  ): PendingQuizPayload | null {
    if (!pendingQuiz) {
      return null;
    }
    const question = sanitizeText(pendingQuiz.question ?? '');
    const rawChoices =
      Array.isArray(pendingQuiz.choices) && pendingQuiz.choices.length
        ? pendingQuiz.choices
        : pendingQuiz.answer
          ? [pendingQuiz.answer]
          : [];
    const choices = rawChoices
      .map((choice) =>
        this.utils.formatCourseLabel(sanitizeText(String(choice))),
      )
      .filter((choice) => choice.length > 0);
    if (!question && choices.length === 0) {
      return null;
    }
    return { question, choices };
  }

  private buildPlayerViews(state: GameStateEntity): PanierExpressPlayerView[] {
    return (state.players ?? [])
      .map((p) => toPanierPlayerLike(p))
      .filter((p): p is PanierPlayerLike => p != null)
      .map((p) => this.buildPlayerView(p))
      .filter((view): view is PanierExpressPlayerView => Boolean(view));
  }

  private buildPlayerView(player: PanierPlayerLike): PanierExpressPlayerView {
    return {
      id: player.id,
      username: typeof player.username === 'string' ? player.username : null,
      isBot: player.isBot === true,
      pawn: typeof player.pawn === 'string' ? player.pawn : null,
      shoppingList: this.utils.formatCourseLabels(
        this.toStringArray(player.shoppingList),
      ),
      basket: this.utils.formatCourseLabels(this.toStringArray(player.basket)),
      inventory: this.utils.formatCourseLabels(
        this.toStringArray(player.inventory),
      ),
    };
  }

  private buildExtrasView(
    state: GameStateEntity,
    params: {
      currentId: number | null;
      playerViews: PanierExpressPlayerView[];
      players: PanierExpressPlayerSummary[];
      revealInventory: Record<number, number>;
      fullPlayerViews: PanierExpressPlayerView[];
    },
  ): Record<string, unknown> {
    const baseExtras = this.getBaseExtras(state);
    const currentPlayerView =
      typeof params.currentId === 'number'
        ? (params.playerViews.find((view) => view.id === params.currentId) ??
          null)
        : null;

    const listMessage = (title: string, items: string[] | null | undefined) => {
      const values = Array.isArray(items)
        ? items.map((x) => String(x ?? '').trim()).filter((x) => x.length > 0)
        : [];
      if (values.length === 0) return `${title}: (vide)`;
      const max = 12;
      const shown = values.length > max ? values.slice(0, max) : values;
      const body = shown.join(', ');
      return values.length > max
        ? `${title}: ${body}, ... (+${values.length - max})`
        : `${title}: ${body}`;
    };

    const shoppingAllMessage = () => {
      if (
        !Array.isArray(params.playerViews) ||
        params.playerViews.length === 0
      ) {
        return 'Listes de courses: (aucun joueur).';
      }

      const max = 12;
      const lines = params.fullPlayerViews.map((p) => {
        const name =
          typeof p.username === 'string' && p.username.trim().length > 0
            ? p.username.trim()
            : `Joueur ${p.id}`;
        const items = Array.isArray(p.shoppingList) ? p.shoppingList : [];
        if (items.length === 0) {
          return `${name} : liste (vide)`;
        }
        const shown = items.length > max ? items.slice(0, max) : items;
        const body = shown.join(', ');
        return items.length > max
          ? `${name} : liste ${body}, ... (+${items.length - max})`
          : `${name} : liste ${body}`;
      });

      return lines.join('\n');
    };

    const inventoryAllMessage = () => {
      const currentId =
        typeof params.currentId === 'number' ? params.currentId : null;
      if (
        !Array.isArray(params.playerViews) ||
        params.playerViews.length === 0
      ) {
        return 'Inventaires: (aucun joueur).';
      }

      const max = 12;
      const lines = params.playerViews.map((p) => {
        const name =
          typeof p.username === 'string' && p.username.trim().length > 0
            ? p.username.trim()
            : `Joueur ${p.id}`;
        const canSee =
          currentId != null
            ? p.id === currentId || params.revealInventory[p.id] > 0
            : params.revealInventory[p.id] > 0;

        if (!canSee) {
          return `${name} : inventaire (caché)`;
        }
        const items = Array.isArray(p.inventory) ? p.inventory : [];
        if (items.length === 0) {
          return `${name} : inventaire (vide)`;
        }
        const shown = items.length > max ? items.slice(0, max) : items;
        const body = shown.join(', ');
        return items.length > max
          ? `${name} : inventaire ${body}, ... (+${items.length - max})`
          : `${name} : inventaire ${body}`;
      });

      return lines.join('\n');
    };

    const scoreMessage = () => {
      const views =
        Array.isArray(params.fullPlayerViews) && params.fullPlayerViews.length
          ? params.fullPlayerViews
          : params.playerViews;
      if (!Array.isArray(views) || views.length === 0) {
        return 'Scores: (aucun joueur).';
      }
      const lines = views.map((p) => {
        const name =
          typeof p.username === 'string' && p.username.trim().length > 0
            ? p.username.trim()
            : `Joueur ${p.id}`;
        const list = Array.isArray(p.shoppingList) ? p.shoppingList : [];
        const basket = Array.isArray(p.basket) ? p.basket : [];
        const total = list.length;
        const done =
          total > 0 ? basket.filter((item) => list.includes(item)).length : 0;
        return `${name} : ${done}/${total}`;
      });
      return lines.join('\n');
    };

    const meta = this.getPanierMeta(state);
    const positionMessage = this.buildPositionPanelMessage(
      meta,
      params.playerViews,
    );
    const quizFeedbackMessage = this.buildQuizFeedbackMessage(
      meta,
      params.currentId,
    );

    const panels: Record<string, { title: string; message: string }> = {
      shopping: {
        title: 'Shopping list',
        message: listMessage('Shopping list', currentPlayerView?.shoppingList),
      },
      shopping_all: {
        title: 'Shopping list (tous)',
        message: shoppingAllMessage(),
      },
      basket: {
        title: 'Panier',
        message: listMessage('Panier', currentPlayerView?.basket),
      },
      inventory: {
        title: 'Inventaire',
        message: listMessage('Inventaire', currentPlayerView?.inventory),
      },
      inventory_all: {
        title: 'Inventaires (tous)',
        message: inventoryAllMessage(),
      },
      score: {
        title: 'Score',
        message: scoreMessage(),
      },
      position: {
        title: 'Position',
        message: positionMessage,
      },
    };
    if (quizFeedbackMessage) {
      panels.quiz_feedback = {
        title: 'Quiz',
        message: quizFeedbackMessage,
      };
    }

    return {
      ...baseExtras,
      currentPlayerView,
      playerViews: params.playerViews,
      players: params.players,
      ui: {
        panels,
      },
    };
  }

  private buildQuizFeedbackMessage(
    meta: PanierExpressMetadata,
    playerId: number | null,
  ): string | null {
    if (typeof playerId !== 'number') {
      return null;
    }
    return meta.quizOutcome?.[playerId]?.message ?? null;
  }

  private buildPositionPanelMessage(
    meta: PanierExpressMetadata,
    playerViews: PanierExpressPlayerView[],
  ): string {
    if (!playerViews.length) {
      return 'Position: (aucun joueur).';
    }
    const totalTiles = Array.isArray(meta.tiles) ? meta.tiles.length : 0;
    const lines = playerViews.map((view) => {
      const name =
        typeof view.username === 'string' && view.username.trim().length > 0
          ? view.username.trim()
          : `Joueur ${view.id}`;
      const pos = meta.positions?.[view.id];
      const lap = meta.laps?.[view.id];
      const caseNumber =
        typeof pos === 'number' && Number.isFinite(pos)
          ? Math.max(1, Math.trunc(pos) + 1)
          : null;
      const lapText =
        typeof lap === 'number' && Number.isFinite(lap)
          ? `tour plateau ${Math.trunc(lap)}`
          : 'tour plateau ?';
      const caseText = caseNumber
        ? totalTiles
          ? `case ${caseNumber}/${totalTiles}`
          : `case ${caseNumber}`
        : 'case (inconnue)';
      return `${name} : ${lapText}, ${caseText}.`;
    });
    return lines.join('\n');
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((v) => toText(v)).filter((v) => v.length > 0);
    }
    if (typeof value === 'string') {
      try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => toText(v)).filter((v) => v.length > 0);
        }
      } catch {
        /* ignore */
      }
      return value
        .split(/[,;]+/)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
    return [];
  }

  private getPanierMeta(state: GameStateEntity): PanierExpressMetadata {
    return (this.getMetadata(state) ?? {}) as PanierExpressMetadata;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== 'object') return {};
  return value as Record<string, unknown>;
}

function toUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}

function toNumberMap(value: unknown): Record<number, number> {
  const source = asRecord(value);
  const out: Record<number, number> = {};
  for (const [key, raw] of Object.entries(source)) {
    const id = toNumber(key);
    const amount = toNumber(raw);
    if (id == null || amount == null) continue;
    out[id] = amount;
  }
  return out;
}

function toExchangeTargetArray(
  value: unknown,
): Array<{ targetPlayerId: number; targetUsername: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .map((record) => ({
      targetPlayerId: toNumber(record.targetPlayerId),
      targetUsername: sanitizeText(toText(record.targetUsername)),
    }))
    .filter(
      (entry): entry is { targetPlayerId: number; targetUsername: string } =>
        entry.targetPlayerId != null,
    );
}

function toPanierPlayerLike(value: unknown): PanierPlayerLike | null {
  const record = asRecord(value);
  const id = toNumber(record.id);
  if (id == null) return null;
  return {
    id,
    username: typeof record.username === 'string' ? record.username : undefined,
    isBot: record.isBot === true,
    pawn: typeof record.pawn === 'string' ? record.pawn : undefined,
    shoppingList: record.shoppingList,
    basket: record.basket,
    inventory: record.inventory,
  };
}
