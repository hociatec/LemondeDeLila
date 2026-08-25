import { GameCoreService } from '../../../core/application/services/game-core.service';
import { RandomService } from '../../../core/application/services/random.service';
import { TurnFlowService } from '../../../core/application/services/turn-flow.service';
import { TurnPoliciesService } from '../../../core/application/services/turn-policies.service';
import { TurnService } from '../../../core/application/services/turn.service';
import { ArcheDeMnemosyneService } from './application/services/arche-de-mnemosyne.service';
import { ArcheMnemoStateService } from './application/services/arche-mnemo-state.service';
import { MnemoQuizStoreService } from './infrastructure/storage/mnemo-quiz-store.service';

export type ArcheDeMnemosyneRuntimeOverrides = {
  core?: GameCoreService;
  turns?: TurnFlowService;
  store?: MnemoQuizStoreService;
  random?: RandomService;
  stateSvc?: ArcheMnemoStateService;
  initializeStore?: boolean;
};

export type ArcheDeMnemosyneRuntime = {
  service: ArcheDeMnemosyneService;
  core: GameCoreService;
  turns: TurnFlowService;
  store: MnemoQuizStoreService;
  random: RandomService;
  stateSvc: ArcheMnemoStateService;
};

export function createArcheDeMnemosyneRuntime(
  overrides: ArcheDeMnemosyneRuntimeOverrides = {},
): ArcheDeMnemosyneRuntime {
  const core = overrides.core ?? new GameCoreService();
  const turns =
    overrides.turns ??
    new TurnFlowService(new TurnService(), new TurnPoliciesService(core));
  const store = overrides.store ?? new MnemoQuizStoreService();
  const random = overrides.random ?? new RandomService();
  const stateSvc = overrides.stateSvc ?? new ArcheMnemoStateService();

  if (overrides.initializeStore !== false && 'onModuleInit' in store) {
    const candidate = store as unknown as { onModuleInit?: () => void };
    candidate.onModuleInit?.();
  }

  return {
    service: new ArcheDeMnemosyneService(core, turns, store, random, stateSvc),
    core,
    turns,
    store,
    random,
    stateSvc,
  };
}
