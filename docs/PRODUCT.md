# Lumena Workspace

Product Specification

Version: 1.0

Status: Implemented (Phase 1-11 Complete, Phase 23 In Progress)

Last Updated: 2026-07-26

---

# Executive Summary

Lumena Workspace is an AI-powered knowledge workspace designed to transform static documents into interactive learning and research environments.

Unlike traditional "Chat with PDF" applications, Lumena Workspace provides a unified platform combining:
- **Document Understanding**: High-fidelity PDF rendering with virtualization for 300+ page documents
- **AI Gateway**: Provider-agnostic LLM routing (Gemini 1.5 Flash/Pro) with credit metering, rate limiting, and fallback
- **Knowledge Tools**: Flashcards, Glossary, Mind Maps, Timelines, Presentations (Phase 10+)
- **Visual Overlays**: Layout detection, OCR blocks, Vision AI objects, and semantic highlights
- **Credits & Billing**: Ledger-based credit system with Stripe integration, subscription plans (Free/Pro)
- **Workspace Model**: Multi-tenant workspaces with role-based access (Owner/Member/Viewer)

The goal is simple: **Read less. Understand more.**

---

# Vision

Lumena Workspace is not designed to be another document reader. Its purpose is to become a complete knowledge platform where documents evolve into reusable knowledge.

Every architectural decision supports long-term scalability and future AI capabilities.

---

# Philosophy

- **Documentation First**: Architecture is documented before implementation
- **Modular Design**: Every subsystem must be replaceable
- **Provider Independence**: No AI provider tightly coupled with the platform
- **Incremental Development**: Development happens block by block; every block finishes with a working preview
- **User Control**: AI assists users; it never replaces them
- **Long-term Maintainability**: Maintainability always has higher priority than implementation speed

---

# Core Features (Implemented)

| Feature | Status | Description |
|---------|--------|-------------|
| Workspaces | ✅ | Create, rename, delete, switch workspaces |
| PDF Viewer | ✅ | Virtualized rendering, zoom, rotation, keyboard navigation |
| OCR Pipeline | ✅ | Tesseract.js local provider with Provider Framework abstraction |
| AI Analysis | ✅ | AI Gateway with Gemini 1.5 Flash/Pro, streaming, credit metering |
| Smart Highlights | ✅ | DOM selection → normalized PDF coordinates, categories, notes |
| AI Chat | ✅ | Document-scoped chat with session persistence, model selector |
| Credits System | ✅ | Ledger architecture (grant/reserve/consume/refund/expire) |
| Subscription Plans | ✅ | Free (50 credits/mo, Flash only) / Pro (1000 credits/mo, Flash+Pro) |
| Knowledge Tools | ✅ | Flashcards, Glossary, Mind Maps, Timeline, Presentations |

---

# Product Philosophy

## Documents are Knowledge

A document is not a file. A document is structured information. The application must preserve that structure.

---

## AI Assists the User

AI should never completely replace the user. The user always remains in control.

- Highlights can be edited
- Generated content can be regenerated
- Users decide what to keep

---

## Progressive Intelligence

Large documents are never fully processed by default.

Pipeline:
1. Prepare
2. Inspect
3. Extract
4. Select
5. Analyze
6. Cache
7. Reuse

---

## Long-term Architecture

Every feature must support future expansion:

- Mind Maps
- Podcasts
- Flashcards
- Study Mode
- Infographics
- Presentations
- Timeline Generator
- Knowledge Graph
- Public API
- Browser Extension
- Desktop Application
- Mobile Application
- Team Collaboration
- Enterprise Features

No architectural decision should prevent these capabilities.

---

# Target Audience

**Primary:**
- Students
- Researchers
- University faculty
- Teachers
- Professionals (Lawyers, Engineers, Medical staff)
- Knowledge workers
- Companies

---

# Workspace Concept

Users do not work with PDFs. Users work with **Workspaces**.

Each Workspace represents a knowledge project.

Examples: History, Biology, Machine Learning, Legal Case, Research, University

Every Workspace contains:
- Documents
- Chat History
- Highlights
- Notes
- Future AI artifacts
- Credits usage
- Settings
- Permissions

The Workspace becomes the shared context for every AI interaction.

---

# Document Management

**Supported formats:**
- PDF (primary, fully implemented)

**Future formats:**
- DOCX
- Markdown
- TXT
- Images
- PowerPoint
- Excel
- Web Pages
- Audio
- Video

---

# PDF Philosophy

PDF is the first supported format. The architecture must never assume PDF is the only knowledge source. Future versions should accept multiple document types simultaneously.

---

# OCR Philosophy

The system should automatically determine whether OCR is required.

Possible scenarios:
- Digital text
- Scanned pages
- Mixed pages
- Images
- Partial OCR

Bounding boxes should always be preserved whenever technically possible.

---

# Logical Page Numbers

The system must distinguish between:
- PDF internal page
- Page Labels
- Printed page numbers

The user should always interact using logical document numbering.

---

# AI Analysis

The AI does not automatically analyze entire books. Users decide:
- Current page
- Page range
- Specific pages
- Entire document

Analysis should be incremental.

---

# Highlighting

Highlights are AI-generated overlays. They never modify the original document.

Possible highlight categories:
- Important
- Definitions
- Dates
- Numbers
- Formulas
- Relationships
- Warnings
- Examples
- Questions
- Future custom categories

Users can edit highlights.

---

# Chat

The chat understands:
- Current Workspace
- Current document
- Selected text
- Current page
- Previous analysis
- Highlights
- Notes
- Future generated content

Responses should include references back to document locations.

---

# Knowledge Tools

- Mind Maps
- Flashcards
- Podcasts
- Infographics
- Presentations
- Study Mode
- Glossary
- Exam Generator
- Timeline Generator
- Concept Graph
- Comparison Tables
- Flowcharts
- Knowledge Graph

Everything should originate from the Workspace.

---

# AI Providers

The architecture should remain provider-agnostic.

Potential providers include:
- OpenRouter
- Google (Gemini)
- NVIDIA
- Groq
- Together
- Fireworks
- DeepInfra
- Future providers

The frontend must never directly access provider APIs.

---

# AI Models

Users may choose:
- Automatic
- Manual

Model availability depends on subscription tier. The platform should expose only curated models. Never display hundreds of models.

---

# Credits

Credits are an internal currency. The system uses a ledger architecture.

Every operation creates a transaction:
- Reserve
- Consume
- Refund
- Expire
- Purchase
- Monthly Allocation

No operation should directly modify balances. Balances are calculated from ledger entries.

---

# Subscription Plans

- **Free**: 50 credits/month, Gemini 1.5 Flash only, 3 workspaces
- **Pro**: $15/month, 1000 credits/month, Gemini 1.5 Flash + Pro, unlimited workspaces, priority processing

Pricing is intentionally defined outside this document. Plans should balance accessibility and sustainability.

---

# Security Principles

Security is mandatory.

- Never expose API keys
- Never trust frontend validation
- Validate everything server-side
- Uploaded files are untrusted
- PDFs are untrusted
- Secrets never leave the backend
- Least privilege applies everywhere

---

# Privacy

Users own their data. Uploaded documents remain private. Documents can be permanently deleted. Processing should minimize unnecessary data retention.

---

# UX Principles

- Fast
- Responsive
- Professional
- Modern
- Accessible
- Predictable

Animations should improve usability. Never animate simply because animation is possible.

---

# Non-Goals

Lumena is **not**:
- A generic chatbot
- A PDF editor
- A file storage platform
- A note-taking clone
- A document scanner
- A replacement for office software

---

# Long-term Roadmap

**Phase 1** (Complete): Workspace, PDF, OCR, Highlights, Chat, Subscriptions, Credits
**Phase 2** (Complete): Knowledge Tools (Flashcards, Glossary, Mind Maps, Timeline, Presentations)
**Phase 3**: Podcast, Infographics, Presentations refinement, Knowledge Graph
**Phase 4**: API, Mobile Apps, Collaboration, Enterprise Features

---

# Success Metrics

- Users understand documents faster
- Less reading
- Better retention
- More interaction
- Lower processing cost
- Scalable architecture
- Excellent UX

---

# Glossary

| Term | Definition |
|------|------------|
| Workspace | A knowledge project containing documents, chat, highlights, and AI artifacts |
| Knowledge | Structured, reusable information extracted from documents |
| Analysis | AI processing of document content (summarization, extraction, synthesis) |
| Highlight | AI-generated or user-created text overlay on document pages |
| Logical Page | User-facing page number (accounts for labels, printed numbers) |
| Credits | Internal platform currency abstracting provider costs |
| Provider | External AI service (Gemini, OpenAI, etc.) |
| Model | Specific AI model (Gemini 1.5 Flash, GPT-4o, etc.) |
| Workspace Memory | Persistent context shared across all AI interactions in a workspace |
| Knowledge Graph | Structured representation of entities and relationships across documents |