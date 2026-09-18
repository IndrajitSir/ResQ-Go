import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request } from '@nestjs/common';
import { loginSchema, registerSchema, type LoginDto, type RegisterDto } from '@abs/contracts';
import { Public } from '../common/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService, type AuthResult } from './auth.service';
import type { Request as ExpressRequest } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) dto: RegisterDto,
  ): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Request() request: ExpressRequest,
  ): Promise<AuthResult> {
    const ip = request.ip ?? 'unknown';
    return this.authService.login(dto, ip);
  }

  @Get('me')
  async me(@Request() request: ExpressRequest): Promise<Awaited<ReturnType<AuthService['me']>>> {
    return this.authService.me(request.user!.publicId);
  }
}
