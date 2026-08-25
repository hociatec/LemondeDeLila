import { Module } from '@nestjs/common';
import { PromptPoliciesService } from '../application/prompt-policies.service';

@Module({
  providers: [PromptPoliciesService],
  exports: [PromptPoliciesService],
})
export class PromptsModule {}
