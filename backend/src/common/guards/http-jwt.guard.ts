import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

type StrictJwtPayload = jwt.JwtPayload & {
  id?: number;
  username?: string;
  roles?: string[];
  email?: string;
};

@Injectable()
export class HttpJwtGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractBearer(request?.headers);
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

  private verify(token: string): unknown {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('Configuration JWT manquante');
    }
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
      const verifyOptions: jwt.VerifyOptions = {
        algorithms: ['HS256'],
        issuer,
        clockTolerance,
      };
      if (audience) {
        verifyOptions.audience = audience;
      }

      const payload = jwt.verify(token, secret, verifyOptions) as StrictJwtPayload;

      if (!payload || typeof payload !== 'object') {
        throw new UnauthorizedException('Token invalide');
      }
      if (
        typeof payload.sub !== 'string' ||
        !payload.sub.trim() ||
        typeof payload.exp !== 'number' ||
        typeof payload.iat !== 'number'
      ) {
        throw new UnauthorizedException('Token invalide');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
  }
}
