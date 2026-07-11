export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  DASHBOARD: '/dashboard',
  WORKSPACE: '/workspace',
  SETTINGS: '/settings',
  BILLING: '/billing',
  LEGAL: '/legal',
  NOT_FOUND: '*',
} as const;

export type RouteKey = keyof typeof ROUTES;
