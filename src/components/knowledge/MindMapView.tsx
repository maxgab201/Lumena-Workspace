import { Button } from '../ui/Button';
import { Network } from 'lucide-react';

interface MindMapViewProps {
  documentId: string;
}

export const MindMapView = ({ documentId: _documentId }: MindMapViewProps) => {
  return (
    <div className="flex flex-col h-full items-center justify-center p-6 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
        <Network className="w-8 h-8 text-accent" />
      </div>
      <div>
        <h3 className="font-semibold text-lg mb-1">Mind Maps</h3>
        <p className="text-sm text-muted-foreground">
          Visual document connections are coming soon.
        </p>
      </div>
      <Button variant="outline" disabled>Generate Map (Coming Soon)</Button>
    </div>
  );
};
