import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createPublicKey } from 'crypto';
import { getJwtAlgorithm, requireJwtVerifyKey } from './jwt-config';

@Controller()
export class JwksController {
  constructor(private readonly config: ConfigService) {}

  @Get('.well-known/jwks.json')
  jwks() {
    const alg = getJwtAlgorithm(this.config);
    if (alg !== 'RS256') {
      throw new NotFoundException();
    }

    const publicKeyPem = requireJwtVerifyKey(this.config);
    const keyObject = createPublicKey(publicKeyPem);
    const jwk = keyObject.export({ format: 'jwk' }) as any;

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

