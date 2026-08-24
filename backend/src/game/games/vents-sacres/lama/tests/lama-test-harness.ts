import { LamaService } from '../application/services/lama.service';
import { createLamaRuntime } from '../lama.runtime';

export const createLamaServiceForTest = (): { service: LamaService } => {
  return createLamaRuntime();
};


