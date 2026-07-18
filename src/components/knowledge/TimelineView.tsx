import { Button } from '../ui/Button';
import { Clock } from 'lucide-react';

interface TimelineViewProps {
  documentId: string;
  workspaceId: string;
}

export const TimelineView = ({ documentId: _documentId, workspaceId: _workspaceId }: TimelineViewProps) => {
  return (
    <div className="flex flex-col h-full items-center justify-center p-6 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
        <Clock className="w-8 h-8 text-accent" />
      </div>
      <div>
        <h3 className="font-semibold text-lg mb-1">Timeline</h3>
        <p className="text-sm text-muted-foreground">
          Chronological event extraction is coming soon.
        </p>
      </div>
      <Button variant="outline" disabled>Extract Events (Coming Soon)</Button>
    </div>
  );
};
