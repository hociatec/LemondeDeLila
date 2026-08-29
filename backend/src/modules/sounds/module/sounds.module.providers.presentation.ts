import { SoundsController } from '../infrastructure/presentation/http/controllers/sounds.controller';
import { AdminSoundsController } from '../infrastructure/presentation/http/controllers/admin-sounds.controller';

export const SOUNDS_PRESENTATION_CONTROLLERS = [
  SoundsController,
  AdminSoundsController,
];
