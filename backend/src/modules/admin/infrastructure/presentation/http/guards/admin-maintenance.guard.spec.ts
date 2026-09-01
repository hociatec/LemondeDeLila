import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AdminMaintenanceGuard } from './admin-maintenance.guard';

function contextFor(ip: string, forwardedFor?: string): ExecutionContext {
  const request = {
    ip,
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
  } as unknown as Request;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AdminMaintenanceGuard', () => {
  const previous = { ...process.env };

  beforeEach(() => {
    process.env.ADMIN_MAINTENANCE_ENABLED = 'true';
    process.env.ADMIN_MAINTENANCE_REQUIRE_TOKEN = 'false';
    process.env.ADMIN_MAINTENANCE_ALLOWED_IPS = '10.0.0.5';
  });

  afterAll(() => {
    process.env = previous;
  });

  it('ignores a client-supplied X-Forwarded-For value', () => {
    expect(() =>
      new AdminMaintenanceGuard().canActivate(
        contextFor('203.0.113.7', '10.0.0.5'),
      ),
    ).toThrow(ForbiddenException);
  });

  it('uses the IP resolved by the configured Express proxy policy', () => {
    expect(
      new AdminMaintenanceGuard().canActivate(contextFor('::ffff:10.0.0.5')),
    ).toBe(true);
  });

  it('compares the maintenance token through the shared secret primitive', () => {
    process.env.ADMIN_MAINTENANCE_REQUIRE_TOKEN = 'true';
    process.env.ADMIN_MAINTENANCE_TOKEN = 'a'.repeat(32);
    const request = {
      ip: '10.0.0.5',
      headers: { 'x-admin-maintenance-token': 'wrong-length' },
    } as unknown as Request;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    expect(() => new AdminMaintenanceGuard().canActivate(context)).toThrow(
      ForbiddenException,
    );
  });
});
