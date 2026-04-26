import "express-session";

declare module "express-session" {
  interface SessionData {
    admin?: {
      authenticated?: boolean;
      email?: string;
      role?: string;
      loggedInAt?: string;
      [key: string]: unknown;
    };
  }
}
