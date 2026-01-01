import { Module } from '@nestjs/common';
import { SoundsController } from './sounds.controller';
import { SoundsService } from './sounds.service';
import { AdminSoundsController } from './admin-sounds.controller';

@Module({
  controllers: [SoundsController, AdminSoundsController],
  providers: [SoundsService],
  exports: [SoundsService],
})
export class SoundsModule {}

