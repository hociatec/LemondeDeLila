import type { GameStateEntity } from '../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../dto/game-action.dto';
import { BasePresenterService } from './base-presenter.service';

class TestPresenter extends BasePresenterService {
  protected buildCatalog(): { phases: string[]; victory: any } {
    return { phases: ['play'], victory: null };
  }

  protected getAvailableActionsForUser(
    _state: GameStateEntity,
    _userId: number,
  ): GameSingleActionDto[] {
    return [];
  }

  protected buildPendingState(
    state: GameStateEntity,
    _metadata: any,
    _currentPlayerId: number | null,
  ): any {
    return state.pending ?? null;
  }

  protected buildExtras(
    _state: GameStateEntity,
    _metadata: any,
    _currentPlayerId: number | null,
  ): Record<string, unknown> {
    return {};
  }

  exposeForUser(state: GameStateEntity, userId: number) {
    return this.buildExposedStateForUser(state, userId);
  }
}

describe('BasePresenterService', () => {
  const makeState = (pending: any): GameStateEntity =>
    ({
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [{ id: 1, username: 'A' } as any, { id: 2, username: 'B' } as any],
      metadata: {},
      pending,
      log: [],
    }) as any;

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
