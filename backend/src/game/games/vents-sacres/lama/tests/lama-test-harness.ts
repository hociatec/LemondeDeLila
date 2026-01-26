import { LamaService } from '../lama.service';
import { LamaPresenter } from '../lama.presenter';
import { RandomService } from '../../../../modules/random/services/random.service';
import { LamaSharedService } from '../shared/lama-shared.service';
import { LamaRoundService } from '../round/lama-round.service';
import { LamaSetupService } from '../setup/lama-setup.service';
import { LamaDrawService } from '../actions/lama-draw.service';
import { LamaPassService } from '../actions/lama-pass.service';
import { LamaPlayService } from '../actions/lama-play.service';
import { LamaQuitService } from '../actions/lama-quit.service';
import { LamaReturnService } from '../actions/lama-return.service';
import { LamaInfoService } from '../actions/lama-info.service';
import { LamaActionService } from '../actions/lama-action.service';
import { LamaBotService } from '../bots/lama-bot.service';
import { LamaShortcutsService } from '../shortcuts/lama-shortcuts.service';
import { LamaLogService } from '../logging/lama-log.service';

export const createLamaServiceForTest = (): { service: LamaService } => {
  const shared = new LamaSharedService();
  const random = new RandomService();
  const logger = new LamaLogService();
  const round = new LamaRoundService(random, logger);
  const setup = new LamaSetupService(shared, round, logger);
  const draw = new LamaDrawService(shared, round, logger);
  const pass = new LamaPassService(shared, round, logger);
  const play = new LamaPlayService(shared, round, logger);
  const quit = new LamaQuitService(shared, round, logger);
  const ret = new LamaReturnService(shared, round, logger);
  const info = new LamaInfoService(shared, logger);
  const actions = new LamaActionService(shared, draw, pass, play, quit, ret, info, setup, logger);
  const bots = new LamaBotService(shared);
  const shortcuts = new LamaShortcutsService(shared);
  const presenter = new LamaPresenter();
  const service = new LamaService(
    { register: () => {} } as any,
    presenter,
    actions,
    setup,
    bots,
    shortcuts,
  );
  return { service };
};
