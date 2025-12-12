import { Module } from '@nestjs/common';
import { RolesAssignmentService } from './services/roles-assignment.service';

@Module({
  providers: [RolesAssignmentService],
  exports: [RolesAssignmentService],
})
export class RolesModule {}
