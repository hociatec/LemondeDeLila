import { RandomService } from '../../../core/application/services/random.service';
import { LamaActionService } from './application/services/lama-action.service';
import { LamaBotService } from './application/services/lama-bot.service';
import { LamaDrawService } from './application/services/lama-draw.service';
import { LamaInfoService } from './application/services/lama-info.service';
import { LamaLogService } from './application/services/lama-log.service';
import { LamaPassService } from './application/services/lama-pass.service';
import { LamaPlayService } from './application/services/lama-play.service';
import { LamaPresenter } from './application/services/lama.presenter';
import { LamaQuitService } from './application/services/lama-quit.service';
import { LamaReturnService } from './application/services/lama-return.service';
import { LamaRoundService } from './application/services/lama-round.service';
import { LamaService } from './application/services/lama.service';
import { LamaSetupService } from './application/services/lama-setup.service';
import { LamaSharedService } from './application/services/lama-shared.service';
import { LamaShortcutsService } from './application/services/lama-shortcuts.service';

export function createLamaRuntime(
  overrides: {
    random?: RandomService;
  } = {},
): { service: LamaService } {
  const shared = new LamaSharedService();
  const random = overrides.random ?? new RandomService();
  const logger = new LamaLogService();
  const round = new LamaRoundService(random, logger, shared);
  const setup = new LamaSetupService(shared, round, logger);
  const draw = new LamaDrawService(shared, round, logger);
  const pass = new LamaPassService(shared, round, logger);
  const play = new LamaPlayService(shared, round, logger);
  const quit = new LamaQuitService(shared, round, logger);
  const ret = new LamaReturnService(shared, round, logger);
  const info = new LamaInfoService(shared, logger);
  const actions = new LamaActionService(
    shared,
    draw,
    pass,
    play,
    quit,
    ret,
    info,
    setup,
    logger,
  );
  const bots = new LamaBotService(shared);
  const shortcuts = new LamaShortcutsService(shared);
  const presenter = new LamaPresenter();

  return {
    service: new LamaService(presenter, actions, setup, bots, shortcuts),
  };
}
