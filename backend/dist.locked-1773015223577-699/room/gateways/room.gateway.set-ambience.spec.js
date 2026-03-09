"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _roomgateway = require("./room.gateway");
function createGateway() {
    const roomsService = {
        setRealtimeNotifier: jest.fn(),
        setRoomDeletedNotifier: jest.fn(),
        requireRoomForOwnerAction: jest.fn().mockResolvedValue({
            id: 10
        }),
        saveRoom: jest.fn().mockResolvedValue(undefined),
        invalidateRoomPayloadCache: jest.fn().mockResolvedValue(undefined)
    };
    const botService = {};
    const auth = {};
    const catalog = {};
    const perf = {
        measure: jest.fn().mockImplementation(async (_name, fn)=>fn())
    };
    const invites = {};
    const clientUpdates = {};
    const wsTickets = {};
    const realtimeTracker = {};
    const sounds = {
        listTableAmbiencesWithFilter: jest.fn().mockResolvedValue({
            items: [
                {
                    soundId: 'TableAmbience1',
                    name: 'A1',
                    enabled: true
                }
            ]
        })
    };
    const gateway = new _roomgateway.RoomGateway(roomsService, botService, auth, catalog, perf, invites, clientUpdates, wsTickets, realtimeTracker, sounds);
    gateway.sendError = jest.fn().mockResolvedValue(undefined);
    gateway.tryUpdateRoomPayload = jest.fn().mockResolvedValue(true);
    gateway.sendRoomState = jest.fn().mockResolvedValue(undefined);
    return {
        gateway,
        roomsService,
        sounds
    };
}
describe('RoomGateway.handleSetAmbience', ()=>{
    it('accepts an active table ambience and persists it', async ()=>{
        const { gateway, roomsService, sounds } = createGateway();
        await gateway.handleSetAmbience({}, {
            roomId: 10,
            userId: 1
        }, {
            soundId: 'TableAmbience1'
        }, Date.now());
        expect(sounds.listTableAmbiencesWithFilter).toHaveBeenCalled();
        expect(roomsService.requireRoomForOwnerAction).toHaveBeenCalledWith(10, 1);
        expect(roomsService.saveRoom).toHaveBeenCalled();
        const savedRoom = roomsService.saveRoom.mock.calls[0][0];
        expect(savedRoom.tableAmbienceSoundId).toBe('TableAmbience1');
        expect(gateway.sendError).not.toHaveBeenCalled();
    });
    it('rejects an inactive or missing ambience id', async ()=>{
        const { gateway, roomsService, sounds } = createGateway();
        sounds.listTableAmbiencesWithFilter.mockResolvedValue({
            items: []
        });
        await gateway.handleSetAmbience({}, {
            roomId: 10,
            userId: 1
        }, {
            soundId: 'TableAmbience1'
        }, Date.now());
        expect(gateway.sendError).toHaveBeenCalledWith(expect.anything(), 'Ambiance indisponible: TableAmbience1');
        expect(roomsService.requireRoomForOwnerAction).not.toHaveBeenCalled();
        expect(roomsService.saveRoom).not.toHaveBeenCalled();
    });
    it('rejects an invalid ambience id before querying active list', async ()=>{
        const { gateway, roomsService, sounds } = createGateway();
        await gateway.handleSetAmbience({}, {
            roomId: 10,
            userId: 1
        }, {
            soundId: 'TableAmbience99'
        }, Date.now());
        expect(gateway.sendError).toHaveBeenCalledWith(expect.anything(), 'Ambiance invalide: TableAmbience99');
        expect(sounds.listTableAmbiencesWithFilter).not.toHaveBeenCalled();
        expect(roomsService.saveRoom).not.toHaveBeenCalled();
    });
    it('allows clearing ambience with an empty sound id', async ()=>{
        const { gateway, roomsService, sounds } = createGateway();
        await gateway.handleSetAmbience({}, {
            roomId: 10,
            userId: 1
        }, {
            soundId: ''
        }, Date.now());
        expect(sounds.listTableAmbiencesWithFilter).not.toHaveBeenCalled();
        expect(roomsService.requireRoomForOwnerAction).toHaveBeenCalledWith(10, 1);
        const savedRoom = roomsService.saveRoom.mock.calls[0][0];
        expect(savedRoom.tableAmbienceSoundId).toBeNull();
        expect(gateway.sendError).not.toHaveBeenCalled();
    });
});
