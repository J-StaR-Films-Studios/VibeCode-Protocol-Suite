# Blueprint: Takomi VibeCode Protocol Website

## Goal
Build a modern, high-converting landing page showcasing the Takomi VibeCode Protocol. It should explain the philosophy and how Takomi transforms AI from a chatbot into a development partner.

## Components (Client vs Server)
- The website will be a **Next.js App Router** application (to be scaffolded in `website/`).
- **Server First**: All UI components are React Server Components by default.
- **Client Sparingly**: Only use `'use client'` for interactivity (e.g., animations provided by 21st.dev components).

## Data Flow
- This is a static presentation site. No database schema or complex data fetching is required for V1.

## 21st.dev Manual Handoff Integration
Since this is a greenfield project and we don't have a reference site, we will use the **Manual Mode** of the `21st-dev-components` skill. 

### Sections to collect from 21st.dev:
Please visit the links below and find a component that matches the Takomi "Vibe" (e.g., Terminal Noir, premium, dark-mode, developer-centric).

**1. Header**
- Suggested Categories: [Navigation Menus](https://21st.dev/s/navbar-navigation) | [Buttons](https://21st.dev/s/button)

**2. Hero**
- The main hook: "Stop wrestling with AI."
- Suggested Categories: [Heroes](https://21st.dev/s/hero) | [Backgrounds](https://21st.dev/s/background) 

**3. Features**
- Highlighting the rules (Blueprint Rule, 200-Line Rule, etc.)
- Suggested Categories: [Features](https://21st.dev/s/features) | [Cards](https://21st.dev/s/card)

**4. Pricing / CTA**
- The "Install Now" section.
- Suggested Categories: [Calls to Action](https://21st.dev/s/call-to-action)

**5. Footer**
- Suggested Categories: [Footers](https://21st.dev/s/footer)
