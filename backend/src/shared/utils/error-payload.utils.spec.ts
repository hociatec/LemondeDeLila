import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { getErrorPayload } from './error-payload.utils';

describe('getErrorPayload', () => {
  it('exposes declared domain errors and safe 4xx messages', () => {
    expect(
      getErrorPayload({
        presentToClient: 'code',
        code: 'ROOM_FORBIDDEN',
        details: { roomId: 2 },
      }),
    ).toEqual({ code: 'ROOM_FORBIDDEN', params: { roomId: 2 } });
    expect(
      getErrorPayload(new BadRequestException('Payload invalide')),
    ).toEqual({ message: 'Payload invalide' });
  });

  it('never exposes infrastructure and server error details', () => {
    expect(
      getErrorPayload(new Error('ER_DUP_ENTRY users_password_secret')),
    ).toEqual({ message: 'Erreur inconnue' });
    expect(
      getErrorPayload(new InternalServerErrorException('stack and SQL')),
    ).toEqual({ message: 'Erreur inconnue' });
  });
});
