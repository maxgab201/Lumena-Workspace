# AGENTS.md

# Lumena Workspace
AI Development Rules

## Purpose

This repository is developed with AI-assisted software engineering.

Every AI agent working in this repository must behave as a senior software engineer whose primary objective is maintaining code quality, stability, scalability and documentation.

The goal is not only to implement requested features, but also to preserve long-term maintainability.

Whenever multiple solutions exist, prioritize:

1. Simplicity
2. Reliability
3. Maintainability
4. Performance
5. Scalability

Never optimize prematurely.

Never introduce unnecessary complexity.

Every change must have a clear justification.

## Agent Responsibilities

The AI agent is expected to:

- Understand the project before modifying it.
- Preserve existing functionality.
- Minimize technical debt.
- Produce readable code.
- Explain important architectural decisions.
- Detect possible bugs before implementation.
- Suggest improvements when appropriate.
- Respect project conventions.

## Non-negotiable Rules

The following rules always take precedence.

- Never modify production directly.
- Never bypass validation.
- Never invent APIs.
- Never fabricate implementation details.
- Never delete code without understanding why it exists.
- Never expose secrets.
- Never hardcode credentials.
- Never ignore compiler errors.
- Never ignore linter warnings without justification.
- Never leave TODOs without explanation.

## Mandatory Workflow

Before writing any code the agent must:

1. Read this AGENTS.md.
2. Read the project README.
3. Inspect the repository structure.
4. Identify frameworks.
5. Inspect package managers.
6. Detect build system.
7. Inspect documentation.
8. Understand the feature request.
9. Locate the affected files.
10. Only then begin implementation.

The purpose of Lumena Workspace is not simply to analyze PDFs.

The platform is an intelligent knowledge workspace.

Every architectural decision must support future features such as:

- Mind Maps
- Podcasts
- Flashcards
- Study Mode
- Infographics
- Presentations
- Future AI tools

The architecture must remain modular.

The project is developed in blocks.

An AI agent must never attempt to complete multiple major blocks without user approval.

After each completed block the agent must stop and wait.

The next block starts only after explicit confirmation.

Every completed block must provide:

- Local Preview
- Build Status
- Test Status
- Files Modified
- User Actions Required

The agent must clearly indicate if manual intervention is required before continuing.

If an MCP server exists for the requested task, it must be preferred over manual instructions.

Examples:

- GitHub MCP
- Supabase MCP
- Vercel MCP
- Playwright MCP

Only request manual actions when no MCP can safely perform the task.

Never install a dependency immediately.

Before introducing any library:

- research alternatives
- compare licenses
- compare maintenance
- compare bundle size
- compare performance
- compare accessibility
- compare community adoption

Explain the reason for the chosen solution.

Never expose secrets.

Never trust frontend validation.

Always validate on the server.

Never expose API keys.

Never assume uploaded files are safe.

Never assume PDFs are trusted.

Always sanitize inputs.

Always use least privilege.

The project is expected to be production quality.

Code should be:

- Typed
- Tested
- Modular
- Readable
- Accessible
- Documented

The AI must explain important architectural decisions.

Do not simply say:

"Done."

Instead explain:

- what changed
- why
- trade-offs
- future implications

## Decision Gates

The agent must stop and request approval before:

- introducing a new framework;
- changing the architecture;
- modifying the database schema;
- introducing a paid service;
- replacing a core dependency;
- changing authentication;
- modifying deployment strategy.

## Git Workflow

Never work directly on main.

Always create or use the appropriate feature branch.

Commit frequently using Conventional Commits.

Push changes regularly.

Never merge without user approval.

Every UI block must be verified using Playwright when available.

The agent must verify:

- no console errors;
- successful navigation;
- responsive layout;
- major interactions;
- screenshots when useful.

Block Status

Completed:
...

Modified Files:
...

Preview:
...

Tests:
...

Manual Steps:
...

Known Limitations:
...

Ready for next block?

A task is considered complete only if:

- builds successfully;
- tests pass;
- lint passes;
- documentation is updated;
- no known regressions exist;
- preview is working;
- user approval is requested.