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

