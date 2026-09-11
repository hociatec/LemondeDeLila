import { RoomInviteService } from './room-invite.service';
import { operationalSettings } from '../../../../../platform/config/public-api';

it('expires at the exact deadline using the injected clock', () => {
  let now = 100;
  const service = new RoomInviteService({ now: () => now });
  const invite = service.create(1, 2, 3);
  expect(invite.expiresAt - invite.createdAt).toBe(
    operationalSettings.roomInviteTtlMs,
  );
  now = invite.expiresAt - 1;
  expect(service.get(invite.id)).not.toBeNull();
  now += 1;
  expect(service.get(invite.id)).toBeNull();
  expect(service.consume(invite.id, { keep: true })).toBeNull();
});

it('treats a consumption at epoch zero as consumed and expires its permission', () => {
  let now = 0;
  const service = new RoomInviteService({ now: () => now });
  const invite = service.create(1, 2, 3);
  expect(service.consume(invite.id, { keep: true })?.consumedAt).toBe(0);
  expect(service.findActive(1, 3)).toBeNull();
  expect(service.canSpectate(1, 3)).toBe(true);
  expect(service.canSpectate(1, 4)).toBe(false);
  now = invite.expiresAt;
  expect(service.canSpectate(1, 3)).toBe(false);
});

it('does not expose stored invitations to caller mutation', () => {
  const service = new RoomInviteService({ now: () => 100 });
  const invite = service.create(1, 2, 3);
  const id = invite.id;
  invite.toUserId = 99;
  invite.expiresAt = 0;
  const active = service.findActive(1, 3);
  expect(active).not.toBeNull();
  active!.consumedAt = 100;
  const read = service.get(id);
  read!.consumedAt = 100;
  expect(service.canSpectate(1, 3)).toBe(false);
  const consumed = service.consume(id, { keep: true });
  consumed!.toUserId = 99;
  expect(service.canSpectate(1, 3)).toBe(true);
  expect(service.canSpectate(1, 99)).toBe(false);
});
