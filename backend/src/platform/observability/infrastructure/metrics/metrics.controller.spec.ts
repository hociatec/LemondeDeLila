import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { generateKeyPairSync } from 'node:crypto';
import { sign } from 'jsonwebtoken';
import request from 'supertest';
import { JwtPayloadVerifierService } from '../../../auth/public-api';
import { ObservabilityModule } from '../../observability.module';
import { prometheusMetrics } from './prometheus-metrics';

describe('authenticated metrics HTTP endpoint', () => {
  let app: INestApplication;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const token = (roles: string[], expiresIn = 3600) =>
    sign({ roles }, privateKey, {
      algorithm: 'RS256',
      subject: '1',
      issuer: 'metrics-test',
      expiresIn,
    });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ObservabilityModule],
    })
      .overrideProvider(JwtPayloadVerifierService)
      .useValue(
        new JwtPayloadVerifierService({
          jwtPrivateKeyPem: null,
          jwtPrivateKeyPath: null,
          jwtPublicKeyPem: publicKey
            .export({ type: 'spki', format: 'pem' })
            .toString(),
          jwtPublicKeyPath: null,
          jwtIssuer: 'metrics-test',
          jwtAudience: null,
          jwtClockToleranceSeconds: 0,
        }),
      )
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app?.close());

  it('serves the registry using its Prometheus media type and disables caching', async () => {
    const response = await request(app.getHttpServer())
      .get('/metrics')
      .set('Authorization', `Bearer ${token(['ROLE_ADMIN'])}`)
      .expect(200);
    expect(
      response.headers['content-type']
        .split(';')
        .map((part: string) => part.trim())
        .sort(),
    ).toEqual(
      prometheusMetrics.registry.contentType
        .split(';')
        .map((part) => part.trim())
        .sort(),
    );
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).toContain('# TYPE lila_active_rooms gauge');
  });

  it.each([
    ['missing', undefined, 401],
    ['malformed', 'invalid-token', 401],
    ['expired', token(['ROLE_ADMIN'], -60), 401],
    ['non-admin', token(['ROLE_USER']), 403],
  ])(
    'refuses %s credentials without exposing the registry',
    async (_label, credential, status) => {
      const call = request(app.getHttpServer()).get('/metrics');
      if (credential) call.set('Authorization', `Bearer ${credential}`);
      const response = await call.expect(Number(status));
      expect(response.text).not.toContain('# TYPE lila_active_rooms');
    },
  );
});
