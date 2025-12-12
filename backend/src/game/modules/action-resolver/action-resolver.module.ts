import { Module } from '@nestjs/common';
import { ActionResolverService } from './services/action-resolver.service';

@Module({
  providers: [ActionResolverService],
  exports: [ActionResolverService],
})
export class ActionResolverModule {}
