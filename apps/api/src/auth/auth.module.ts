import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { requireEnv } from '@abs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: requireEnv('JWT_SECRET', process.env.JWT_SECRET),
      signOptions: {
        expiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
