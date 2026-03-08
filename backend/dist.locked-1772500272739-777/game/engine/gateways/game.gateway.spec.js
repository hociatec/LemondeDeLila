"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _gamegateway = require("./game.gateway");
describe('GameGateway', ()=>{
    it('sends viewerEndgameMessage from profile messages without leaking other players data', ()=>{
        const engine = {
            setBroadcaster: jest.fn(),
            setEndedBroadcaster: jest.fn(),
            exposeStateForUser: jest.fn(()=>({
                    extras: {
                        viewerPlayerId: 1
                    }
                }))
        };
        const roomService = {
            setRoomDeletedNotifier: jest.fn()
        };
        const gateway = new _gamegateway.GameGateway(engine, {}, {}, {}, {}, roomService, {});
        const sentFrames = [];
        const socket = {
            readyState: 1,
            send: jest.fn((data)=>sentFrames.push(data)),
            close: jest.fn(),
            terminate: jest.fn(),
            ping: jest.fn(),
            on: jest.fn()
        };
        gateway.rooms.set('morpion:1', new Set([
            socket
        ]));
        gateway.clients.set(socket, {
            socket,
            userId: 42,
            roomId: 1,
            gameType: 'morpion'
        });
        gateway.broadcastEnded('morpion', 1, {
            players: [
                {
                    id: 1,
                    username: 'Lila'
                }
            ]
        }, {
            roomId: 1,
            gameType: 'morpion',
            status: 'finished',
            finishedAt: '2026-03-02T00:00:00.000Z',
            winnerPlayerId: 1,
            outcomesByPlayerId: {
                '1': 'won'
            },
            playersById: {
                '1': 'Lila'
            },
            endgameMessagesByPlayerId: {
                '1': {
                    victoryMessage: 'Bravo, victoire perso !',
                    defeatMessage: 'Ce message ne doit pas sortir ici.'
                }
            },
            turnIndex: 9
        });
        expect(socket.send).toHaveBeenCalledTimes(1);
        const frame = JSON.parse(sentFrames[0] ?? '{}');
        expect(frame.type).toBe('game.ended');
        expect(frame.payload.viewerOutcome).toBe('won');
        expect(frame.payload.viewerEndgameMessage).toBe('Bravo, victoire perso !');
        expect(frame.payload.endgameMessagesByPlayerId).toBeUndefined();
    });
});
