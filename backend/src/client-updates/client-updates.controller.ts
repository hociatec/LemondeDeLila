import { Controller, Get } from '@nestjs/common';
import { ClientUpdatesService } from './client-updates.service';

@Controller()
export class ClientUpdatesController {
  constructor(private readonly updates: ClientUpdatesService) {}

  // Public endpoint used by clients (informational).
  @Get('client/version')
  async getVersion() {
    const latest = await this.updates.getLatest();
    return {
      version: latest?.version ?? null,
      publishedAt: latest?.publishedAt ?? null,
      message: latest?.message ?? null,
      url: latest?.publicUrl ?? this.updates.getPublicUrl(),
    };
  }
}
