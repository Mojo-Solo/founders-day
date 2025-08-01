export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'volunteer' | 'user';
  permissions?: string[];
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}