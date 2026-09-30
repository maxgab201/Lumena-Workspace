import { supabase } from '../lib/supabase';
import { DOCUMENTS_BUCKET } from '../config/storage';

const STORAGE_NOT_FOUND = 'The resource was not found';
const REMOVE_BATCH_SIZE = 100;

export const StorageRepository = {
  /**
   * Remove uploaded document objects AFTER their database rows are gone.
   *
   * The database is the source of truth: a row pointing at a missing PDF is a broken
   * document, whereas an orphaned object is only wasted space. So a failure here is
   * logged instead of failing the delete the user already saw succeed.
   */
  async removeDocumentObjects(paths: string[]): Promise<void> {
    for (let start = 0; start < paths.length; start += REMOVE_BATCH_SIZE) {
      const batch = paths.slice(start, start + REMOVE_BATCH_SIZE);
      const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).remove(batch);
      if (error && error.message !== STORAGE_NOT_FOUND) {
        console.error('[StorageRepository] Cleanup failed; objects left orphaned:', batch, error);
      }
    }
  },
};
