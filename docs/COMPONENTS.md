# Lumena Workspace

Component Library Specification

Version: 0.1

Status: Draft

Last Updated: YYYY-MM-DD

---

# Table of Contents

1. Component Philosophy
2. Design Principles
3. Component Hierarchy
4. UI Components
5. Layout Components
6. Navigation Components
7. Workspace Components
8. PDF Components
9. OCR Components
10. Highlight Components
11. Chat Components
12. AI Components
13. Billing Components
14. Authentication Components
15. Settings Components
16. Form Components
17. Feedback Components
18. Loading Components
19. Modal Components
20. Context Menu Components
21. Command Palette
22. Animation Components
23. Accessibility Rules
24. Component Communication
25. Props Standards
26. Folder Organization
27. Naming Conventions
28. Reusability Rules
29. Future Components
30. Component Roadmap

---

# 1. Component Philosophy

...

# 2. Design Principles

...

# 3. Component Hierarchy

Primitive

↓

Shared

↓

Feature

↓

Page

...

# 4. UI Components

Button

Input

Textarea

Select

Checkbox

Radio

Badge

Tooltip

Avatar

Card

Separator

Tabs

Accordion

...

# 5. Layout Components

AppLayout (Responsive container: flex h-screen overflow-hidden)

Sidebar (Workspace Sidebar with Workspace Switcher, Documents, and Coming Soon sections)

Topbar (Mobile toggles, global search, user profile)

...

# 6. Navigation Components

Navbar

Breadcrumb

Workspace Switcher

Search

Command Palette

Navigation Menu

...

# 7. Workspace Components

Dashboard (Two-panel structure: Center + Right Sidebar)

EmptyState (Premium empty state with drag-and-drop upload zone)

WorkspaceAssistant (Right Sidebar mock assistant and context)

WorkspaceSettings

WorkspaceMembers

...

# 8. PDF Components

Viewer

Toolbar

Page

Thumbnail

Search Panel

Page Navigator

Zoom Controls

Selection Layer

Overlay Layer

...

# 9. OCR Components

OCR Progress

OCR Status

OCR Inspector

OCR Warnings

...

# 10. Highlight Components

Highlight

Highlight Layer

Highlight Editor

Highlight Categories

Highlight Sidebar

...

# 11. Chat Components

Chat Window

Message

AI Response

Citation

Streaming Message

Prompt Box

Conversation List

...

# 12. AI Components

Model Selector

Provider Badge

Credit Estimator

Usage Meter

Analysis Status

...

# 13. Billing Components

Plan Card

Credits Meter

Usage Chart

Purchase Dialog

Invoice List

...

# 14. Authentication Components

Login Form

Register Form

OAuth Buttons

Session Manager

...

# 15. Settings Components

Profile

Preferences

Notifications

Security

Appearance

...

# 16. Form Components

...

# 17. Feedback Components

Toast

Alert

Banner

Confirmation

...

# 18. Loading Components

Skeletons

Progress Bars

Loading Overlay

Spinner

Streaming Indicator

...

# 19. Modal Components

Dialog

Drawer

Confirmation Modal

Wizard

...

# 20. Context Menu Components

...

# 21. Command Palette

...

# 22. Animation Components

Page Transition

Highlight Animation

Modal Animation

Workspace Transition

Chat Streaming

...

# 23. Accessibility Rules

...

# 24. Component Communication

...

# 25. Props Standards

...

# 26. Folder Organization

...

# 27. Naming Conventions

...

# 28. Reusability Rules

...

# 29. Future Components

Mind Maps

Flashcards

Podcast Player

Presentation Viewer

Timeline

Knowledge Graph

Infographics

AI Agents

...

# 30. Component Roadmap

...
### Document Viewer Components

- **\PDFViewer\**: The root container for viewing a PDF document, responsible for fetching the document URL, configuring the PDF.js worker, and managing the overall layout.
- **\PDFToolbar\**: Fixed header providing document navigation (previous/next), zoom controls, and rotation capabilities.
- **\PDFPageList\**: A highly performant virtualized list (powered by @tanstack/react-virtual) that handles dynamic page sizing and rendering based on the scroll position.
- **\PDFPage\**: The individual page component. Contains a stacked architecture with a base \eact-pdf\ canvas and placeholder divs for upcoming feature layers (Annotations, OCR, AI Overlays).

