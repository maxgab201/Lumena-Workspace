export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  DASHBOARD: '/dashboard',
  SETTINGS: '/settings',
  BILLING: '/billing',
  LEGAL: '/legal',
  NOT_FOUND: '*',
} as const;

export type RouteKey = keyof typeof ROUTES;
