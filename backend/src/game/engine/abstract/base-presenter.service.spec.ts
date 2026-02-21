import type { GameStateEntity } from '../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../dto/game-action.dto';
import { BasePresenterService } from './base-presenter.service';
import {
  GameStateEntity,
  PendingState,
  PlayerStateEntity,
} from '../../core/entities/game-state.entity';

class TestPresenter extends BasePresenterService {
  protected buildCatalog(): { phases: string[]; victory: unknown } {
    return { phases: ['play'], victory: null };
  }

  protected getAvailableActionsForUser(
    state: GameStateEntity,
    userId: number,
  ): GameSingleActionDto[] {
    return state.turn?.currentPlayerId === userId ? [] : [];
  }

  protected buildPendingState(
    state: GameStateEntity,
    _metadata: Record<string, unknown>,
    _currentPlayerId: number | null,
  ): PendingState | null {
    void _metadata;
    void _currentPlayerId;
    return state.pending ?? null;
  }

  protected buildExtras(
    _state: GameStateEntity,
    _metadata: Record<string, unknown>,
    _currentPlayerId: number | null,
  ): Record<string, unknown> {
    void _state;
    void _metadata;
    void _currentPlayerId;
    return {};
  }

  exposeForUser(state: GameStateEntity, userId: number) {
    return this.buildExposedStateForUser(state, userId);
  }
}

describe('BasePresenterService', () => {
  const makeState = (pending: PendingState | null): GameStateEntity => ({
    status: 'started',
    phase: 'round',
    round: 1,
    turnIndex: 0,
    turn: { currentPlayerId: 1, direction: 1 },
    players: [
      { id: 1, username: 'A' } as PlayerStateEntity,
      { id: 2, username: 'B' } as PlayerStateEntity,
    ],
    metadata: {},
    pending,
    log: [],
    lastRoll: null,
  });

  it('hides targeted pending for other users by default', () => {
    const presenter = new TestPresenter();
    const state = makeState({
      type: 'choose_pawn',
      playerId: 1,
      blocking: true,
      label: 'Choisir un pion',
    });

    const forOwner = presenter.exposeForUser(state, 1);
    const forOther = presenter.exposeForUser(state, 2);

    expect(forOwner.pending).not.toBeNull();
    expect(forOther.pending).toBeNull();
  });

  it('keeps non-targeted pending visible for all users', () => {
    const presenter = new TestPresenter();
    const state = makeState({
      type: 'info',
      blocking: false,
      label: 'Information',
    });

    const forUser1 = presenter.exposeForUser(state, 1);
    const forUser2 = presenter.exposeForUser(state, 2);

    expect(forUser1.pending).not.toBeNull();
    expect(forUser2.pending).not.toBeNull();
  });
});
