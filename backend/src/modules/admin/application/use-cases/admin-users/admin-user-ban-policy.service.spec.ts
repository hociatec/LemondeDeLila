import { AdminUserBanPolicyService } from './admin-user-ban-policy.service';

it('computes a ban duration from an explicit instant without reading a clock', () => {
  const service = new AdminUserBanPolicyService();
  expect(service.resolveBannedUntil(1000, 1)?.getTime()).toBe(86_401_000);
  expect(service.resolveBannedUntil(2000, 1)?.getTime()).toBe(86_402_000);
  expect(
    service
      .resolveBannedUntil(1000, undefined, '2026-09-09T00:00:00Z')
      ?.toISOString(),
  ).toBe('2026-09-09T00:00:00.000Z');
});
