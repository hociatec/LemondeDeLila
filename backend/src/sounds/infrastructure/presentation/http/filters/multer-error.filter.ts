import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterErrorFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const code = String(exception.code ?? '').trim();
    const status = code === 'LIMIT_FILE_SIZE' ? 413 : 400;

    const message =
      code === 'LIMIT_FILE_SIZE'
        ? "Fichier trop volumineux (limite d'upload atteinte)."
        : (exception.message || '').trim() || 'Upload invalide.';

    response.status(status).json({
      statusCode: status,
      message,
      error: status === 413 ? 'Payload Too Large' : 'Bad Request',
    });
  }
}
