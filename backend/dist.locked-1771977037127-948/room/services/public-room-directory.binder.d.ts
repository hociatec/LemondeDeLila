import { OnModuleInit } from '@nestjs/common';
import { RoomService } from './room.service';
import { PublicRoomDirectoryService } from './public-room-directory.service';
export declare class PublicRoomDirectoryBinder implements OnModuleInit {
    private readonly rooms;
    private readonly directory;
    constructor(rooms: RoomService, directory: PublicRoomDirectoryService);
    onModuleInit(): void;
}
