import { RoomPayloadService } from './room-payload.service';

type ServiceArguments = ConstructorParameters<typeof RoomPayloadService>;

describe('RoomPayloadService', () => {
  it('ignores a stale cache and always rebuilds the room from persistence', async () => {
    const room = { id: 4, name: 'authoritative' };
    const payload = { room: { id: 4, name: 'authoritative' } };
    const cache = {
      get: jest.fn().mockResolvedValue({ room: { id: 4, name: 'stale' } }),
      persist: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RoomPayloadService(
      {
        findPayload: jest.fn().mockResolvedValue(room),
      } as ServiceArguments[0],
      { build: jest.fn().mockResolvedValue(payload) } as ServiceArguments[1],
      cache as ServiceArguments[2],
    );

    await expect(service.getRoomPayload(4)).resolves.toBe(payload);
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('returns the database payload when cache persistence is unavailable', async () => {
    const payload = { room: { id: 4, name: 'authoritative' } };
    const service = new RoomPayloadService(
      {
        findPayload: jest.fn().mockResolvedValue({ id: 4 }),
      } as ServiceArguments[0],
      { build: jest.fn().mockResolvedValue(payload) } as ServiceArguments[1],
      {
        persist: jest.fn().mockRejectedValue(new Error('cache down')),
      } as ServiceArguments[2],
    );

    await expect(service.getRoomPayload(4)).resolves.toBe(payload);
  });

  it('degrades cache maintenance failures without changing command results', async () => {
    const cache = {
      prime: jest.fn().mockRejectedValue(new Error('cache down')),
      invalidate: jest.fn().mockRejectedValue(new Error('cache down')),
      update: jest.fn().mockRejectedValue(new Error('cache down')),
    };
    const service = new RoomPayloadService(
      {} as ServiceArguments[0],
      {} as ServiceArguments[1],
      cache as ServiceArguments[2],
    );

    await expect(
      service.prime(4, {} as Parameters<RoomPayloadService['prime']>[1]),
    ).resolves.toBeUndefined();
    await expect(service.invalidate(4)).resolves.toBeUndefined();
    await expect(service.update(4, (payload) => payload)).resolves.toBeNull();
  });

  it('rebuilds an authoritative payload without reading a stale cache', async () => {
    const room = { id: 4, bots: [{ id: 9, name: 'Noodle' }] };
    const payload = { room: { id: 4, bots: [{ id: 9, name: 'Noodle' }] } };
    const repository = {
      findPayload: jest.fn().mockResolvedValue(room),
    };
    const builder = { build: jest.fn().mockResolvedValue(payload) };
    const cache = {
      get: jest.fn(),
      persist: jest.fn().mockResolvedValue(undefined),
    };
    const service = new RoomPayloadService(
      repository as ServiceArguments[0],
      builder as ServiceArguments[1],
      cache as ServiceArguments[2],
    );

    await expect(service.refreshRoomPayload(4)).resolves.toBe(payload);
    expect(cache.get).not.toHaveBeenCalled();
    expect(repository.findPayload).toHaveBeenCalledWith(4);
    expect(cache.persist).toHaveBeenCalledWith(4, payload);
  });
});
