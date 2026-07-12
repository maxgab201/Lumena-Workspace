# Lumena Workspace

Architecture Decision Record (ADR)

Version: 0.1

Status: Living Document

Last Updated: YYYY-MM-DD

---

# Table of Contents

1. Purpose
2. Decision Process
3. Decision Status
4. Decision Template
5. Accepted Decisions
6. Proposed Decisions
7. Rejected Decisions
8. Deferred Decisions
9. Future Reviews
10. Decision History

---

# 1. Purpose

This document records every significant technical, architectural and business decision made throughout the project.
### Added
- Feature branching workflow and automated preview deployments implemented as core CI/CD pipeline (Block 1.1).

## 4. State Management and Provider Architecture
- **Date**: 2026-07-11
- **Status**: Accepted
- **Context**: The frontend needed a scalable state management solution and a solid provider tree without introducing heavy frameworks or unnecessary boilerplate. We evaluated Redux, Context API, and Zustand.
- **Decision**: Adopted `zustand` for lightweight, unopinionated global state. Adopted `react-error-boundary` for declarative error handling, `sonner` for toast notifications, and prepared `@tanstack/react-query` for server state (though unused until actual API integration).
- **Consequences**: This decouples the UI components from specific backend implementations using mock layers, and provides a scalable, fast, and highly maintainable structural foundation.

## 5. Authentication Architecture
- **Date**: 2026-07-11
- **Status**: Accepted
- **Context**: Needed a secure authentication provider with OAuth support (Google, GitHub) that integrates tightly with our backend database while enforcing Zero Trust principles.
- **Decision**: Adopted `Supabase Auth` mapped to a Zustand store for client-side reactivity.
- **Consequences**: Provides secure JWT session handling. Protected routes properly suspend using a `LoadingPage` while the session is actively restored from local storage and verified against the server.

## 6. User Profile and Workspace Ownership Schema
- **Date**: 2026-07-11
- **Status**: Accepted
- **Context**: The application required a persistent layer for user profiles and multi-tenant workspaces. Manually handling the creation of these records in the frontend introduces race conditions and increases bundle size.
- **Decision**: Implemented `profiles`, `workspaces`, and `workspace_members` tables managed via Supabase migrations with strict Row Level Security (RLS). A PostgreSQL trigger (`on insert` to `auth.users`) was deployed to automatically provision a profile and default "My Workspace" for every new user.
- **Consequences**: This guarantees data integrity, offloads business logic to the database layer securely, and simplifies the frontend authentication flow immensely.

Every important decision must be documented before implementation whenever possible.

No major architectural change should exist without a corresponding ADR.

---

# 2. Decision Process

Every decision should include:

Problem

Context

Options Considered

Advantages

Disadvantages

Risks

Decision

Reasoning

Consequences

Future Review Date

Owner

Status

---

# 3. Decision Status

Proposed

Accepted

Rejected

Deprecated

Superseded

Under Review

---

# 4. Decision Template

## ADR-0000

Title

Date

Status

Category

Problem

Context

Options

Decision

Reasoning

Consequences

Future Work

References

---

# 5. Accepted Decisions

## ADR-0001

Project Documentation Strategy

Status

Accepted

Description

The project uses multiple specification documents rather than a single monolithic document.

Reasoning

Improves maintainability.

...

## ADR-0002

Development by Blocks

Status

Accepted

Description

Development must always be incremental.

Every block ends with user approval.

...

## ADR-0003

AI Provider Independence

Status

Accepted

Description

No provider-specific logic outside the AI Gateway.

...

## ADR-0004

Repository Initialization and Frontend Stack

Status

Accepted

Description

The project will use React, TypeScript, Vite, and Tailwind CSS v4. The setup prefers Tailwind CSS v4 with the `@tailwindcss/vite` plugin to increase performance and reduce configuration boilerplate. The backend framework decision (between Hono, Fastify, NestJS, Express) is deferred pending further Deep Research, with a strong preliminary recommendation for Hono due to Vercel edge deployment requirements.

## ADR-0005

Design System Primitives & Animation Strategy

Status

Accepted

Description

The project utilizes Headless accessible components (Radix UI) for complex primitives like Modals, Tooltips, and Dropdown Menus to guarantee ARIA compliance and keyboard navigation. Simple primitives are styled natively. Animations and layout transitions are powered by `framer-motion` to ensure fluid and professional micro-interactions. The `cn()` utility (`clsx` + `tailwind-merge`) is standardized for predictable style composition.

(Add future accepted decisions here.)

---

# 6. Proposed Decisions

Authentication Provider

OCR Engine

Database Provider

Payment Provider

Storage Provider

Deployment Strategy

Monitoring Platform

Analytics Platform

...

---

# 7. Rejected Decisions

Every rejected proposal should remain documented.

Reason

Date

Alternative

Lessons Learned

...

---

# 8. Deferred Decisions

Features intentionally postponed.

Examples

Knowledge Graph

Podcast

Public API

Desktop App

Enterprise

...

---

# 9. Future Reviews

Every accepted decision should have a review date.

Technology changes.

Business changes.

Performance changes.

Cost changes.

Security changes.

...

---

# 10. Decision History

Chronological history of all ADRs.

ADR-0001

ADR-0002

ADR-0003

...

Future ADRs continue sequential numbering.
### Document Viewer Virtualization (Block 4.1)

- **Decision**: Use @tanstack/react-virtual for PDF page virtualization instead of eact-window.
- **Context**: The PDF viewer needs to support dynamic page heights, rotation, zoom, and future overlays (OCR, AI, Highlights). eact-window was found to be too rigid for dynamic measurement and lacked active maintenance.
- **Impact**: @tanstack/react-virtual provides a headless architecture (useVirtualizer) that perfectly accommodates dynamic page sizing, overscan, and scroll offset handling, providing smooth performance for 300+ page documents.



## ADR-0006

Provider-Agnostic Processing Engine

Status

Accepted

Date

2024-07-11

Description

Lumena requires document processing capabilities (OCR, Layout Analysis, Vision, Text Extraction) to analyze a wide variety of documents (digital, scanned, images, handwritten). The AI and OCR ecosystem is evolving rapidly, with new models and providers emerging frequently (e.g., Surya, DocTR, GPT-4 Vision). Hardcoding the application to a specific provider introduces high risk, prevents offline-only use cases when desired, and limits scalability.

Decision

We will implement a generic **Provider Framework**. The core \ProcessingEngine\ will communicate exclusively with abstract interfaces (\OCRProvider\, \VisionProvider\, etc.) rather than concrete implementations.

Reasoning

- **Flexibility:** We can seamlessly swap, add, or deprecate providers without touching the core business logic.
- **Routing & Fallbacks:** We can dynamically route documents to specific providers based on their profiles (e.g., routing offline-only documents to local CPU providers like PaddleOCR, or complex documents to high-quality vision models like GPT-4).

Consequences

- Abstracting the providers increases the initial architectural complexity but drastically reduces long-term technical debt.

