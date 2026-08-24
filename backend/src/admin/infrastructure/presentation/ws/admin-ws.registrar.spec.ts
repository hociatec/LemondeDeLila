import { WsRouteRegistry } from '../../../../common/ws/application/services/ws-route-registry.service';
import { WS_EVENTS } from '../../../../realtime/public-api';
import { AdminWsRegistrar } from './admin-ws.registrar';

function createHandlerStub() {
  return {
    usersList: jest.fn(async () => null),
    usersGet: jest.fn(async () => null),
    usersBan: jest.fn(async () => null),
    usersUnban: jest.fn(async () => null),
    usersDelete: jest.fn(async () => null),
    usersUpdateRoles: jest.fn(async () => null),
    gamesList: jest.fn(async () => null),
    gamesSetEnabled: jest.fn(async () => null),
    gamesUpdate: jest.fn(async () => null),
    gamesReset: jest.fn(async () => null),
    gamesCategoriesList: jest.fn(async () => null),
    gamesCategoryCreate: jest.fn(async () => null),
    gamesCategoryUpdate: jest.fn(async () => null),
    gamesCategoryAssign: jest.fn(async () => null),
    gamesCategoryDelete: jest.fn(async () => null),
    rolesList: jest.fn(async () => null),
    rolesDefinitionsList: jest.fn(async () => null),
    roleDefinitionCreate: jest.fn(async () => null),
    roleDefinitionUpdate: jest.fn(async () => null),
    roleDefinitionDelete: jest.fn(async () => null),
    logsDownload: jest.fn(async () => null),
    broadcast: jest.fn(async () => null),
    clientUpdateAnnounce: jest.fn(async () => null),
    clientUpdateForceLatest: jest.fn(async () => null),
    clientUpdateSchedule: jest.fn(async () => null),
    chatMessages: jest.fn(async () => null),
    chatSettingsGet: jest.fn(async () => null),
    chatSettingsUpdate: jest.fn(async () => null),
    chatDelete: jest.fn(async () => null),
    chatClear: jest.fn(async () => null),
    chatBan: jest.fn(async () => null),
    chatUnban: jest.fn(async () => null),
    profileSettingsGet: jest.fn(async () => null),
    profileSettingsUpdate: jest.fn(async () => null),
    statsResetAll: jest.fn(async () => null),
    create: jest.fn(async () => null),
    list: jest.fn(async () => null),
    get: jest.fn(async () => null),
    update: jest.fn(async () => null),
    updateStatus: jest.fn(async () => null),
    delete: jest.fn(async () => null),
    add: jest.fn(async () => null),
    botsNamesList: jest.fn(async () => null),
    botSettingsGet: jest.fn(async () => null),
    botSettingsUpdate: jest.fn(async () => null),
    botNameCreate: jest.fn(async () => null),
    botNameUpdate: jest.fn(async () => null),
    botNameDelete: jest.fn(async () => null),
    perfSnapshot: jest.fn(async () => null),
    roomsCleanup: jest.fn(async () => null),
    roomsList: jest.fn(async () => null),
    roomsDestroy: jest.fn(async () => null),
    roomsSettingsGet: jest.fn(async () => null),
    roomsSettingsUpdate: jest.fn(async () => null),
    mnemoCategories: jest.fn(async () => null),
    mnemoCategoryCreate: jest.fn(async () => null),
    mnemoCategoryUpdate: jest.fn(async () => null),
    mnemoCategoryDelete: jest.fn(async () => null),
    mnemoQuestions: jest.fn(async () => null),
    mnemoQuestionCreate: jest.fn(async () => null),
    mnemoQuestionUpdate: jest.fn(async () => null),
    mnemoQuestionDelete: jest.fn(async () => null),
  };
}

describe('AdminWsRegistrar', () => {
  it('registers representative admin routes', () => {
    const registry = new WsRouteRegistry();
    const rooms = createHandlerStub();
    const chat = createHandlerStub();
    const users = createHandlerStub();
    const games = createHandlerStub();
    const bots = createHandlerStub();
    const roles = createHandlerStub();
    const logs = createHandlerStub();
    const broadcast = createHandlerStub();
    const clientUpdates = createHandlerStub();
    const perf = createHandlerStub();
    const profile = createHandlerStub();
    const bugReports = createHandlerStub();
    const bugReportComments = createHandlerStub();
    const stats = createHandlerStub();
    const mnemoQuiz = createHandlerStub();

    const registrar = new AdminWsRegistrar(
      registry,
      rooms as any,
      chat as any,
      users as any,
      games as any,
      bots as any,
      roles as any,
      logs as any,
      broadcast as any,
      clientUpdates as any,
      perf as any,
      profile as any,
      bugReports as any,
      bugReportComments as any,
      stats as any,
      mnemoQuiz as any,
    );

    registrar.onModuleInit();

    expect(registry.has(WS_EVENTS.admin.users.list)).toBe(true);
    expect(registry.has(WS_EVENTS.admin.games.update)).toBe(true);
    expect(registry.has(WS_EVENTS.admin.clientUpdate.schedule)).toBe(true);
    expect(registry.has(WS_EVENTS.admin.chat.clear)).toBe(true);
    expect(registry.has(WS_EVENTS.admin.rooms.destroy)).toBe(true);
    expect(registry.has(WS_EVENTS.admin.quiz.mnemo.questionDelete)).toBe(true);
  });
});





