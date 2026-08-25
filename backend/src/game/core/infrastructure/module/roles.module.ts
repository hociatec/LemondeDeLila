import { Module } from '@nestjs/common';
import { RolesAssignmentService } from '../../application/services/roles-assignment.service';

@Module({
  providers: [RolesAssignmentService],
  exports: [RolesAssignmentService],
})
export class RolesModule {}
