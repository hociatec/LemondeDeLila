import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import jsonwebtoken from 'jsonwebtoken';
import {
  getJwtVerifyAlgorithms,
  requireJwtVerifyKey,
} from '../auth/jwt-config';

@Injectable()
export class HttpJwtGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = this.extractBearer(request.headers);
    const payload = this.verify(token);
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

  private verify(token: string): JwtPayloadBase {
    const key = requireJwtVerifyKey(this.config);
    const issuer = this.config.get<string>('JWT_ISSUER', 'le-monde-de-lila');
    const audienceRaw = this.config.get<string>('JWT_AUDIENCE');
    const audience =
      audienceRaw && typeof audienceRaw === 'string' && audienceRaw.trim()
        ? audienceRaw.trim()
        : undefined;
    const clockTolerance = this.config.get<number>(
      'JWT_CLOCK_TOLERANCE_SECONDS',
      10,
    );
    try {
      const verifyOptions: JwtVerifyOptions = {
        algorithms: getJwtVerifyAlgorithms(this.config),
        issuer,
        clockTolerance,
      };
      if (audience) {
        verifyOptions.audience = audience;
      }

      const payload = jwtVerify(token, key, verifyOptions);

      if (!payload || typeof payload !== 'object') {
        throw new UnauthorizedException('Token invalide');
      }
      const typedPayload = payload as Partial<JwtPayloadBase>;
      if (
        typeof typedPayload.sub !== 'string' ||
        !typedPayload.sub.trim() ||
        typeof typedPayload.exp !== 'number' ||
        typeof typedPayload.iat !== 'number'
      ) {
        throw new UnauthorizedException('Token invalide');
      }
      return typedPayload as JwtPayloadBase;
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
  }
}

type JwtPayloadBase = {
  sub: string;
  exp: number;
  iat: number;
};

type JwtVerifyOptions = {
  algorithms?: string[];
  issuer?: string;
  audience?: string;
  clockTolerance?: number;
};

type JwtVerifier = (
  token: string,
  key: string | Buffer,
  options: JwtVerifyOptions,
) => unknown;

const jwtVerify = (jsonwebtoken as unknown as { verify: JwtVerifier }).verify;

type RequestWithUser = Request & { user?: JwtPayloadBase };
