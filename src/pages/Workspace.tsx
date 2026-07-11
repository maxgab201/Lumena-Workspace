import { PageContainer } from '../components/ui/PageContainer';
import { Card } from '../components/ui/Card';

export const Workspace = () => {
  return (
    <PageContainer className="h-full flex flex-col space-y-4 p-4 md:p-6 overflow-hidden">
      <header className="flex items-center justify-between shrink-0">
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Active Workspace</h1>
      </header>
      <div className="flex-1 flex gap-4 min-h-0">
        {/* PDF Viewer Placeholder */}
        <Card className="flex-[2] bg-card/50 flex items-center justify-center border-dashed">
          <span className="text-muted-foreground font-medium">PDF Viewer Area</span>
        </Card>
        {/* Chat / Tools Placeholder */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <div className="h-12 border-b border-border flex items-center px-4 shrink-0 bg-secondary/30">
            <span className="text-sm font-medium">Knowledge Assistant</span>
          </div>
          <div className="flex-1 flex items-center justify-center bg-card">
            <span className="text-muted-foreground text-sm">AI Chat & Tools</span>
          </div>
        </Card>
      </div>
    </PageContainer>
  );
};
