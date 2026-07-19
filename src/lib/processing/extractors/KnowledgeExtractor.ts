import { AIGateway } from '../../providers/AIGateway';

export class KnowledgeExtractor {
  static async extractFlashcards(text: string): Promise<{ front: string; back: string }[]> {
    try {
      const prompt = `Extract 3 flashcards from the following text. Respond strictly in JSON format as an array of objects with "front" and "back" keys.\n\nText: ${text}`;
      const response = await AIGateway.generate(prompt);
      
      const jsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('[KnowledgeExtractor] Flashcard extraction failed:', e);
      // Fallback mock
      return [
        { front: 'What is the main topic?', back: 'Document context is required.' },
        { front: 'Key term 1', back: 'Definition 1' }
      ];
    }
  }

  static async extractGlossary(text: string): Promise<{ term: string; definition: string }[]> {
    try {
      const prompt = `Extract 3 glossary terms from the following text. Respond strictly in JSON format as an array of objects with "term" and "definition" keys.\n\nText: ${text}`;
      const response = await AIGateway.generate(prompt);
      
      const jsonStr = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('[KnowledgeExtractor] Glossary extraction failed:', e);
      // Fallback mock
      return [
        { term: 'Term A', definition: 'Definition A' },
        { term: 'Term B', definition: 'Definition B' }
      ];
    }
  }
}
