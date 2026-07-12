import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Play, Pause, XCircle, RotateCcw } from 'lucide-react';
import type { ProcessingJob } from '../../types/processing';
import { JobQueue } from '../../lib/processing/JobQueue';
import { EventBus } from '../../lib/processing/EventBus';

export const ProcessingCenter: React.FC = () => {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);

  useEffect(() => {
    // Initial load
    setJobs(JobQueue.getAllJobs());

    // Listen for updates
    const handleStatusChange = () => {
      setJobs([...JobQueue.getAllJobs()]); // Clone to trigger re-render
    };

    EventBus.on('JobStatusChanged', handleStatusChange);

    return () => {
      EventBus.off('JobStatusChanged', handleStatusChange);
    };
  }, []);

  if (jobs.length === 0) return null;

  return (
    <Card className="w-full bg-slate-900/50 border-slate-700/50 backdrop-blur-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-slate-200 font-medium">Processing Center</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {jobs.map((job, index) => (
            <div key={job.id || `job-${index}`} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/30">
              
              <div className="flex flex-col flex-grow mr-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-slate-300">
                    Document {job.document_id?.slice(0, 6) ?? 'Unknown'}...
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                
                <div className="mt-2 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300 ease-in-out" 
                    style={{ width: `${Math.max(job.progress, 2)}%` }}
                  />
                </div>
              </div>

              <div className="flex space-x-1 shrink-0">
                {job.status === 'paused' ? (
                  <Button size="icon" variant="ghost" onClick={() => JobQueue.resume(job.id)} className="h-8 w-8 text-slate-400 hover:text-green-400">
                    <Play className="h-4 w-4" />
                  </Button>
                ) : (
                  ['queued', 'inspecting', 'extracting', 'ocr', 'layout'].includes(job.status) && (
                    <Button size="icon" variant="ghost" onClick={() => JobQueue.pause(job.id)} className="h-8 w-8 text-slate-400 hover:text-amber-400">
                      <Pause className="h-4 w-4" />
                    </Button>
                  )
                )}

                {job.status === 'failed' && (
                  <Button size="icon" variant="ghost" onClick={() => JobQueue.retry(job.id)} className="h-8 w-8 text-slate-400 hover:text-blue-400">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}

                {!['completed', 'cancelled'].includes(job.status) && (
                  <Button size="icon" variant="ghost" onClick={() => JobQueue.cancel(job.id)} className="h-8 w-8 text-slate-400 hover:text-red-400">
                    <XCircle className="h-4 w-4" />
                  </Button>
                )}
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
    case 'queued': return 'bg-slate-600 text-slate-200';
    case 'inspecting': 
    case 'extracting': 
    case 'ocr': 
    case 'layout': 
      return 'bg-blue-900/50 text-blue-300 border border-blue-700/50';
    case 'completed': return 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50';
    case 'failed': return 'bg-red-900/50 text-red-300 border border-red-700/50';
    case 'retrying': return 'bg-amber-900/50 text-amber-300 border border-amber-700/50';
    case 'paused': return 'bg-slate-700 text-slate-300';
    case 'cancelled': return 'bg-slate-800 text-slate-400 line-through';
    default: return 'bg-slate-700 text-slate-300';
  }
}
