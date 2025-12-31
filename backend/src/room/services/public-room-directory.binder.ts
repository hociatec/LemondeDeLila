import { Injectable, OnModuleInit } from '@nestjs/common';
import { RoomService } from './room.service';
import { PublicRoomDirectoryService } from './public-room-directory.service';

@Injectable()
export class PublicRoomDirectoryBinder implements OnModuleInit {
  constructor(
    private readonly rooms: RoomService,
    private readonly directory: PublicRoomDirectoryService,
  ) {}

  onModuleInit() {
    this.rooms.setDirectoryNotifier((roomId, reason) =>
      this.directory.notifyRefresh(roomId, reason),
    );
  }
}
