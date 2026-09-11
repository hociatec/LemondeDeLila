import {
  parseRoomCreateRequest,
  parseRoomJoinRequest,
} from './room-request.helpers';

it.each([
  true,
  [],
  [2],
  {},
  '2-table',
  '1e2',
  '2.5',
  2.5,
  '0x10',
  Number.MAX_SAFE_INTEGER + 1,
])('rejects malformed room identifiers and capacities: %p', (value) => {
  expect(() => parseRoomJoinRequest({ roomId: value })).toThrow();
  expect(() =>
    parseRoomCreateRequest({ gameType: 'example', maxPlayers: value }),
  ).toThrow();
});
it('accepts complete decimal inputs and optional capacity', () => {
  expect(parseRoomJoinRequest({ roomId: '42' }).roomId).toBe(42);
  expect(
    parseRoomCreateRequest({ gameType: 'example', maxPlayers: '6' }).maxPlayers,
  ).toBe(6);
  expect(parseRoomCreateRequest({ gameType: 'example' }).maxPlayers).toBeNull();
});
