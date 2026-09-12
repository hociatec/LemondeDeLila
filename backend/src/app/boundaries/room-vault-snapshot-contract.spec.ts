import type { RoomSnapshotProjection } from '../../modules/room/public-api';
import type { VaultSnapshotCaptureInput } from '../../modules/vault/public-api';

type Exact<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

it('keeps the Room projection compatible with the independently owned Vault input', () => {
  const compatible: Exact<RoomSnapshotProjection, VaultSnapshotCaptureInput> =
    true;
  expect(compatible).toBe(true);
});
