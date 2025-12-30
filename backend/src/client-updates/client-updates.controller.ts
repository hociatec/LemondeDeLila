import { Controller, Get, Query } from '@nestjs/common';
import { ClientUpdatesService } from './client-updates.service';

@Controller()
export class ClientUpdatesController {
  constructor(private readonly updates: ClientUpdatesService) {}

  // Public endpoint used by clients (informational).
  @Get('client/version')
  async getVersion(@Query('current') current?: string) {
    const latest = await this.updates.getLatest();
    const latestVersion = latest?.version ?? null;
    const currentVersion = typeof current === 'string' ? current.trim() : null;

    const updateAvailable =
      latestVersion && currentVersion
        ? compareVersions(latestVersion, currentVersion)
        : null;

    return {
      version: latestVersion,
      publishedAt: latest?.publishedAt ?? null,
      message: latest?.message ?? null,
      url: latest?.publicUrl ?? this.updates.getPublicUrl(),
      current: currentVersion,
      updateAvailable,
    };
  }
}

function compareVersions(latest: string, current: string): boolean | null {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return null;
  return a > b;
}

function parseVersion(value: string): number | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;

  const parts = raw
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 1 || parts.length > 4) return null;

  const nums: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    nums.push(Number(p));
  }
  while (nums.length < 4) nums.push(0);

  // Pack into a monotonic integer: major.minor.build.rev (up to 4 digits each is plenty here).
  // This avoids pulling a semver dependency.
  return nums[0] * 1_000_000_000 + nums[1] * 1_000_000 + nums[2] * 1_000 + nums[3];
}
