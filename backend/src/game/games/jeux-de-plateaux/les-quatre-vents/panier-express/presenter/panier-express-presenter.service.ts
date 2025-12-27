import { Injectable } from '@nestjs/common';
import type {
  GameStateEntity,
  PendingState,
} from '../../../../../core/entities/game-state.entity';
import type {
  GameSingleActionDto,
  GameStateWithActions,
} from '../../../../../engine/dto/game-action.dto';
import type { QuizQuestion } from '../../../../../modules/quiz/services/quiz-runner.service';
import { sanitizeText } from '../../../../../../common/utils/sanitize-text';
import type {
  PanierExpressMetadata,
  PanierExpressTile,
} from '../model/panier-express-state.entity';
import { PANIER_EXPRESS_PHASES } from '../definitions/rules.definition';
import { PANIER_EXPRESS_VICTORY } from '../definitions/victory.definition';
import { BasePresenterService } from '../../../../../engine/abstract/base-presenter.service';

type PanierExpressPlayerView = {
  id: number;
  username: string | null;
  isBot: boolean;
  shoppingList: string[];
  basket: string[];
  inventory: string[];
};

type PanierExpressPlayerSummary = Pick<
  PanierExpressPlayerView,
  'id' | 'username' | 'isBot' | 'shoppingList' | 'basket' | 'inventory'
>;

type PendingQuizPayload = {
  question: string;
  choices: string[];
};

@Injectable()
export class PanierExpressPresenterService extends BasePresenterService {
  // RÃ©fÃ©rence au pending quiz pour le partager entre les mÃ©thodes
  private pendingQuizRef: QuizQuestion | undefined;
  private rawPendingRef: PendingState | null = null;

  exposeState(params: {
    state: GameStateEntity;
    actions: GameSingleActionDto[];
    rawPending: PendingState | null;
    pendingQuiz: QuizQuestion | undefined;
    currentId: number | null;
  }): GameStateWithActions {
    const { state, actions, rawPending, pendingQuiz } = params;

    // Stocker les rÃ©fÃ©rences pour buildPendingState
    this.pendingQuizRef = pendingQuiz;
    this.rawPendingRef = rawPending;

    const meta = this.getMetadata(state) as PanierExpressMetadata;
    const currentId = params.currentId ?? null;

    // IMPORTANT:
    // `BasePresenterService.buildExposedState(...)` utilise toujours `turn.currentPlayerId`
    // pour calculer pending/extras. Pour Panier Express, les vues `shoppingList/basket/inventory`
    // doivent reflÃ©ter l'utilisateur connectÃ© (pas forcÃ©ment le joueur dont c'est le tour,
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
        tiles: Array.isArray(meta.tiles) ? meta.tiles : [],
        positions: meta.positions ?? {},
        laps: meta.laps ?? {},
        turns: this.buildBoardTurns(state, meta),
      },
    } as GameStateWithActions;
  }

  // ============================================================================
  // MÃ©thodes de template (implÃ©mentation de BasePresenterService)
  // ============================================================================

  protected buildCatalog(): { phases: string[]; victory: any } {
    return {
      phases: PANIER_EXPRESS_PHASES.map((p) => p.id),
      victory: PANIER_EXPRESS_VICTORY,
    };
  }

  protected buildPendingState(
    state: GameStateEntity,
    metadata: PanierExpressMetadata,
    currentPlayerId: number | null,
  ): any {
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

    // Ne jamais exposer les listes/panier/inventaire des autres joueurs.
    const sanitizedViews: PanierExpressPlayerView[] =
      typeof currentPlayerId === 'number'
        ? playerViews.map((v) =>
            v.id === currentPlayerId
              ? v
              : { ...v, shoppingList: [], basket: [], inventory: [] },
          )
        : playerViews.map((v) => ({
            ...v,
            shoppingList: [],
            basket: [],
            inventory: [],
          }));

    const players = sanitizedViews.map(
      ({ id, username, isBot, shoppingList, basket, inventory }) => ({
        id,
        username,
        isBot,
        shoppingList,
        basket,
        inventory,
      }),
    );

    return this.buildExtrasView(state, {
      currentId: currentPlayerId,
      playerViews: sanitizedViews,
      players,
    });
  }

  // ============================================================================
  // MÃ©thodes utilitaires privÃ©es
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
        question: quizPayload.question,
        choices: quizPayload.choices,
        playerId: params.currentId,
        blocking: true,
      };
    }
    if (params.rawPending && params.rawPending.type === 'exchange') {
      const exchangePending = params.rawPending as any;
      if (
        typeof params.currentId === 'number' &&
        typeof exchangePending.playerId === 'number' &&
        exchangePending.playerId !== params.currentId
      ) {
        return null;
      }
      if (exchangePending.step === 'choose_target') {
        const targets = Array.isArray(exchangePending.targets)
          ? exchangePending.targets
          : [];
        const choices = targets
          .map((t: any) => sanitizeText(String(t?.targetUsername ?? '')))
          .filter((c: string) => c.length > 0);
        return {
          type: 'exchange',
          playerId: exchangePending.playerId,
          blocking: true,
          question: "Choisir un joueur pour l'échange.",
          choices,
          data: { step: 'choose_target', targets },
        } as any;
      }
      if (exchangePending.step === 'choose_give') {
        const giveChoices = Array.isArray(exchangePending.giveChoices)
          ? exchangePending.giveChoices
          : [];
        const choices = giveChoices
          .map((c: any) => sanitizeText(String(c)))
          .filter((c: string) => c.length > 0);
        const targetUsername = sanitizeText(
          String(exchangePending.targetUsername ?? ''),
        );
        return {
          type: 'exchange',
          playerId: exchangePending.playerId,
          targetPlayerId: exchangePending.targetPlayerId,
          blocking: true,
          question: targetUsername
            ? `Choisir une carte à donner à ${targetUsername}.`
            : 'Choisir une carte à donner.',
          choices,
          data: {
            step: 'choose_give',
            targetPlayerId: exchangePending.targetPlayerId ?? null,
            targetUsername: exchangePending.targetUsername ?? null,
          },
        } as any;
      }
      if (exchangePending.step === 'confirm') {
        const initiator = sanitizeText(
          String(exchangePending.initiatorUsername ?? ''),
        );
        const give = sanitizeText(String(exchangePending.give ?? ''));
        const take =
          exchangePending.take != null
            ? sanitizeText(String(exchangePending.take))
            : '';
        const question = take
          ? `${initiator} vous propose un échange : il vous donne "${give}" et vous lui donnez "${take}". (A = accepter, R = refuser)`
          : `${initiator} vous propose un échange : il vous donne "${give}". (A = accepter, R = refuser)`;
        return {
          type: 'exchange',
          playerId: exchangePending.playerId,
          blocking: true,
          question,
          choices: ['Accepter', 'Refuser'],
          data: { step: 'confirm' },
        } as any;
      }
    }
    if (
      params.rawPending &&
      params.rawPending.type &&
      params.rawPending.type !== 'quiz'
    ) {
      return params.rawPending;
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
      .map((choice) => sanitizeText(String(choice)))
      .filter((choice) => choice.length > 0);
    if (!question && choices.length === 0) {
      return null;
    }
    return { question, choices };
  }

  private buildPlayerViews(state: GameStateEntity): PanierExpressPlayerView[] {
    return (state.players ?? [])
      .map((p) => this.buildPlayerView(p.id, p))
      .filter((view): view is PanierExpressPlayerView => Boolean(view));
  }

  private buildPlayerView(
    playerId: number,
    player: any,
  ): PanierExpressPlayerView | null {
    if (!player || player.id !== playerId) return null;
    return {
      id: player.id,
      username: typeof player.username === 'string' ? player.username : null,
      isBot: player?.isBot === true,
      shoppingList: this.toStringArray(player.shoppingList),
      basket: this.toStringArray(player.basket),
      inventory: this.toStringArray(player.inventory),
    };
  }

  private buildExtrasView(
    state: GameStateEntity,
    params: {
      currentId: number | null;
      playerViews: PanierExpressPlayerView[];
      players: PanierExpressPlayerSummary[];
    },
  ): Record<string, unknown> {
    const baseExtras = this.getBaseExtras(state);
    const currentPlayerView =
      typeof params.currentId === 'number'
        ? (params.playerViews.find((view) => view.id === params.currentId) ??
          null)
        : null;

    const shortcuts: Array<{
      key: string;
      type: string;
      id?: string;
      actionType?: string;
    }> = [
      { key: 'pressed S', type: 'interface', id: 'shopping' },
      { key: 'pressed B', type: 'interface', id: 'basket' },
      { key: 'pressed I', type: 'interface', id: 'inventory' },
      { key: 'pressed P', type: 'interface', id: 'position' },
    ];

    return {
      ...baseExtras,
      currentPlayerView,
      playerViews: params.playerViews,
      players: params.players,
      shortcuts,
    };
  }

  private toStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((v) => (v == null ? '' : String(v)))
        .filter((v) => v.length > 0);
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed
            .map((v) => (v == null ? '' : String(v)))
            .filter((v) => v.length > 0);
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
}
