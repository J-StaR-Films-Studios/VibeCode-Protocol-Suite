---
description: Make any Next.js page SEO-ready with metadata, structured data, and accessibility
---

# SEO Ready Workflow

This workflow transforms any Next.js page into a fully SEO-optimized page.

## Prerequisites
- A Next.js 13+ project using App Router
- Target page(s) to optimize

---

## Phase 1: Global SEO Setup (Run Once Per Project)

### 1.1 Check for Root Layout Metadata
// turbo
```bash
head -50 src/app/layout.tsx
```

Verify the root `layout.tsx` has a comprehensive `metadata` export:

```typescript
export const metadata: Metadata = {
  title: {
    default: "Site Name",
    template: "%s | Site Name",  // Allows per-page titles
  },
  description: "...",
  keywords: ["..."],
  authors: [{ name: "..." }],
  creator: "...",
  metadataBase: new URL("https://your-domain.com"),
  openGraph: { /* ... */ },
  twitter: { /* ... */ },
};
```

**If missing**, add a full metadata block to `src/app/layout.tsx`.

### 1.2 Check for Sitemap
// turbo
```bash
ls src/app/sitemap.ts 2>/dev/null || echo "MISSING"
```

**If missing**, create `src/app/sitemap.ts`:

```typescript
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://your-domain.com'
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'yearly', priority: 1 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    // Add more routes...
  ]
}
```

### 1.3 Check for Robots.txt
// turbo
```bash
ls src/app/robots.ts 2>/dev/null || echo "MISSING"
```

**If missing**, create `src/app/robots.ts`:

```typescript
import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/private/' },
    sitemap: 'https://your-domain.com/sitemap.xml',
  }
}
```

### 1.4 Check for Web Manifest (PWA)
// turbo
```bash
ls src/app/manifest.ts 2>/dev/null || echo "MISSING"
```

**If missing**, create `src/app/manifest.ts`:

```typescript
import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Your App Name',
    short_name: 'AppName',
    description: 'Your app description',
    start_url: '/',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [{ src: '/icon.png', sizes: 'any', type: 'image/png' }],
  }
}
```

### 1.5 Check for Favicon/Icons
// turbo
```bash
ls src/app/icon.png src/app/apple-icon.png 2>/dev/null || echo "MISSING ICONS"
```

**If missing**:
1. Find a logo file in `public/` (e.g., `public/logo.png`)
2. Copy it to `src/app/icon.png` and `src/app/apple-icon.png`

### 1.6 Check for OpenGraph Image
// turbo
```bash
ls src/app/opengraph-image.* 2>/dev/null || echo "MISSING OG IMAGE"
```

**Options**:
- **Static**: Copy a 1200x630px image to `src/app/opengraph-image.png`
- **Dynamic**: Create `src/app/opengraph-image.tsx` using `@vercel/og` or `next/og`

### 1.7 Check for JSON-LD Structured Data
Search for existing JSON-LD in the layout:
// turbo
```bash
grep -r "application/ld+json" src/app/layout.tsx || echo "MISSING JSON-LD"
```

**If missing**, add to the `<body>` in `layout.tsx`:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication", // or Organization, LocalBusiness, etc.
      "name": "Your App",
      "applicationCategory": "...",
      "operatingSystem": "Web",
      "author": { "@type": "Organization", "name": "Your Org", "url": "https://..." }
    })
  }}
/>
```

---

## Phase 2: Per-Page Optimization

For each page you want to optimize:

### 2.1 Check if Page is a Server Component
View the page file:
// turbo
```bash
head -5 <path-to-page.tsx>
```

- **If it starts with `'use client'`**: The page cannot have static metadata.
  - **Refactor**: Move client logic to a separate component in `src/features/<feature>/components/`.
  - The page file should become a Server Component that imports the client component.

### 2.2 Add Page-Specific Metadata
Add/update the `metadata` export in the page file:

```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Page Title",  // Will become "Page Title | Site Name" via template
  description: "A specific description for this page.",
};

export default function Page() { /* ... */ }
```

### 2.3 Semantic HTML Audit
Verify the page uses:
- `<main>` for primary content
- `<section>` for distinct sections (with `id` attributes for anchor links)
- `<article>` for standalone content (blog posts, legal pages)
- `<header>` and `<footer>` if applicable
- `<nav aria-label="...">` for navigation
- Proper heading hierarchy (`<h1>`, `<h2>`, etc.)

### 2.4 Image Optimization
Ensure all images use Next.js `<Image>` component:
- `alt` attribute is required and descriptive
- `width` and `height` are specified to prevent layout shift

---

## Phase 3: Accessibility (a11y) Pass

### 3.1 ARIA Labels
Check interactive elements for `aria-label`:
// turbo
```bash
grep -rE "(onClick|button|<a )" <path-to-page.tsx> | head -20
```

Ensure buttons, links, and form elements have accessible names.

### 3.2 Language Attribute
Verify `<html lang="en">` (or appropriate language) is set in `layout.tsx`.

---

## Phase 4: Verification

### 4.1 Build Check
// turbo
```bash
pnpm build
```

Ensure no build errors related to metadata.

### 4.2 Manual Verification
1. Run `pnpm dev`
2. Visit `http://localhost:3000/sitemap.xml` - should list routes
3. Visit `http://localhost:3000/robots.txt` - should show rules
4. Inspect page `<head>` in browser dev tools for meta tags
5. Use Google's Rich Results Test on production URL

---

## Checklist Summary

| Item | Status |
|------|--------|
| Root `layout.tsx` has full `metadata` export | [ ] |
| `sitemap.ts` exists | [ ] |
| `robots.ts` exists | [ ] |
| `manifest.ts` exists | [ ] |
| `icon.png` and `apple-icon.png` exist | [ ] |
| OpenGraph image exists (static or dynamic) | [ ] |
| JSON-LD structured data in layout | [ ] |
| Target page has `export const metadata` | [ ] |
| Target page uses semantic HTML | [ ] |
| All images use `<Image>` with `alt` | [ ] |
| Build passes | [ ] |
