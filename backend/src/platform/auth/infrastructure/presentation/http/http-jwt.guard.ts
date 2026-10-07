import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  HttpJwtPayload,
  JwtPayloadVerifierService,
} from '../../../application/services/jwt-payload-verifier.service';
import {
  AUTH_ACCOUNT_READER,
  type AuthAccountReader,
} from '../../../application/ports/auth-account-reader.port';
import { validateAccountSession } from '../../../application/services/validate-account-session';

@Injectable()
export class HttpJwtGuard implements CanActivate {
  constructor(
    private readonly verifier: JwtPayloadVerifierService,
    @Inject(AUTH_ACCOUNT_READER) private readonly accounts: AuthAccountReader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearer(request.headers);
    const payload = this.verifier.verifyHttpToken(token);
    const account = await validateAccountSession(
      this.accounts,
      Number(payload.sub),
      payload.credentialVersion,
    );
    request.user = {
      ...payload,
      roles: account.roles,
      username: account.username,
      email: account.email,
    };
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
