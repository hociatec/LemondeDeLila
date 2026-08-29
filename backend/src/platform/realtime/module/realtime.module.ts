import { type DynamicModule, Module, type Type } from '@nestjs/common';
import {
  CLIENT_VERSION_POLICY,
  type ClientVersionPolicy,
} from '../application/ports/client-version-policy.port';
import { REALTIME_CORE_PROVIDERS } from './realtime.module.providers.core';
import { REALTIME_PRESENTATION_PROVIDERS } from './realtime.module.providers.presentation';

export type RealtimeModuleOptions = {
  imports?: DynamicModule['imports'];
  clientVersionPolicy: Type<ClientVersionPolicy>;
};

@Module({})
export class RealtimeModule {
  static register(options: RealtimeModuleOptions): DynamicModule {
    return {
      module: RealtimeModule,
      imports: options.imports ?? [],
      providers: [
        ...REALTIME_CORE_PROVIDERS,
        ...REALTIME_PRESENTATION_PROVIDERS,
        {
          provide: CLIENT_VERSION_POLICY,
          useExisting: options.clientVersionPolicy,
        },
      ],
    };
  }
}
