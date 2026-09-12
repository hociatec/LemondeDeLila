import { BusinessClockModule } from '../../../platform/time/public-api';
import { VAULT_MODULE_IMPORTS } from './vault.module.imports';

it('imports the business clock required by snapshot writes', () => {
  expect(VAULT_MODULE_IMPORTS).toContain(BusinessClockModule);
});
