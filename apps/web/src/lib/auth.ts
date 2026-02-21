import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole =
  | 'MANAGEMENT'
  | 'CONSULTANT'
  | 'RECRUITMENT'
  | 'SALES'
  | 'HR'
  | 'IMMIGRATION'
  | 'ACCOUNTS'
  | 'SUPERADMIN';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token: string, user: AuthUser) =>
        set({ token, user, isAuthenticated: true }),

      logout: () =>
        set({ token: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'sos-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

export function getRoleDashboardPath(role: UserRole): string {
  switch (role) {
    case 'MANAGEMENT':
    case 'SUPERADMIN':
      return '/dashboard/command-center';
    case 'RECRUITMENT':
      return '/dashboard/recruitment';
    case 'SALES':
      return '/dashboard/sales';
    case 'ACCOUNTS':
      return '/dashboard/accounts';
    case 'CONSULTANT':
      return '/dashboard/consultants';
    case 'HR':
      return '/dashboard/consultants';
    case 'IMMIGRATION':
      return '/dashboard/consultants';
    default:
      return '/dashboard/command-center';
  }
}
