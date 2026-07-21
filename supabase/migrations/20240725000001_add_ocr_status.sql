-- Add ocr_status and extracted_text columns to documents table
-- This enables the real OCR processing flow

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS ocr_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS extracted_text TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.documents.ocr_status IS 'OCR processing status: pending, processing, completed, needs_client_ocr, failed';
COMMENT ON COLUMN public.documents.extracted_text IS 'Extracted text content from the document for AI processing';

-- Create index for filtering by OCR status
CREATE INDEX IF NOT EXISTS idx_documents_ocr_status ON public.documents(ocr_status);
