export interface AuthUser {
  userId: number;
  username: string;
  fullName: string;
  roles: string[];
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: AuthUser;
}

/** Sesión derivada del JWT + la respuesta de login. */
export interface Session {
  userId: number;
  username: string;
  fullName: string;
  roles: string[];
  permissions: string[];
}
