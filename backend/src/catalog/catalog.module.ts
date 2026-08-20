import { Module } from '@nestjs/common';
import { CatalogWsRegistrar } from './ws/catalog-ws.registrar';
import {
  CATALOG_MODULE_EXPORTS,
  CATALOG_MODULE_IMPORTS,
  CATALOG_MODULE_PROVIDERS,
} from './module/catalog.module.definition';

@Module({
  imports: CATALOG_MODULE_IMPORTS,
  providers: CATALOG_MODULE_PROVIDERS,
  exports: CATALOG_MODULE_EXPORTS,
})
export class CatalogModule {
  constructor(private readonly wsRegistrar: CatalogWsRegistrar) {
    void this.wsRegistrar;
  }
}
