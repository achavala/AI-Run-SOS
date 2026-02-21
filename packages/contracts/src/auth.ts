import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum([
    'MANAGEMENT', 'CONSULTANT', 'RECRUITMENT', 'SALES',
    'HR', 'IMMIGRATION', 'ACCOUNTS',
  ]),
  tenantId: z.string().optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const CreateTenantSchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().optional(),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8),
  adminFirstName: z.string().min(1),
  adminLastName: z.string().min(1),
});
export type CreateTenantInput = z.infer<typeof CreateTenantSchema>;

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  tenantId: string;
  iat?: number;
  exp?: number;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
  };
}
