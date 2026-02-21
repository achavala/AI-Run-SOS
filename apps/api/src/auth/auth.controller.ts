import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('register')
  async register(
    @Body()
    body: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: string;
      tenantId: string;
    },
  ) {
    return this.authService.register(body);
  }

  @Post('tenant')
  async createTenant(
    @Body()
    body: {
      name: string;
      domain?: string;
      adminEmail: string;
      adminPassword: string;
      adminFirstName: string;
      adminLastName: string;
    },
  ) {
    return this.authService.createTenant(body);
  }
}
