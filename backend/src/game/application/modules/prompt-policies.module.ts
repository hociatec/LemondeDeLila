import { Module } from '@nestjs/common';
import { PromptPoliciesService } from '../services/prompt-policies.service';

@Module({
  providers: [PromptPoliciesService],
  exports: [PromptPoliciesService],
})
export class PromptPoliciesModule {}
