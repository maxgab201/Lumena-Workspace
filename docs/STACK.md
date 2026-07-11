# Lumena Workspace

Technology Stack

Version: 0.1

Status: Draft

Last Updated: YYYY-MM-DD

---

# Table of Contents

1. Philosophy
2. Stack Selection Rules
3. Frontend
4. Backend
5. Database
6. Authentication
7. Storage
8. AI
9. OCR
10. Payments
11. UI
12. State Management
13. Animations
14. Charts & Visualization
15. PDF Engine
16. Development Tools
17. Testing
18. Deployment
19. Monitoring
20. Future Technologies

---

# 1. Philosophy

The technology stack is selected based on long-term maintainability rather than popularity.

Every technology must satisfy at least the following criteria:

• Actively maintained

• Well documented

• Stable

• Production ready

• Scalable

• Strong community adoption

• Compatible with TypeScript

Technologies should never be selected simply because they are trending.

---

# 2. Stack Selection Rules

Before introducing any dependency the AI agent must:

Research alternatives

Compare maintenance

Compare bundle size

Compare accessibility

Compare performance

Compare documentation

Compare licensing

Compare community adoption

Explain why the chosen solution is preferred.

---

# 3. Frontend

Framework

React

Language

TypeScript

Bundler

Vite

Routing

React Router

Styling

Tailwind CSS

Icons

Lucide

Fonts

Geist

Inter

---

# 4. Backend

Runtime

Node.js

Framework

To be determined after research.

Potential options:

Hono

Express

Fastify

NestJS

The final decision must prioritize performance and simplicity.

---

# 5. Database

Primary

PostgreSQL

Possible Providers

Supabase

Neon

Other managed PostgreSQL providers

The database engine should remain PostgreSQL compatible.

---

# 6. Authentication

Preferred

Supabase Auth

Alternatives

Clerk

Auth.js

Better Auth

Authentication should remain provider-independent whenever possible.

---

# 7. Storage

Object Storage

Cloudflare R2

Alternatives

Supabase Storage

S3 Compatible Providers

The storage layer should support large PDF files.

---

# 8. AI

The application must remain provider-agnostic.

Potential Providers

OpenRouter

Google AI

NVIDIA

Groq

Together

Fireworks

DeepInfra

Future providers

Providers should be replaceable without modifying business logic.

---

# 9. OCR

The OCR implementation should support multiple engines.

Potential engines include:

PaddleOCR

Tesseract

OCRmyPDF

Surya

Cloud OCR providers

Selection depends on cost and quality.

---

# 10. Payments

Possible providers

Lemon Squeezy

Stripe

Paddle

Future regional providers

Selection should consider:

Merchant of Record

Taxes

Subscriptions

International payments

---

# 11. UI Components

Preferred

shadcn/ui

Radix UI

Floating UI

Headless components whenever possible.

---

# 12. State Management

Preferred

TanStack Query

React Context

Potential Future

Zustand

Redux should only be introduced if truly necessary.

---

# 13. Animations

Preferred

Motion

GSAP

Anime.js

Animations should improve usability rather than decoration.

---

# 14. Charts & Visualization

Potential

Recharts

D3

React Flow

Mermaid

Mind maps and graphs should support future expansion.

---

# 15. PDF Engine

Preferred

PDF.js

react-pdf

The rendering engine must support:

Virtualization

Selection

Zoom

Highlight overlays

Logical page mapping

Search

---

# 16. Development Tools

Package Manager

pnpm

Linting

ESLint

Formatting

Prettier

Git Hooks

Husky

Commit Messages

Conventional Commits

---

# 17. Testing

Unit

Vitest

Component

Testing Library

E2E

Playwright

Performance

Lighthouse

Accessibility

axe

---

# 18. Deployment

Frontend

Vercel

Database

Managed PostgreSQL

Storage

Cloudflare R2

CI/CD

GitHub Actions

Preview Deployments are mandatory.

---

# 19. Monitoring

Potential providers

Sentry

Better Stack

OpenTelemetry

Vercel Analytics

Monitoring should never expose sensitive user information.

---

# 20. Future Technologies

The stack should remain flexible enough to support:

Desktop Applications

Mobile Applications

Browser Extensions

Public API

Enterprise Features

Offline Support

AI Agents

Plugin System

Collaborative Editing

Future technologies may replace current ones if they provide significant long-term advantages.

All major stack changes require explicit user approval.