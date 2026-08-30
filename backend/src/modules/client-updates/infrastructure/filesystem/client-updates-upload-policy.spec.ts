import { HttpException } from '@nestjs/common';
import { clientUpdateStorageError } from './client-updates-upload-policy';

describe('client update upload storage policy', () => {
  it('maps a real filesystem ENOSPC shape to HTTP 507', () => {
    const mapped = clientUpdateStorageError(
      Object.assign(new Error('no space left on device'), { code: 'ENOSPC' }),
    );
    expect(mapped).toBeInstanceOf(HttpException);
    expect((mapped as HttpException).getStatus()).toBe(507);
  });
});
