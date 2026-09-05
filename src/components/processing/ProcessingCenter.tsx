import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { getDocumentStage, isDocumentActive, type DocumentStage } from '../../types/documents';
import { t } from '../../i18n';

function getStageLabel(stage: DocumentStage): string {
  switch (stage) {
    case 'uploading': return t('document.status.uploading');
    case 'uploaded': return t('document.status.uploaded');
    case 'processing': return t('document.status.processing');
    case 'ocr': return t('document.status.ocr');
    case 'analyzing': return t('document.status.analyzing');
    case 'ready': return t('document.status.ready');
    case 'failed': return t('document.status.failed');
  }
}

export const ProcessingCenter: React.FC = () => {
  const documents = useWorkspaceStore((state) => state.documents);
  const activeJobs = documents.filter(isDocumentActive);

  if (activeJobs.length === 0) return null;

  return (
    <Card className="w-full bg-slate-900/50 border-slate-700/50 backdrop-blur-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-slate-200 font-medium">{t('processing.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeJobs.map((doc) => {
            const stage = getDocumentStage(doc);
            return (
            <div key={doc.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg border border-slate-700/30" aria-label={`${doc.name}: ${getStageLabel(stage)}`}>
              
              <div className="flex flex-col flex-grow mr-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-slate-300">
                    {doc.name}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(stage)}`}>
                    {getStageLabel(stage)}
                  </span>
                </div>
                
                <div className="mt-2 h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300 ease-in-out" 
                    style={{ width: `${Math.max(doc.progress ?? 0, 2)}%` }}
                  />
                </div>
              </div>
              
            </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

function getStatusColor(status: DocumentStage) {
  switch (status) {
    case 'uploading': return 'bg-slate-600 text-slate-200';
    case 'uploaded': return 'bg-blue-900/50 text-blue-300 border border-blue-700/50';
    case 'processing': return 'bg-blue-900/50 text-blue-300 border border-blue-700/50';
    case 'failed': return 'bg-red-900/50 text-red-300 border border-red-700/50';
    case 'ocr': return 'bg-violet-900/50 text-violet-300 border border-violet-700/50';
    case 'analyzing': return 'bg-cyan-900/50 text-cyan-300 border border-cyan-700/50';
    case 'ready': return 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50';
  }
}
