import { GameRegistryModule } from '../../../game/composition-api';
import { BusinessClockModule } from '../../../platform/time/public-api';

export const CATALOG_MODULE_IMPORTS = [GameRegistryModule, BusinessClockModule];
