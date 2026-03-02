"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "createLamaServiceForTest", {
    enumerable: true,
    get: function() {
        return createLamaServiceForTest;
    }
});
const _lamaservice = require("../lama.service");
const _lamapresenter = require("../lama.presenter");
const _randomservice = require("../../../../modules/random/services/random.service");
const _lamasharedservice = require("../shared/lama-shared.service");
const _lamaroundservice = require("../round/lama-round.service");
const _lamasetupservice = require("../setup/lama-setup.service");
const _lamadrawservice = require("../actions/lama-draw.service");
const _lamapassservice = require("../actions/lama-pass.service");
const _lamaplayservice = require("../actions/lama-play.service");
const _lamaquitservice = require("../actions/lama-quit.service");
const _lamareturnservice = require("../actions/lama-return.service");
const _lamainfoservice = require("../actions/lama-info.service");
const _lamaactionservice = require("../actions/lama-action.service");
const _lamabotservice = require("../bots/lama-bot.service");
const _lamashortcutsservice = require("../shortcuts/lama-shortcuts.service");
const _lamalogservice = require("../logging/lama-log.service");
const createLamaServiceForTest = ()=>{
    const shared = new _lamasharedservice.LamaSharedService();
    const random = new _randomservice.RandomService();
    const logger = new _lamalogservice.LamaLogService();
    const round = new _lamaroundservice.LamaRoundService(random, logger, shared);
    const setup = new _lamasetupservice.LamaSetupService(shared, round, logger);
    const draw = new _lamadrawservice.LamaDrawService(shared, round, logger);
    const pass = new _lamapassservice.LamaPassService(shared, round, logger);
    const play = new _lamaplayservice.LamaPlayService(shared, round, logger);
    const quit = new _lamaquitservice.LamaQuitService(shared, round, logger);
    const ret = new _lamareturnservice.LamaReturnService(shared, round, logger);
    const info = new _lamainfoservice.LamaInfoService(shared, logger);
    const actions = new _lamaactionservice.LamaActionService(shared, draw, pass, play, quit, ret, info, setup, logger);
    const bots = new _lamabotservice.LamaBotService(shared);
    const shortcuts = new _lamashortcutsservice.LamaShortcutsService(shared);
    const presenter = new _lamapresenter.LamaPresenter();
    const service = new _lamaservice.LamaService({
        register: ()=>{}
    }, presenter, actions, setup, bots, shortcuts);
    return {
        service
    };
};
