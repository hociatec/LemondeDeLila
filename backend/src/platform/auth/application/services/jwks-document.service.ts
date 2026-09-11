import { Injectable, Optional } from '@nestjs/common';
import { createHash, createPublicKey } from 'crypto';
import {
  readAuthRuntimeConfigFromEnv,
  type AuthRuntimeConfig,
} from '../ports/auth-runtime-config.port';

import { requireJwtVerifyKey } from './jwt-config.service';

@Injectable()
export class JwksDocumentService {
  private readonly config: AuthRuntimeConfig;

  constructor(@Optional() config?: AuthRuntimeConfig) {
    this.config = config ?? readAuthRuntimeConfigFromEnv();
  }

  buildDocument() {
    if (!this.config || typeof this.config !== 'object') {
      throw new Error('Configuration JWT invalide');
    }
    const publicKeyPem = requireJwtVerifyKey(this.config);
    const keyObject = createPublicKey(publicKeyPem);
    const jwk = keyObject.export({ format: 'jwk' });
    const kid = createHash('sha256')
      .update(publicKeyPem)
      .digest('hex')
      .slice(0, 16);

    return {
      keys: [
        {
          ...jwk,
          use: 'sig',
          alg: 'RS256',
          kid,
        },
      ],
    };
  }
}
