import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class HttpJwtGuard implements CanActivate {
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
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
      throw new UnauthorizedException('Authorization Bearer invalide');
    }
    return parts[1];
  }

  private verify(token: string): unknown {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('Configuration JWT manquante');
    }
    try {
      return jwt.verify(token, secret);
    } catch {
      throw new UnauthorizedException('Token invalide');
    }
  }
}
