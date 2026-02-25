"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _roomdirectoryutils = require("./room-directory.utils");
function makeUser(id, username) {
    return {
        id,
        username,
        email: `${username}@example.test`,
        roles: [],
        password: 'x',
        emailVerified: true,
        createdAt: new Date()
    };
}
function makeParticipant(userId, leftAt) {
    return {
        id: userId,
        room: {},
        user: makeUser(userId, `u${userId}`),
        role: 'player',
        joinedAt: new Date(),
        leftAt: leftAt ?? null
    };
}
function makeBot(id) {
    return {
        id,
        room: {},
        name: `bot${id}`,
        createdAt: new Date()
    };
}
function makeRoom(partial) {
    return {
        id: partial.id,
        runId: partial.runId ?? 0,
        name: partial.name ?? `Room ${partial.id}`,
        gameType: partial.gameType,
        maxPlayers: partial.maxPlayers ?? 4,
        isPrivate: partial.isPrivate ?? false,
        status: partial.status ?? 'open',
        owner: partial.owner ?? null,
        createdAt: partial.createdAt ?? new Date(),
        startedAt: partial.startedAt ?? null,
        participants: partial.participants ?? [],
        bots: partial.bots ?? []
    };
}
describe('buildPublicRoomList', ()=>{
    it('includes rooms that have startedAt set as spectator-only', ()=>{
        const started = makeRoom({
            id: 1,
            gameType: 'dame-nature',
            status: 'open',
            startedAt: new Date(),
            participants: [
                makeParticipant(1)
            ]
        });
        const joinable = makeRoom({
            id: 2,
            gameType: 'dame-nature',
            status: 'open',
            participants: [
                makeParticipant(2)
            ]
        });
        const { items } = (0, _roomdirectoryutils.buildPublicRoomList)([
            started,
            joinable
        ]);
        expect(items.map((i)=>i.id).sort()).toEqual([
            1,
            2
        ]);
        const startedItem = items.find((i)=>i.id === 1);
        expect(startedItem?.spectatorOnly).toBe(true);
        expect(startedItem?.started).toBe(true);
        const joinableItem = items.find((i)=>i.id === 2);
        expect(joinableItem?.spectatorOnly).toBe(false);
        expect(joinableItem?.started).toBe(false);
    });
    it('keeps open rooms listed even when they are full (spectator access)', ()=>{
        const full = makeRoom({
            id: 1,
            gameType: 'panier-express',
            status: 'open',
            maxPlayers: 2,
            participants: [
                makeParticipant(1),
                makeParticipant(2)
            ]
        });
        const joinable = makeRoom({
            id: 2,
            gameType: 'panier-express',
            status: 'open',
            maxPlayers: 2,
            participants: [
                makeParticipant(3)
            ],
            bots: []
        });
        const { items } = (0, _roomdirectoryutils.buildPublicRoomList)([
            full,
            joinable
        ]);
        expect(items.map((i)=>i.id)).toEqual([
            1,
            2
        ]);
    });
    it('does not count participants that already left', ()=>{
        const room = makeRoom({
            id: 1,
            gameType: 'dame-nature',
            status: 'open',
            maxPlayers: 2,
            participants: [
                makeParticipant(1, new Date()),
                makeParticipant(2, null)
            ],
            bots: [
                makeBot(1)
            ]
        });
        const { items } = (0, _roomdirectoryutils.buildPublicRoomList)([
            room
        ]);
        expect(items).toHaveLength(1);
        expect(items[0]?.playersCount).toBe(1);
        expect(items[0]?.botsCount).toBe(1);
    });
    it('groups rooms by gameType and sorts groups case-insensitively', ()=>{
        const a = makeRoom({
            id: 1,
            gameType: 'Alpha',
            status: 'open'
        });
        const b = makeRoom({
            id: 2,
            gameType: 'beta',
            status: 'open'
        });
        const a2 = makeRoom({
            id: 3,
            gameType: 'Alpha',
            status: 'open'
        });
        const { groups } = (0, _roomdirectoryutils.buildPublicRoomList)([
            b,
            a,
            a2
        ]);
        expect(groups.map((g)=>g.gameType)).toEqual([
            'Alpha',
            'beta'
        ]);
        expect(groups[0]?.rooms.map((r)=>r.id)).toEqual([
            1,
            3
        ]);
    });
    it('filters out private rooms', ()=>{
        const priv = makeRoom({
            id: 1,
            gameType: 'dame-nature',
            isPrivate: true
        });
        const pub = makeRoom({
            id: 2,
            gameType: 'dame-nature',
            isPrivate: false
        });
        const { items } = (0, _roomdirectoryutils.buildPublicRoomList)([
            priv,
            pub
        ]);
        expect(items.map((i)=>i.id)).toEqual([
            2
        ]);
    });
    it('can filter out unknown game types when provided an allow-list', ()=>{
        const known = makeRoom({
            id: 1,
            gameType: 'dame-nature',
            status: 'open'
        });
        const unknown = makeRoom({
            id: 2,
            gameType: 'generic',
            status: 'open'
        });
        const { items } = (0, _roomdirectoryutils.buildPublicRoomList)([
            known,
            unknown
        ], {
            allowedGameTypes: new Set([
                'dame-nature'
            ])
        });
        expect(items.map((i)=>i.id)).toEqual([
            1
        ]);
    });
});
