import { Test } from '@nestjs/testing';
import { AdminRoleGuard, HttpJwtGuard } from '../auth/public-api';
import { AUTH_ACCOUNT_READER } from '../auth/public-api';
import { Global, Module } from '@nestjs/common';
import { ObservabilityModule } from './observability.module';

@Global()
@Module({
  providers: [
    { provide: AUTH_ACCOUNT_READER, useValue: { findById: jest.fn() } },
  ],
  exports: [AUTH_ACCOUNT_READER],
})
class TestAccountsModule {}

it('provides the authentication guards used by the metrics endpoint', async () => {
  const module = await Test.createTestingModule({
    imports: [TestAccountsModule, ObservabilityModule],
  }).compile();
  try {
    expect(module.get(HttpJwtGuard)).toBeInstanceOf(HttpJwtGuard);
    expect(module.get(AdminRoleGuard)).toBeInstanceOf(AdminRoleGuard);
  } finally {
    await module.close();
  }
});
