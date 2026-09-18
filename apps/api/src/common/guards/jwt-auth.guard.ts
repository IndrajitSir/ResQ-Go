import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenPayload } from '@abs/contracts';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

const BEARER_PREFIX = 'Bearer ';

/** Verifies the Bearer token and attaches {publicId, role} to the request. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    // Accept token from Authorization header (normal API calls) or query param
    // (EventSource SSE connections cannot set custom headers).
    const header = request.headers['authorization'];
    let token: string | undefined;
    if (typeof header === 'string' && header.startsWith(BEARER_PREFIX)) {
      token = header.slice(BEARER_PREFIX.length).trim();
    } else if (typeof request.query?.token === 'string' && request.query.token !== '') {
      token = request.query.token;
    }
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
      request.user = { publicId: payload.sub, role: payload.role };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
