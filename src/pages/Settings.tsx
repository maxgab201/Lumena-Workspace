import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';

export const Settings = () => {
  return (
    <PageContainer>
      <header>
        <h1 className="text-3xl font-heading font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account preferences.</p>
      </header>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Update your personal information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1">
              <label className="text-sm font-medium">Name</label>
              <div className="h-10 w-full md:w-1/2 rounded-lg border border-white/10 bg-background/30 backdrop-blur-sm px-3 py-2 text-sm text-muted-foreground flex items-center">
                User
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-sm font-medium">Email</label>
              <div className="h-10 w-full md:w-1/2 rounded-lg border border-white/10 bg-background/30 backdrop-blur-sm px-3 py-2 text-sm text-muted-foreground flex items-center">
                user@example.com
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
};
