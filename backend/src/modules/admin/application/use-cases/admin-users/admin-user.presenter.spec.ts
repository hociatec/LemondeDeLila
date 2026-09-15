import { stringifyExternalJson } from '../../../../../platform/serialization/public-api';
import { presentAdminUser } from './admin-user.presenter';

it('presents database dates as bounded JSON values', () => {
  const user = presentAdminUser({
    id: 1,
    email: 'admin@example.test',
    username: 'admin',
    roles: ['ROLE_ADMIN'],
    avatar: null,
    bannedUntil: new Date('2026-09-20T10:00:00.000Z'),
    banReason: 'test',
    chatBannedUntil: null,
    chatBanReason: null,
    createdAt: new Date('2026-09-15T10:00:00.000Z'),
  });

  expect(user.bannedUntil).toBe('2026-09-20T10:00:00.000Z');
  expect(user.createdAt).toBe('2026-09-15T10:00:00.000Z');
  expect(() => stringifyExternalJson({ user })).not.toThrow();
});
