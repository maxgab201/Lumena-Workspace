                        Lumena Workspace

                           User
                             │
                             ▼
                     Frontend (React)
                             │
                             ▼
                     Backend API Layer
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
     AI Gateway         Workspace         Authentication
          │                  │                  │
          ▼                  ▼                  ▼
     AI Providers       PostgreSQL        OAuth Providers
          │
          ▼
 OCR → Analysis → Highlights → Cache

                 Object Storage
                      │
                      ▼
                    PDFs



# Lumena Workspace

Architecture Specification

Version: 0.1

Status: Draft

Last Updated: YYYY-MM-DD

---

# Table of Contents

1. Architecture Goals
2. High-Level Overview
3. Core Principles
4. Frontend Architecture
5. Backend Architecture
6. AI Gateway
7. OCR Pipeline
8. PDF Engine
9. Workspace Engine
10. Storage Architecture
11. Database
12. Authentication
13. Credits System
14. AI Providers
15. AI Models
16. Processing Pipeline
17. Cache Strategy
18. Background Jobs
19. Security Architecture
20. Observability
21. Deployment
22. Scalability
23. Future Extensions

---

# 1. Architecture Goals

Lumena Workspace is designed as a modular AI platform.

The architecture must remain maintainable, scalable and provider-independent.

Every subsystem must be replaceable without requiring a complete rewrite.

No component should directly depend on a specific AI provider.

The architecture should allow the platform to evolve over multiple years.

---

# 2. High-Level Overview

The platform consists of several independent layers.

User

↓

Frontend

↓

API Layer

↓

Business Logic

↓

AI Gateway

↓

Providers

↓

Storage

↓

Database

↓

Background Workers

Each layer has a single responsibility.

---

# 3. Core Principles

## Separation of Concerns

Every module has one responsibility.

UI never contains business logic.

Business logic never contains provider-specific implementations.

Providers never interact directly with the frontend.

---

## Replaceable Components

Every subsystem must be replaceable.

Examples:

OCR Engine

PDF Engine

Authentication

Payments

Storage

AI Providers

Vector Database

---

## Progressive Processing

Large documents are never fully processed by default.

The pipeline always follows:

Upload

↓

Inspect

↓

Extract

↓

Select

↓

Analyze

↓

Cache

↓

Reuse

---

## Provider Independence

No provider-specific logic should leak outside the AI Gateway.

Switching providers should require configuration rather than architectural changes.

---

# 4. Frontend Architecture

The frontend is responsible only for user interaction.

Responsibilities:

Workspace management

Document viewer

Chat interface

Highlight rendering

Authentication UI

Billing UI

Settings

Search

Notes

Mind Maps (future)

Flashcards (future)

No AI secrets are stored in the frontend.

---

# 5. Backend Architecture

The backend is responsible for:

Authentication

Authorization

Credits

Billing

OCR orchestration

AI orchestration

Caching

Rate limiting

Document processing

Storage access

Logging

Audit events

---

# 6. AI Gateway

The AI Gateway is the heart of the platform.

Its responsibilities include:

Provider routing

Model routing

Fallback handling

Streaming

Structured Outputs

Retries

Timeouts

Cost estimation

Credits calculation

Usage logging

Health monitoring

Circuit breakers

The frontend never communicates directly with providers.

---

# 7. OCR Pipeline

The OCR pipeline is provider-independent.

Possible stages:

Detect page type

↓

Digital text

↓

Extract directly

OR

Scanned page

↓

OCR

↓

Bounding Boxes

↓

Normalization

↓

Store

↓

Ready for AI

OCR should only execute when necessary.

---

# 8. PDF Engine

Responsibilities:

Rendering

Virtualization

Zoom

Selection

Annotations

Highlight overlays

Logical page mapping

Search

Navigation

Export

The original PDF must never be modified.

Highlights exist as overlay layers.

---

# 9. Workspace Engine

The Workspace represents the central object.

A Workspace contains:

Documents

Chat History

Highlights

Notes

Future AI artifacts

Credits usage

Settings

Permissions

The Workspace becomes the shared context for every AI interaction.

---

# 10. Storage Architecture

Different data types should be stored separately.

Raw Files

↓

Object Storage

Metadata

↓

Database

OCR Results

↓

Cache

Highlights

↓

Database

Temporary Processing

↓

Workers

---

# 11. Database

The database stores only structured information.

Examples:

Users

Workspaces

Documents

Pages

Highlights

Chats

Credits

Subscriptions

Settings

Logs

Future Knowledge Objects

The database should never store provider secrets.

---

# 12. Authentication

Authentication is handled independently.

Possible providers:

Google

GitHub

Magic Links

Future Enterprise SSO

Authorization must always be validated server-side.

---

# 13. Credits System

Credits are an internal currency.

The system should use a ledger architecture.

Every operation creates a transaction.

Operations:

Reserve

Consume

Refund

Expire

Purchase

Monthly Allocation

No operation should directly modify balances.

Balances are calculated from ledger entries.

---

# 14. AI Providers

Supported providers are abstracted.

Potential providers include:

OpenRouter

Google

NVIDIA

Groq

Fireworks

Together

DeepInfra

Future providers

Providers can be added without frontend changes.

---

# 15. AI Models

The model layer is independent.

Users may choose:

Automatic

Manual

Model availability depends on subscription tier.

The platform should expose only curated models.

---

# 16. Processing Pipeline

Upload

↓

Validation

↓

Virus Scan (future)

↓

Storage

↓

Metadata Extraction

↓

Page Detection

↓

OCR Decision

↓

Extraction

↓

AI Analysis

↓

Highlights

↓

Cache

↓

Ready

---

# 17. Cache Strategy

Cache exists at multiple levels.

Document Hash

↓

Page Hash

↓

OCR

↓

Highlights

↓

AI Responses

↓

Embeddings (future)

↓

Knowledge Graph (future)

Cache should minimize repeated AI calls.

---

# 18. Background Jobs

Long-running tasks should never block the UI.

Examples:

OCR

AI Analysis

Embedding generation

Podcast generation

Mind Maps

Infographics

Presentation generation

Email notifications

---

# 19. Security Architecture

The platform follows Zero Trust principles.

All uploads are untrusted.

All requests are authenticated.

All permissions are verified.

Secrets remain server-side.

Rate limiting applies globally.

Least privilege is enforced.

Audit logs should exist for sensitive operations.

---

# 20. Observability

Every subsystem should generate logs.

Examples:

Errors

Warnings

Credits

AI usage

Latency

Provider health

Fallbacks

Uploads

Failures

Retries

Metrics should support debugging without exposing user data.

---

# 21. Deployment

Frontend

↓

Vercel

Backend

↓

Serverless Functions

Storage

↓

Object Storage

Database

↓

Managed PostgreSQL

Background Workers

↓

Dedicated processing service

Every deployment must support Preview Environments.

---

# 22. Scalability

The architecture should support:

Millions of documents

Multiple AI providers

Horizontal scaling

Worker pools

Future mobile applications

Future desktop applications

Future APIs

Future enterprise customers

No architectural decision should prevent future scaling.

---

# 23. Future Extensions

The architecture should support future modules without redesign.

Examples:

Mind Maps

Flashcards

Podcasts

Infographics

Knowledge Graph

Presentation Generator

Study Assistant

Public API

Browser Extension

Desktop Application

Mobile Application

Collaborative Editing

Enterprise Features

Everything should integrate through the Workspace rather than creating isolated systems.

### Document Virtualization Layer

The PDF rendering engine uses a combination of \eact-pdf\ (PDF.js) for canvas and text rendering, and \@tanstack/react-virtual\ for document virtualization. This architecture guarantees smooth scrolling performance for documents exceeding 300 pages by only rendering the currently visible pages plus a small overscan buffer.

The \PDFPage\ component employs a strict Z-index layered design to accommodate the base PDF canvas alongside future interactive overlays:
- Layer 1: PDF Canvas (react-pdf)
- Layer 2: Text Layer (react-pdf)
- Layer 3: Annotation Layer (future)
- Layer 4: Highlight Layer (future)
- Layer 5: OCR Layer (future)
- Layer 6: Selection Layer (future)
- Layer 7: AI Overlay Layer (future)



---

# 24. Provider Framework

The Provider Framework abstracts away the concrete implementation of OCR, Layout, Vision, and AI processing from the core business logic.

## Goal
Lumena must never depend on a single processing engine. Adding a new OCR, Layout, Vision, or AI provider requires only creating a new provider class and registering it.

## Abstraction Layers
The framework defines generic interfaces for each capability:
- \OCRProvider\
- \LayoutProvider\
- \VisionProvider\
- \TextExtractor\
- \DocumentInspector\
- \AIProvider\

Every provider must implement a common lifecycle: \initialize()\, \dispose()\, \healthCheck()\, and \getMetadata()\.

## Provider Metadata & Results
Each provider exposes rich metadata, including hardware requirements, language support, average latency, estimated cost, quality/confidence scores, and priority. This metadata drives the Routing Engine.
Outputs are wrapped in a standardized \ProviderResult\ wrapper containing the data, confidence, execution time, and provider ID.

## Registry and Routing
The \ProviderRegistry\ acts as a central repository for all active providers. It supports runtime registration, enablement, and capability lookups.
The \ProviderRouter\ implements a dynamic selection engine. Given a \DocumentProfile\ (e.g. has images, has tables, requires offline processing), the router evaluates and scores all compatible providers, selecting the optimal one. No provider is hardcoded in the pipeline.

## Fallback Mechanism
The \ProviderFallback\ module guarantees high availability. It takes a configured sequence of providers (e.g., \surya -> paddleocr -> mistral-ocr\) and sequentially falls back upon failure.


 
 # #   U I   O v e r l a y   A r c h i t e c t u r e 
 
 T h e   P D F   V i e w e r   i m p l e m e n t s   a   C S S - p e r c e n t a g e   b a s e d   o v e r l a y   s y s t e m   f o r   L a y o u t ,   O C R ,   a n d   V i s i o n   v i s u a l i z a t i o n .   T h e   p i p e l i n e s   y i e l d   n o r m a l i z e d   b o u n d i n g   b o x e s   [ x 0 ,   y 0 ,   x 1 ,   y 1 ]   w h i c h   a r e   a p p l i e d   a s   C S S   p e r c e n t a g e s   ( l e f t :   x 0   *   1 0 0 % ,   w i d t h :   ( x 1   -   x 0 )   *   1 0 0 % )   w i t h i n    b s o l u t e   i n s e t - 0   c o n t a i n e r s .   T h i s   e n s u r e s   t h e   b o u n d i n g   b o x e s   s c a l e   n a t i v e l y   w i t h   t h e   P D F   z o o m   w i t h o u t   r e q u i r i n g   J a v a S c r i p t   r e c a l c u l a t i o n s   o n   r e s i z e .  
 
 
 # #   A I   G a t e w a y   ( P h a s e   6 ) 
 
 T h e   A I G a t e w a y   a c t s   a s   t h e   c e n t r a l   r o u t e r   f o r   t e x t - g e n e r a t i o n   L L M s .   I n s t e a d   o f   h a r d c o d i n g   A P I   k e y s   a n d   m o d e l   n a m e s   a c r o s s   t h e   a p p l i c a t i o n ,   a l l   r e q u e s t s   g o   t h r o u g h   \ A I G a t e w a y . g e n e r a t e ( p r o m p t ,   c o n t e x t ) \ .   T h e   g a t e w a y   u s e s   t h e   e x i s t i n g   \ P r o v i d e r F a l l b a c k . e x e c u t e ( ' a i ' ) \   l o g i c   t o   a u t o m a t i c a l l y   s e l e c t   t h e   o p t i m a l   m o d e l   ( e . g .   O p e n A I ,   A n t h r o p i c ,   o r   M o c k )   b a s e d   o n   t h e   c u r r e n t   c o n f i g u r a t i o n   a n d   a v a i l a b i l i t y .  
 
 
 # #   H i g h l i g h t s   S y s t e m   ( P h a s e   7 ) 
 
 T h e   H i g h l i g h t   E n g i n e   e x t r a c t s   D O M   t e x t   s e l e c t i o n s   a n d   c o n v e r t s   t h e m   i n t o   n o r m a l i z e d   P D F   c o o r d i n a t e s   ( 0 . 0   t o   1 . 0 ) .   H i g h l i g h t s   a r e   p e r s i s t e d   p e r - d o c u m e n t   i n   t h e   \ h i g h l i g h t S t o r e \ .   T h e   \ H i g h l i g h t O v e r l a y \   r e n d e r s   a b s o l u t e   p o s i t i o n e d   C S S   r e c t a n g l e s   b a s e d   o n   t h e s e   n o r m a l i z e d   b o u n d s ,   e n s u r i n g   p e r f e c t   a l i g n m e n t   a c r o s s   a l l   z o o m   l e v e l s   w i t h o u t   e x p e n s i v e   c a n v a s   o p e r a t i o n s .   T h e   \ H i g h l i g h t E d i t o r \   f l o a t s   a b o v e   a c t i v e   s e l e c t i o n s   t o   a s s i g n   c a t e g o r i e s .  
 
 
 # #   C h a t   S y s t e m   ( P h a s e   8 ) 
 
 T h e   C h a t   S y s t e m   i n t e g r a t e s   a   c o n v e r s a t i o n a l   s i d e b a r   i n t o   t h e   P D F   V i e w e r .   T h e   U I   i s   c o n n e c t e d   t o   t h e   \ A I G a t e w a y . g e n e r a t e S t r e a m \   f a c a d e ,   a l l o w i n g   t e x t   s t r e a m s   f r o m   L L M   p r o v i d e r s   ( c u r r e n t l y   M o c k A I P r o v i d e r )   t o   p r o g r e s s i v e l y   r e n d e r   i n   r e a l   t i m e .   T h e   s t a t e   i s   c e n t r a l l y   m a n a g e d   v i a   \ c h a t S t o r e \   t o   d e c o u p l e   m e s s a g e   h i s t o r y   f r o m   t h e   V i e w e r   c o m p o n e n t s .  
 