import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const Billing = () => {
  return (
    <PageContainer>
      <header>
        <h1 className="text-3xl font-heading font-semibold tracking-tight">Billing & Credits</h1>
        <p className="text-muted-foreground mt-1">Manage your plan and monitor usage.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-accent shadow-sm shadow-accent/10">
          <CardHeader>
            <CardTitle>Current Plan: Free</CardTitle>
            <CardDescription>You are currently on the free tier.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold mb-1">$0<span className="text-lg text-muted-foreground font-normal">/mo</span></div>
            <ul className="text-sm text-muted-foreground space-y-2 mt-4">
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-accent" /> 50 AI Queries / month
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-accent" /> 3 Workspaces
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full">Upgrade to Pro</Button>
          </CardFooter>
        </Card>
      </div>
    </PageContainer>
  );
};

function CheckIcon(props: any) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
