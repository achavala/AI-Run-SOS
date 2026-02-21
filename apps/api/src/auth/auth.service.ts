import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.signToken(user);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async register(input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
  }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const existing = await this.prisma.user.findUnique({
      where: {
        tenantId_email: { tenantId: input.tenantId, email: input.email },
      },
    });
    if (existing) {
      throw new ConflictException('Email already registered in this tenant');
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        tenantId: input.tenantId,
        email: input.email,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role as any,
      },
    });

    const token = this.signToken(user);

    return {
      accessToken: token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }

  async createTenant(input: {
    name: string;
    domain?: string;
    adminEmail: string;
    adminPassword: string;
    adminFirstName: string;
    adminLastName: string;
  }) {
    if (input.domain) {
      const existing = await this.prisma.tenant.findUnique({
        where: { domain: input.domain },
      });
      if (existing) {
        throw new ConflictException('Domain already in use');
      }
    }

    const passwordHash = await bcrypt.hash(input.adminPassword, SALT_ROUNDS);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: input.name,
        domain: input.domain,
        users: {
          create: {
            email: input.adminEmail,
            passwordHash,
            firstName: input.adminFirstName,
            lastName: input.adminLastName,
            role: 'MANAGEMENT',
          },
        },
      },
      include: { users: true },
    });

    const admin = tenant.users[0]!;
    const token = this.signToken(admin);

    return {
      accessToken: token,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        domain: tenant.domain,
      },
      user: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        tenantId: admin.tenantId,
      },
    };
  }

  private signToken(user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  }): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    });
  }
}
