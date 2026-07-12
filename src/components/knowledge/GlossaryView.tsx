import { useState } from 'react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import { Button } from '../ui/Button';
import { Plus } from 'lucide-react';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';

interface GlossaryViewProps {
  documentId: string;
}

export const GlossaryView = ({ documentId }: GlossaryViewProps) => {
  const { glossary, addGlossaryTerm } = useKnowledgeStore();
  const [isAdding, setIsAdding] = useState(false);
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');

  const docTerms = glossary[documentId] || [];

  const handleSave = () => {
    if (!term.trim() || !definition.trim()) return;
    addGlossaryTerm(documentId, { term: term.trim(), definition: definition.trim() });
    setTerm('');
    setDefinition('');
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {docTerms.length === 0 && !isAdding ? (
          <div className="text-center text-muted-foreground mt-8 text-sm">
            No glossary terms yet. Create one or extract from document.
          </div>
        ) : (
          docTerms.map((item) => (
            <div key={item.id} className="p-3 bg-white/5 border border-white/10 rounded-lg">
              <h4 className="font-medium text-accent mb-1">{item.term}</h4>
              <p className="text-sm text-muted-foreground">{item.definition}</p>
            </div>
          ))
        )}

        {isAdding && (
          <div className="p-3 bg-white/5 border border-white/10 rounded-lg space-y-3" data-testid="new-glossary-form">
            <Input 
              placeholder="Term..." 
              value={term} 
              onChange={(e) => setTerm(e.target.value)}
              className="bg-background/50 text-sm"
              data-testid="glossary-term-input"
            />
            <Textarea 
              placeholder="Definition..." 
              value={definition} 
              onChange={(e) => setDefinition(e.target.value)}
              className="bg-background/50 text-sm resize-none"
              rows={3}
              data-testid="glossary-definition-input"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} data-testid="save-glossary-btn">Save</Button>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-white/10 bg-background/50">
        {!isAdding && (
          <Button 
            className="w-full" 
            variant="outline" 
            onClick={() => setIsAdding(true)}
            data-testid="add-glossary-btn"
          >
            <Plus className="w-4 h-4 mr-2" /> Add Term
          </Button>
        )}
      </div>
    </div>
  );
};
