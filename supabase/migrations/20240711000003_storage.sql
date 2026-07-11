-- Insert workspace_documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace_documents',
  'workspace_documents',
  false, -- private bucket
  52428800, -- 50MB in bytes
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage.objects
-- Note: The bucket_id is 'workspace_documents'
-- The file path convention will be: workspace_id/document_id.pdf
-- So we can extract the workspace_id from the first part of the path to enforce RLS.

-- Select Policy
CREATE POLICY "Users can read files in their workspaces"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'workspace_documents' AND
  (storage.foldername(name))[1]::uuid IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Insert Policy
CREATE POLICY "Users can upload files to their workspaces"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'workspace_documents' AND
  (storage.foldername(name))[1]::uuid IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);

-- Delete Policy
CREATE POLICY "Users can delete files in their workspaces"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'workspace_documents' AND
  (storage.foldername(name))[1]::uuid IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  )
);
