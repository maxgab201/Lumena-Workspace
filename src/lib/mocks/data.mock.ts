import type { User, Workspace, Document, Credits, Notification } from '../../types';

export const mockUser: User = {
  id: 'usr_123',
  email: 'demo@lumena.app',
  name: 'Demo User',
  created_at: new Date().toISOString(),
};

export const mockWorkspaces: Workspace[] = [
  {
    id: 'ws_1',
    name: 'Machine Learning Concepts',
    description: 'Research papers and notes on ML',
    user_id: 'usr_123',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'ws_2',
    name: 'Finance & Markets',
    user_id: 'usr_123',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  }
];

export const mockDocuments: Document[] = [
  {
    id: 'doc_1',
    workspace_id: 'ws_1',
    name: 'Attention Is All You Need.pdf',
    file_url: '#',
    status: 'ready',
    page_count: 15,
    created_at: new Date(Date.now() - 86400000).toISOString(),
  }
];

export const mockCredits: Credits = {
  user_id: 'usr_123',
  available: 45,
  used: 5,
  limit: 50,
};

export const mockNotifications: Notification[] = [
  {
    id: 'notif_1',
    title: 'Welcome to Lumena',
    message: 'Your account is ready. Start by creating a workspace.',
    read: false,
    type: 'info',
    created_at: new Date().toISOString(),
  }
];
