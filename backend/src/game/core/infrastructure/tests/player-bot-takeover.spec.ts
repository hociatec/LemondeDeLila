import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { replaceDepartedPlayersWithBots } from '../../application/services/game-player-bot-replacement';
import { GameCommandExecutorService } from '../../application/services/game-command-executor.service';
import { GameExecutionScopeService } from '../../application/services/game-execution-scope.service';
import { GameAutomationPlannerService } from '../../application/services/game-automation-planner.service';
import { BotRunnerService } from '../../application/services/bot-runner.service';
import { GameWsStatePresenter } from '../presentation/ws/state/game-ws-state.presenter';
import { GameVisibilityService } from '../../application/services/game-visibility.service';

it.each([false, true])(
  'continues A fond les ballons after a departure (pawn selection: %s)',
  async (duringSetup) => {
    const definition = discoverGameDefinitions().find(
      (game) => game.id === 'a-fond-les-ballons',
    )!;
    const game = testGame(definition)
      .players(['administrateur', 'Lila'])
      .seed(83);
    await game.start();
    if (!duringSetup) {
      await game.choose(1, 'capitaine-cacahuete');
      await game.choose(2, 'professeur-gribouille');
    }
    const before = game.state();
    const leavingId = before.turn!.currentPlayerId!;
    const remaining = before.players!.find(
      (player) => player.id !== leavingId,
    )!;
    const next = replaceDepartedPlayersWithBots(before, {
      room: {
        status: 'started',
        owner: { id: remaining.id },
        players: [remaining],
        bots: [{ id: 9, name: 'Snorky' }],
      },
    } as never);
    const runtime = new DeclarativeGameRuntime(definition);
    const formerPlayerView = new GameWsStatePresenter(
      new GameVisibilityService(),
    ).present({
      state: next,
      handler: runtime,
      roomId: 1,
      gameType: definition.id,
      version: next.version!,
      viewerPlayerId: leavingId,
    });
    expect(formerPlayerView.viewerPlayerId).toBeNull();
    expect(formerPlayerView.actions).toEqual([]);
    const planner = new GameAutomationPlannerService(new BotRunnerService(), {
      getBotDrawDelayMs: () => 0,
      getBotStartDelayMs: () => 0,
      getBotTurnDelayMs: () => 0,
    } as never);
    const plan = planner.resolve(runtime, next);
    expect(plan?.actions.length).toBeGreaterThan(0);
    expect(plan?.actions[0].meta?.actorId).toBe(leavingId);
    const executor = new GameCommandExecutorService(
      new GameExecutionScopeService(),
    );
    let played = executor.execute({
      handler: runtime,
      state: next,
      actions: plan!.actions,
      actorId: leavingId,
    });
    expect(played.status).not.toBe('finished');
    expect(played).not.toEqual(next);
    expect(played.metadata?.roomRunId).toBe(before.metadata?.roomRunId);
    expect(
      played.players?.find((player) => player.id === leavingId),
    ).toMatchObject({
      username: 'Snorky',
      isBot: true,
      replacementBotPlayerId: -9,
    });
    for (
      let step = 0;
      step < 16 && played.turn?.currentPlayerId === leavingId;
      step++
    ) {
      const continuation = planner.resolve(runtime, played);
      expect(continuation?.actions.length).toBeGreaterThan(0);
      played = executor.execute({
        handler: runtime,
        state: played,
        actions: continuation!.actions,
        actorId: leavingId,
      });
    }
    expect(played.turn?.currentPlayerId).toBe(remaining.id);
    expect(
      runtime.exposeStateForUser(played, remaining.id).actions?.length,
    ).toBeGreaterThan(0);
  },
);
