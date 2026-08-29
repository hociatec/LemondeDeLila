import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  HttpJwtPayload,
  JwtPayloadVerifierService,
} from '../../../application/services/jwt-payload-verifier.service';

@Injectable()
export class HttpJwtGuard implements CanActivate {
  constructor(private readonly verifier: JwtPayloadVerifierService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearer(request.headers);
    const payload = this.verifier.verifyHttpToken(token);
    request.user = payload;
    return true;
  }

  private extractBearer(headers: Record<string, unknown> | undefined): string {
    if (!headers) {
      throw new UnauthorizedException('Authorization requise');
    }
    const authHeader = (headers['authorization'] ||
      headers['Authorization']) as string | undefined;
    if (!authHeader || typeof authHeader !== 'string') {
      throw new UnauthorizedException('Authorization requise');
    }
    const parts = authHeader.split(' ');
    if (
      parts.length !== 2 ||
      parts[0].toLowerCase() !== 'bearer' ||
      !parts[1]
    ) {
      throw new UnauthorizedException('Authorization Bearer invalide');
    }
    return parts[1];
  }
}

type RequestWithUser = Request & { user?: HttpJwtPayload };
