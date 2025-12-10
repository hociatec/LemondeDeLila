import { Module } from '@nestjs/common';
import { MovementService } from './services/movement.service';

@Module({
  providers: [MovementService],
  exports: [MovementService],
})
export class MovementModule {}
