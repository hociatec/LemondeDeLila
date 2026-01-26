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

export const createLamaServiceForTest = (): { service: LamaService } => {
  const shared = new LamaSharedService();
  const random = new RandomService();
  const round = new LamaRoundService(random);
  const setup = new LamaSetupService(shared, round);
  const draw = new LamaDrawService(shared, round);
  const pass = new LamaPassService(shared, round);
  const play = new LamaPlayService(shared, round);
  const quit = new LamaQuitService(shared, round);
  const ret = new LamaReturnService(shared, round);
  const info = new LamaInfoService(shared);
  const actions = new LamaActionService(shared, draw, pass, play, quit, ret, info, setup);
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
