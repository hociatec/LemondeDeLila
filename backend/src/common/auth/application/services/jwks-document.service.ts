import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createHash, createPublicKey } from 'crypto';
import {
  readAuthRuntimeConfigFromEnv,
  type AuthRuntimeConfig,
} from '../ports/auth-runtime-config.port';

import { getJwtAlgorithm, requireJwtVerifyKey } from './jwt-config.service';

@Injectable()
export class JwksDocumentService {
  private readonly config: AuthRuntimeConfig;

  constructor(@Optional() config?: AuthRuntimeConfig) {
    this.config = config ?? readAuthRuntimeConfigFromEnv();
  }

  buildDocument() {
    const algorithm = getJwtAlgorithm(this.config);
    if (algorithm !== 'RS256') {
      throw new NotFoundException();
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
