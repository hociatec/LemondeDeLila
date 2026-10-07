import { Test } from '@nestjs/testing';
import { AdminRoleGuard, HttpJwtGuard } from '../auth/public-api';
import { ObservabilityModule } from './observability.module';

it('provides the authentication guards used by the metrics endpoint', async () => {
  const module = await Test.createTestingModule({
    imports: [ObservabilityModule],
  }).compile();
  try {
    expect(module.get(HttpJwtGuard)).toBeInstanceOf(HttpJwtGuard);
    expect(module.get(AdminRoleGuard)).toBeInstanceOf(AdminRoleGuard);
  } finally {
    await module.close();
  }
});
