-- Migration: Add RLS policies for document_pages
-- NOTE: The document_pages table and UNIQUE constraint are created by
-- 20240725000001_add_analysis_tables.sql which runs AFTER this migration.
-- This file is kept for documentation but its content was moved into
-- 20240725000001_add_analysis_tables.sql to fix the ordering dependency.
-- This migration is now a no-op.

SELECT 1;
