"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoomRealtimeTrackerService = void 0;
const common_1 = require("@nestjs/common");
let RoomRealtimeTrackerService = class RoomRealtimeTrackerService {
    activePlayerSocketsByRoomId = new Map();
    participantRoomBySocket = new WeakMap();
    setSocketParticipantRoom(socket, roomId) {
        const nextRoomId = typeof roomId === 'number' && Number.isFinite(roomId) && roomId > 0
            ? Math.floor(roomId)
            : 0;
        const prevRoomId = this.participantRoomBySocket.get(socket) ?? 0;
        if (prevRoomId === nextRoomId) {
            return;
        }
        if (prevRoomId > 0) {
            this.decrement(prevRoomId);
        }
        if (nextRoomId > 0) {
            this.increment(nextRoomId);
        }
        this.participantRoomBySocket.set(socket, nextRoomId);
    }
    clearSocket(socket) {
        this.setSocketParticipantRoom(socket, null);
    }
    increment(roomId) {
        const current = this.activePlayerSocketsByRoomId.get(roomId) ?? 0;
        this.activePlayerSocketsByRoomId.set(roomId, current + 1);
    }
    decrement(roomId) {
        const current = this.activePlayerSocketsByRoomId.get(roomId) ?? 0;
        const next = Math.max(0, current - 1);
        if (next === 0) {
            this.activePlayerSocketsByRoomId.delete(roomId);
        }
        else {
            this.activePlayerSocketsByRoomId.set(roomId, next);
        }
    }
    getActivePlayerRoomIds() {
        return Array.from(this.activePlayerSocketsByRoomId.keys());
    }
    hasActivePlayers(roomId) {
        return (this.activePlayerSocketsByRoomId.get(roomId) ?? 0) > 0;
    }
    countActivePlayers(roomId) {
        return this.activePlayerSocketsByRoomId.get(roomId) ?? 0;
    }
};
exports.RoomRealtimeTrackerService = RoomRealtimeTrackerService;
exports.RoomRealtimeTrackerService = RoomRealtimeTrackerService = __decorate([
    (0, common_1.Injectable)()
], RoomRealtimeTrackerService);
//# sourceMappingURL=room-realtime-tracker.service.js.map