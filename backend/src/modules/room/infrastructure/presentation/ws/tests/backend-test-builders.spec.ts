import {
  buildTestGameSession,
  buildTestRoomPayload,
  buildTestSocket,
  buildTestUser,
} from './backend-test-builders';

describe('backend test builders', () => {
  it('builds independent overridable aggregates', () => {
    expect(buildTestUser({ id: 9 })).toMatchObject({ id: 9 });
    expect(
      buildTestRoomPayload({ room: { status: 'started' } }).room,
    ).toMatchObject({ id: 10, status: 'started' });
    expect(buildTestGameSession({ roomId: 99 })).toMatchObject({
      roomId: 99,
      state: { version: 1, phase: 'playing' },
    });
    expect(buildTestSocket().send).toEqual(expect.any(Function));
  });
});
