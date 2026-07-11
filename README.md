# 🌟 Lumena Workspace

> **Where documents become knowledge.**

[![Status](https://img.shields.io/badge/status-planning-blue)]()
[![Version](https://img.shields.io/badge/version-0.1.0-green)]()
[![License](https://img.shields.io/badge/license-TBD-lightgrey)]()

---

# Overview

Lumena Workspace is an AI-powered knowledge workspace designed to transform static documents into interactive learning environments.

Unlike traditional PDF readers or simple "Chat with PDF" applications, Lumena Workspace combines document understanding, OCR, contextual AI, semantic navigation and future knowledge-generation tools into a single platform.

The goal is simple:

> **Read less. Understand more.**

---

# Vision

Lumena Workspace is not designed to be another document reader.

Its purpose is to become a complete knowledge platform where documents evolve into reusable knowledge.

Every architectural decision must support long-term scalability and future AI capabilities.

---

# Philosophy

The project follows several fundamental principles.

• Documentation First

Architecture is documented before implementation.

---

• Modular Design

Every subsystem must be replaceable.

---

• Provider Independence

No AI provider should be tightly coupled with the platform.

---

• Incremental Development

Development happens block by block.

Every block must finish with a working preview.

---

• User Control

AI assists users.

It never replaces them.

---

• Long-Term Maintainability

Maintainability always has higher priority than implementation speed.

---

# Core Features

Current roadmap includes:

✅ Workspaces

✅ PDF Viewer

✅ OCR Pipeline

✅ AI Analysis

✅ Smart Highlights

✅ AI Chat

✅ Credits System

✅ Subscription Plans

Future roadmap:

🧠 Mind Maps

🎙 AI Podcasts

📚 Flashcards

📈 Infographics

📽 Presentation Generator

📅 Timeline Generator

🌳 Knowledge Graph

📝 Study Mode

📱 Mobile Applications

🖥 Desktop Applications

🌐 Browser Extension

🔌 Public API

---

# Project Status

Current Version

0.1.0

Status

Planning & Architecture

Current Phase

Documentation

Architecture

Technology Research

No production implementation has started yet.

---

# Repository Philosophy

This repository is intentionally documentation-driven.

Every major decision must be documented before implementation.

The documentation serves as the single source of truth for both developers and AI agents.

---

# AI Development

This project is designed to be developed primarily using AI-assisted software engineering.

Every AI agent working in this repository must:

• Read AGENTS.md

• Read the project documentation

• Understand the architecture

• Work incrementally

• Never skip documentation

• Never continue without user approval

Development always follows the roadmap defined in:

docs/ROADMAP.md

---

# Repository Structure

```
/
├── AGENTS.md
├── README.md
├── LICENSE
│
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   ├── STACK.md
│   ├── DATABASE.md
│   ├── API.md
│   ├── SECURITY.md
│   ├── DESIGN.md
│   ├── TESTING.md
│   ├── DEPLOYMENT.md
│   ├── BUSINESS_MODEL.md
│   ├── USER_FLOW.md
│   ├── MCP.md
│   ├── FILE_STRUCTURE.md
│   ├── COMPONENTS.md
│   ├── DECISIONS.md
│   ├── CHANGELOG.md
│   └── BRAND.md
│
├── public/
├── src/
└── ...
```

---

# Documentation

## Core Documentation

- PRODUCT.md
- ARCHITECTURE.md
- ROADMAP.md
- STACK.md

## Engineering

- DATABASE.md
- API.md
- SECURITY.md
- DEPLOYMENT.md
- TESTING.md

## Design

- DESIGN.md
- COMPONENTS.md
- BRAND.md

## Business

- BUSINESS_MODEL.md

## User Experience

- USER_FLOW.md

## Development

- AGENTS.md
- MCP.md
- FILE_STRUCTURE.md
- DECISIONS.md
- CHANGELOG.md

---

# Architecture

High-Level Architecture

```
User
 │
 ▼
Frontend
 │
 ▼
Backend API
 │
 ├──────────────┐
 ▼              ▼
AI Gateway   Workspace Engine
 │              │
 ▼              ▼
Providers   PostgreSQL
 │
 ▼
OCR → Analysis → Highlights → Cache
 │
 ▼
Object Storage
```

Every subsystem has a single responsibility.

No provider-specific logic exists outside the AI Gateway.

---

# Technology Stack

The final technology stack is intentionally maintained separately.

See:

docs/STACK.md

Current candidate technologies include:

• React

• TypeScript

• Vite

• PostgreSQL

• AI Gateway

• Multiple AI Providers

• Cloud Object Storage

• Vercel

These technologies remain under evaluation.

---

# Development Workflow

Development follows an incremental block-based workflow.

Every block must:

✅ Compile successfully

✅ Produce a working preview

✅ Pass validation

✅ Update documentation

✅ Update CHANGELOG

✅ Update DECISIONS (if necessary)

✅ Wait for user approval

No block may continue automatically.

---

# Security

Security is a fundamental architectural principle.

Examples include:

• Zero Trust Architecture

• Server-side Validation

• Secure Upload Pipeline

• Least Privilege

• Secrets Management

• Credits Ledger

• AI Gateway Isolation

See:

docs/SECURITY.md

---

# Business Model

Lumena Workspace uses:

• Subscription Plans

• Internal Credits

• AI Cost Optimization

• Provider Abstraction

Business decisions are documented in:

docs/BUSINESS_MODEL.md

---

# Roadmap

Current phases:

Phase 0

Planning

↓

Phase 1

Foundation

↓

Phase 2

Authentication

↓

Phase 3

Workspace

↓

Phase 4

Documents

↓

Phase 5

OCR

↓

Phase 6

AI Gateway

↓

Phase 7

Highlights

↓

Phase 8

Chat

↓

Phase 9

Billing

↓

Phase 10+

Knowledge Tools

See:

docs/ROADMAP.md

---

# License

The project license will be selected before the first public release.

---

# Contributing

Before contributing:

1. Read AGENTS.md

2. Read PRODUCT.md

3. Read ROADMAP.md

4. Follow the development workflow

5. Document significant architectural decisions

6. Keep documentation synchronized with implementation

---

# Future

Lumena Workspace is designed to evolve into a complete AI knowledge platform.

Planned future capabilities include:

• Knowledge Graph

• Mind Maps

• Flashcards

• AI Podcasts

• Presentations

• Infographics

• Timeline Generator

• Study Assistant

• Browser Extension

• Desktop Application

• Mobile Application

• Public API

• Team Collaboration

• Enterprise Features

The architecture is intentionally designed to support these capabilities without requiring a complete redesign.

---

# Project Motto

> **Where documents become knowledge.**

---

Made with ❤️ by **MGGX Games**