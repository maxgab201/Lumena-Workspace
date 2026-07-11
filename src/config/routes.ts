export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  DASHBOARD: '/dashboard',
  VIEWER: '/viewer/:documentId',
  SETTINGS: '/settings',
  BILLING: '/billing',
  LEGAL: '/legal',
  NOT_FOUND: '*',
} as const;

export type RouteKey = keyof typeof ROUTES;
