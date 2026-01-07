import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwksController } from './jwks.controller';

@Module({
  imports: [ConfigModule],
  controllers: [JwksController],
})
export class JwksModule {}
