import { Controller, Post, UseInterceptors } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { ThrottlerModule, type ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { createRateLimitOptions } from '../../platform/config/rate-limit-options.factory';
import { AppPlatformModule } from './app-platform.module';

const receiveFile = jest.fn();

@Controller('quota-upload')
class UploadProbeController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 1024 },
      fileFilter: (_request, _file, callback) => {
        receiveFile();
        callback(null, true);
      },
    }),
  )
  upload() {
    return { ok: true };
  }
}

it('shares the production HTTP quota across instances and rejects before accepting an upload', async () => {
  const counts = new Map<string, number>();
  const storage: ThrottlerStorage = {
    increment: async (key, _ttl, limit) => {
      const totalHits = (counts.get(key) ?? 0) + 1;
      counts.set(key, totalHits);
      return {
        totalHits,
        isBlocked: totalHits > limit,
        timeToExpire: 60,
        timeToBlockExpire: 60,
      };
    },
  };
  const config = new ConfigService({ RATE_LIMIT_COUNT: 2, RATE_LIMIT_TTL: 60 });
  // Read the application's actual global guards; removing the guard breaks this test.
  const providers = Reflect.getMetadata(
    MODULE_METADATA.PROVIDERS,
    AppPlatformModule,
  );
  const create = async () => {
    const module = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot(createRateLimitOptions(config, storage)),
      ],
      providers,
      controllers: [UploadProbeController],
    }).compile();
    const app = module.createNestApplication();
    await app.init();
    return app;
  };
  receiveFile.mockClear();
  const first = await create();
  const second = await create();
  try {
    await request(first.getHttpServer())
      .post('/quota-upload')
      .attach('file', Buffer.from('a'), 'a.txt')
      .expect(201);
    await request(second.getHttpServer())
      .post('/quota-upload')
      .attach('file', Buffer.from('b'), 'b.txt')
      .expect(201);
    await request(first.getHttpServer())
      .post('/quota-upload')
      .attach('file', Buffer.from('c'), 'c.txt')
      .expect(429);
    expect(receiveFile).toHaveBeenCalledTimes(2);
  } finally {
    await first.close();
    await second.close();
  }
});
