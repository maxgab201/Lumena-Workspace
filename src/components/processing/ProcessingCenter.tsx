import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useWorkspaceStore } from '../../stores/workspaceStore';

export const ProcessingCenter: React.FC = () => {
  const documents = useWorkspaceStore((state) => state.documents);
  const activeJobs = documents.filter(d => ['uploading', 'processing'].includes(d.status || ''));

  if (activeJobs.length === 0) return null;

  return (
    <Card className="w-full bg-slate-900/50 border-slate-700/50 backdrop-blur-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-slate-200 font-medium">Processing Center</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeJobs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/30">
              
              <div className="flex flex-col flex-grow mr-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-slate-300">
                    {doc.name}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getStatusColor(doc.status || 'processing')}`}>
                    {doc.status}
                  </span>
                </div>
                
                <div className="mt-2 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300 ease-in-out" 
                    style={{ width: `${Math.max(doc.progress || 0, 2)}%` }}
                  />
                </div>
              </div>
              
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

function getStatusColor(status: string) {
  switch (status) {
    case 'uploading': return 'bg-slate-600 text-slate-200';
    case 'processing': return 'bg-blue-900/50 text-blue-300 border border-blue-700/50';
    case 'error': return 'bg-red-900/50 text-red-300 border border-red-700/50';
    default: return 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50';
  }
}
