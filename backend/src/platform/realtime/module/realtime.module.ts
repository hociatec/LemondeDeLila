import { type DynamicModule, Module, type Type } from '@nestjs/common';
import {
  CLIENT_VERSION_READER,
  type ClientVersionReader,
} from '../application/ports/client-version-reader.port';
import { REALTIME_CORE_PROVIDERS } from './realtime.module.providers.core';
import { REALTIME_PRESENTATION_PROVIDERS } from './realtime.module.providers.presentation';
import { BusinessClockModule } from '../../time/public-api';

export type RealtimeModuleOptions = {
  imports?: DynamicModule['imports'];
  clientVersionReader: Type<ClientVersionReader>;
};

@Module({})
export class RealtimeModule {
  static register(options: RealtimeModuleOptions): DynamicModule {
    return {
      module: RealtimeModule,
      imports: [BusinessClockModule, ...(options.imports ?? [])],
      providers: [
        ...REALTIME_CORE_PROVIDERS,
        ...REALTIME_PRESENTATION_PROVIDERS,
        {
          provide: CLIENT_VERSION_READER,
          useExisting: options.clientVersionReader,
        },
      ],
    };
  }
}
