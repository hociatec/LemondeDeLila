import { RoomPayloadService } from './room-payload.service';

describe('RoomPayloadService', () => {
  it('rebuilds an authoritative payload without reading a stale cache', async () => {
    const room = { id: 4, bots: [{ id: 9, name: 'Noodle' }] };
    const payload = { room: { id: 4, bots: [{ id: 9, name: 'Noodle' }] } };
    const repository = {
      findByIdWithPayloadRelations: jest.fn().mockResolvedValue(room),
    };
    const builder = { build: jest.fn().mockResolvedValue(payload) };
    const cache = {
      get: jest.fn(),
      persist: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RoomPayloadService(
      repository as never,
      builder as never,
      cache as never,
    );

    await expect(service.refreshRoomPayload(4)).resolves.toBe(payload);
    expect(cache.get).not.toHaveBeenCalled();
    expect(repository.findByIdWithPayloadRelations).toHaveBeenCalledWith(4);
    expect(cache.persist).toHaveBeenCalledWith(4, payload);
  });
});
