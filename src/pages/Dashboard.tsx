import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FileText, Clock, File, Search, Plus, ArrowUpRight } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useUserStore } from '../stores/userStore';

export const Dashboard = () => {
  const { workspaces, documents } = useWorkspaceStore();
  const { user } = useUserStore();

  return (
    <PageContainer>
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl font-heading font-semibold tracking-tight text-foreground">Overview</h1>
          <p className="text-muted-foreground mt-1 text-sm">Welcome back, {user?.name}.</p>
        </div>
        <Button className="shadow-lg shadow-accent/20">
          <Plus className="w-4 h-4 mr-2" />
          New Workspace
        </Button>
      </header>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard title="Active Workspaces" value={workspaces.length.toString()} subtitle="+1 from last month" icon={<FolderIcon className="w-4 h-4" />} />
        <MetricCard title="Documents Analyzed" value={documents.length.toString()} subtitle="Recently processed" icon={<FileText className="w-4 h-4" />} />
        <MetricCard title="Hours Saved" value="14.5" subtitle="Estimated based on reading speed" icon={<Clock className="w-4 h-4" />} />
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {/* Recent Activity */}
        <div className="md:col-span-2 space-y-4">
           <div className="flex items-center justify-between">
              <h2 className="text-lg font-heading font-semibold tracking-tight">Recent Documents</h2>
              <Button variant="ghost" size="sm" className="text-xs">View all</Button>
           </div>
           <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="group flex items-center justify-between p-4 rounded-xl border border-white/5 bg-card/50 hover:bg-secondary/50 transition-colors cursor-pointer">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                         <File className="w-5 h-5" />
                      </div>
                      <div>
                         <p className="font-medium text-sm group-hover:text-accent transition-colors">{doc.name}</p>
                         <p className="text-xs text-muted-foreground mt-0.5">Status: {doc.status}</p>
                      </div>
                   </div>
                   <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
           </div>
        </div>

        {/* Quick Tools */}
        <div className="space-y-4">
           <h2 className="text-lg font-heading font-semibold tracking-tight">Quick Tools</h2>
           <Card className="bg-gradient-to-br from-card to-card/50 border-white/5 shadow-md">
              <CardContent className="p-4 space-y-4">
                 <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input 
                      placeholder="Search across documents..." 
                      className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-shadow"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="w-full text-xs h-9 justify-start border-white/5 hover:border-accent/30"><FileText className="w-3 h-3 mr-2"/> Summarize</Button>
                    <Button variant="outline" className="w-full text-xs h-9 justify-start border-white/5 hover:border-accent/30"><Clock className="w-3 h-3 mr-2"/> Quiz Prep</Button>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </PageContainer>
  );
};

function MetricCard({ title, value, subtitle, icon }: any) {
  return (
    <Card className="overflow-hidden border-white/5 shadow-sm hover:shadow-md transition-shadow bg-card/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 bg-secondary/50 rounded-md text-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight text-foreground">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function FolderIcon(props: any) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  )
}
