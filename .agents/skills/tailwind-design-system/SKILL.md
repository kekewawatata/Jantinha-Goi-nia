---
name: tailwind-design-system
description: "Guidelines and patterns for building cohesive, premium, high-contrast and responsive design systems using Tailwind CSS for web applications."
risk: low
source: community
date_added: "2026-03-01"
---

# Tailwind Design System & UI/UX Playbook

## Purpose
Ensure all UI components adhere to a unified, premium design language with curated color tokens, typography scales, responsive layouts, micro-interactions, and accessible states.

## Core Rules

### 1. Unified Token Palette
- Do not use arbitrary scattered hex codes in inline styles.
- Define semantic color tokens in `tailwind.config.ts` or CSS variables:
  - **Surface & Backgrounds**: Layered elevations (e.g., base `#0b0c10`, card `#15171e`, popup `#1d202a`).
  - **Primary & Accents**: Rich, warm amber/ember palette suited for culinary branding (e.g., `amber-500`, `orange-600`, `red-500`).
  - **Feedback States**: Clear badges and status indicators for Success, Warning, Danger, and Info.
  - **Borders & Dividers**: Subtle, translucent borders (`border-white/10`, `border-border/40`).

### 2. Visual Hierarchy & Spacing
- Strong typography hierarchy with modern font pairing (e.g., Inter, Plus Jakarta Sans, Geist).
- Spacing rhythm based on 4px/8px grid (`p-2`, `p-4`, `p-6`).
- Distinct visual weight between action triggers, headers, and secondary labels.

### 3. Micro-Interactions & Transitions
- Interactive elements must have smooth hover and active states (`transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]`).
- Visual feedback on clicks, selections, and status changes.
- Elegant glassmorphism and subtle glows for focal elements (`backdrop-blur-md bg-white/5 border border-white/10 shadow-lg shadow-black/20`).

### 4. Responsiveness & Touch Readiness
- Minimum 44px touch targets on mobile/tablet viewports for cashier and waiter interfaces.
- Fluid layout adapting from mobile screens to wide POS and kitchen dashboard displays.
