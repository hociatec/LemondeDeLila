import { Module } from '@nestjs/common';
import { AdminWsRegistrar } from './infrastructure/presentation/ws/admin-ws.registrar';
import {
  ADMIN_MODULE_CONTROLLERS,
  ADMIN_MODULE_IMPORTS,
  ADMIN_MODULE_PROVIDERS,
} from './admin.module.definition';

@Module({
  imports: ADMIN_MODULE_IMPORTS,
  controllers: ADMIN_MODULE_CONTROLLERS,
  providers: ADMIN_MODULE_PROVIDERS,
})
export class AdminModule {
  // Force eager instantiation of the WS registrar so its `onModuleInit()` runs and
  // admin WS message types get registered in the global `WsRouteRegistry`.
  constructor(private readonly wsRegistrar: AdminWsRegistrar) {
    void this.wsRegistrar;
  }
}


