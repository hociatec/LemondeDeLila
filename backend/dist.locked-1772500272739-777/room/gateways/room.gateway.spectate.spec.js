"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _roomgateway = require("./room.gateway");
function createGateway() {
    const roomsService = {
        setRealtimeNotifier: jest.fn(),
        setRoomDeletedNotifier: jest.fn(),
        isBanned: jest.fn().mockReturnValue(false),
        getRoomPayload: jest.fn()
    };
    const botService = {};
    const auth = {};
    const catalog = {};
    const perf = {
        measure: jest.fn().mockImplementation(async (_metric, fn)=>await fn())
    };
    const invites = {
        canSpectate: jest.fn().mockReturnValue(false)
    };
    const clientUpdates = {};
    const wsTickets = {};
    const realtimeTracker = {};
    const sounds = {
        listTableAmbiencesWithFilter: jest.fn().mockResolvedValue({
            items: []
        })
    };
    const gateway = new _roomgateway.RoomGateway(roomsService, botService, auth, catalog, perf, invites, clientUpdates, wsTickets, realtimeTracker, sounds);
    return {
        gateway,
        roomsService,
        invites
    };
}
function payload(overrides) {
    return {
        room: {
            id: 10,
            isPrivate: false,
            status: 'setup',
            startedAt: null,
            owner: {
                id: 1,
                username: 'owner'
            },
            players: [
                {
                    id: 2,
                    username: 'p2'
                }
            ],
            spectators: [],
            bots: []
        },
        manifest: null,
        generatedAt: new Date().toISOString(),
        ...overrides ?? {},
        room: {
            id: 10,
            isPrivate: false,
            status: 'setup',
            startedAt: null,
            owner: {
                id: 1,
                username: 'owner'
            },
            players: [
                {
                    id: 2,
                    username: 'p2'
                }
            ],
            spectators: [],
            bots: [],
            ...overrides?.room ?? {}
        }
    };
}
describe('RoomGateway.canSpectate', ()=>{
    it('returns false for banned users', async ()=>{
        const { gateway, roomsService } = createGateway();
        roomsService.isBanned.mockReturnValueOnce(true);
        const allowed = await gateway.canSpectate(10, 5);
        expect(allowed).toBe(false);
        expect(roomsService.getRoomPayload).not.toHaveBeenCalled();
    });
    it('returns true on public rooms', async ()=>{
        const { gateway, roomsService } = createGateway();
        roomsService.getRoomPayload.mockResolvedValueOnce(payload({
            room: {
                isPrivate: false
            }
        }));
        const allowed = await gateway.canSpectate(10, 5);
        expect(allowed).toBe(true);
    });
    it('returns true on private room for owner', async ()=>{
        const { gateway, roomsService } = createGateway();
        roomsService.getRoomPayload.mockResolvedValueOnce(payload({
            room: {
                isPrivate: true,
                owner: {
                    id: 5,
                    username: 'me'
                }
            }
        }));
        const allowed = await gateway.canSpectate(10, 5);
        expect(allowed).toBe(true);
    });
    it('returns true on private room for existing participant', async ()=>{
        const { gateway, roomsService } = createGateway();
        roomsService.getRoomPayload.mockResolvedValueOnce(payload({
            room: {
                isPrivate: true,
                players: [
                    {
                        id: 2,
                        username: 'p2'
                    },
                    {
                        id: 5,
                        username: 'me'
                    }
                ]
            }
        }));
        const allowed = await gateway.canSpectate(10, 5);
        expect(allowed).toBe(true);
    });
    it('returns invite-based decision for private started room', async ()=>{
        const { gateway, roomsService, invites } = createGateway();
        roomsService.getRoomPayload.mockResolvedValueOnce(payload({
            room: {
                isPrivate: true,
                status: 'started',
                startedAt: '2026-03-02T12:00:00.000Z',
                owner: {
                    id: 1,
                    username: 'owner'
                },
                players: [
                    {
                        id: 2,
                        username: 'p2'
                    }
                ]
            }
        }));
        invites.canSpectate.mockReturnValueOnce(true);
        const allowed = await gateway.canSpectate(10, 5);
        expect(allowed).toBe(true);
        expect(invites.canSpectate).toHaveBeenCalledWith(10, 5);
    });
    it('returns false for private setup room when user is not owner/participant', async ()=>{
        const { gateway, roomsService, invites } = createGateway();
        roomsService.getRoomPayload.mockResolvedValueOnce(payload({
            room: {
                isPrivate: true,
                status: 'setup',
                startedAt: null,
                owner: {
                    id: 1,
                    username: 'owner'
                },
                players: [
                    {
                        id: 2,
                        username: 'p2'
                    }
                ]
            }
        }));
        const allowed = await gateway.canSpectate(10, 5);
        expect(allowed).toBe(false);
        expect(invites.canSpectate).not.toHaveBeenCalled();
    });
});
