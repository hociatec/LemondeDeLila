import { GameCoreService } from '../../../application/services/game-core.service';
import { RandomService } from '../../../application/services/random.service';
import { SetupFlowService } from '../../../application/services/setup-flow.service';
import { DeckPoliciesService } from '../../../application/features/deck-policies/services/deck-policies.service';
import { TurnPoliciesService } from '../../../application/services/turn-policies.service';
import { GameContentLoaderService } from '../../../application/services/game-content-loader.service';
import { BoardPayloadService } from '../../../application/services/board-payload.service';
import { BotRunnerService } from '../../../application/services/bot-runner.service';
import { BotStrategyService } from '../../../application/services/bot-strategy.service';
import { AventureSauvageActionService } from './application/services/aventure-sauvage-action.service';
import { AventureSauvageBotService } from './application/services/aventure-sauvage-bot.service';
import { AventureSauvagePresenterService } from './application/services/aventure-sauvage-presenter.service';
import { AventureSauvageService } from './application/services/aventure-sauvage.service';
import { AventureSauvageSetupService } from './application/services/aventure-sauvage-setup.service';

export function createAventureSauvageRuntime(): {
  service: AventureSauvageService;
  setup: AventureSauvageSetupService;
  actions: AventureSauvageActionService;
} {
  const core = new GameCoreService();
  const random = new RandomService();
  const setupFlow = new SetupFlowService();
  const boardEffects = {
    formatTileLabel(position: number, label: string) {
      const base = `Case ${Number(position) + 1}`;
      const clean = String(label ?? '').trim();
      if (!clean) return base;
      return clean.toLowerCase().startsWith(base.toLowerCase())
        ? clean
        : `${base} - ${clean}`;
    },
    createPlacementLog(params: {
      playerLabel: string;
      pawnLabel: string;
      position: number;
      tileLabel: string;
    }) {
      return `${params.playerLabel} place ${params.pawnLabel} en case ${Number(params.position) + 1} (${params.tileLabel}).`;
    },
    resolveLanding(params: {
      playerId: number;
      tile?: { type?: string; description?: string };
      drawPolicies?: Record<
        string,
        { log?: string; pendingLabel?: string; data?: Record<string, unknown> }
      >;
      finishTypes?: string[];
    }) {
      const logs: string[] = [];
      const description = String(params.tile?.description ?? '').trim();
      if (description) logs.push(description);
      const type = String(params.tile?.type ?? '').trim();
      const finishTypes = Array.isArray(params.finishTypes)
        ? params.finishTypes
        : ['finish'];
      if (finishTypes.includes(type)) {
        return { isFinish: true, logs, pending: null };
      }
      const drawPolicy = params.drawPolicies?.[type];
      if (!drawPolicy) {
        return { isFinish: false, logs, pending: null };
      }
      if (drawPolicy.log) logs.push(drawPolicy.log);
      return {
        isFinish: false,
        logs,
        pending: {
          type: 'draw',
          playerId: params.playerId,
          blocking: true as const,
          label: drawPolicy.pendingLabel ?? 'Piocher une carte.',
          data: drawPolicy.data ?? {},
        },
      };
    },
  };
  const deckPolicies = new DeckPoliciesService(random);
  const turnPolicies = new TurnPoliciesService(core);
  const contentLoader = {
    validators: {
      version: () => () => undefined,
      arrayField: () => () => undefined,
    },
    loadContent: () => ({
      version: 1,
      pawns: [
        { id: 'girafe', name: 'Girafe', description: 'Grande girafe' },
        { id: 'lion', name: 'Lion', description: 'Lion rapide' },
        { id: 'zebre', name: 'Zebre', description: 'Zebre vif' },
        { id: 'singe', name: 'Singe', description: 'Singe agile' },
      ],
    }),
  } as unknown as GameContentLoaderService;
  const boardPayload = new BoardPayloadService();
  const botRunner = new BotRunnerService(new BotStrategyService());
  const setup = new AventureSauvageSetupService(
    core,
    random,
    contentLoader,
    setupFlow,
  );
  const actions = new AventureSauvageActionService(
    core,
    random,
    setupFlow,
    boardEffects,
    deckPolicies,
    turnPolicies,
  );
  const presenter = new AventureSauvagePresenterService(boardPayload);
  const bots = new AventureSauvageBotService(botRunner);

  return {
    service: new AventureSauvageService(setup, actions, presenter, bots),
    setup,
    actions,
  };
}
