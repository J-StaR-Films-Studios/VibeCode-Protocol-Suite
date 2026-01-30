---
description: The Remotion Builder - Generate a detailed video spec, get approval, then build. Two-phase workflow for programmatic video creation.
---

# Remotion Builder Workflow

> **Purpose**: Create programmatic videos using Remotion. This workflow forces mandatory rule reading, detailed planning, and an asset audit before any code is written.

---

## ⚠️ CRITICAL: MANDATORY RULE READING

**YOU ARE NOT SMART ENOUGH TO GUESS REMOTION PATTERNS.**

Before writing ANY Remotion code, you MUST read the relevant rule files. Do NOT proceed without reading these. Do NOT assume you know what you're doing.

### Step 0.1: Read the Main Skill
// turbo
```bash
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/SKILL.md"
```

### Step 0.2: Read REQUIRED Rule Files

Based on what the video needs, you MUST read the corresponding rule files. This is NOT optional.

**For ANY animation work (ALWAYS READ THESE):**
// turbo
```bash
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/animations.md"
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/timing.md"
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/sequencing.md"
```

**If using scene transitions:**
// turbo
```bash
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/transitions.md"
```

**If using text animations (typewriter, highlights, etc):**
// turbo
```bash
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/text-animations.md"
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/fonts.md"
```

**If using images, videos, or audio:**
// turbo
```bash
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/assets.md"
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/images.md"
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/videos.md"
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/audio.md"
```

**If using 3D elements:**
// turbo
```bash
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/3d.md"
```

**If using captions/subtitles:**
// turbo
```bash
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/display-captions.md"
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/transcribe-captions.md"
```

**If using charts/data visualization:**
// turbo
```bash
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/charts.md"
```

**If using Lottie animations:**
// turbo
```bash
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/lottie.md"
```

**If using GIFs:**
// turbo
```bash
cat "C:/Users/johno/.gemini/antigravity/skills/remotion/rules/gifs.md"
```

> ⛔ **DO NOT PROCEED TO PHASE 1 UNTIL YOU HAVE READ THE RELEVANT RULES.**

---

## PHASE 1: Video Specification

Generate a **Video Spec Document** in `docs/remotion/[video_name]_spec.md`.

### Step 1.1: Generate the Video Spec

Create the spec with this structure:

```markdown
# 🎬 Video Spec: [Video Name]

## Overview
| Property | Value |
|----------|-------|
| **Type** | [Main/Short/B-Roll/Intro/Outro] |
| **Duration** | [X seconds] (Y frames @ Zfps) |
| **Resolution** | [WxH] |
| **FPS** | 30 |
| **Composition ID** | `[CompositionId]` |

## Rules I Read Before Writing This Spec
- [x] animations.md
- [x] timing.md
- [x] sequencing.md
- [ ] transitions.md (if applicable)
- [ ] text-animations.md (if applicable)
- [ ] ... (list all rules you read)

## Creative Direction
[1-2 sentences describing the visual concept]

### Color Palette
| Color | Hex | Usage |
|-------|-----|-------|
| Primary | #XXXXXX | [usage] |

### Typography
| Font | Weight | Size | Usage |
|------|--------|------|-------|
| [Font Name] | [weight] | [px] | [usage] |

---

## Scene Breakdown

### Scene 1: [Name] (0s - Xs)
**Duration**: X seconds (Y frames)

#### Visual Elements
- [ ] Element 1: [Description]

#### Animations (from timing.md / animations.md)
| Element | Type | Start | End | Easing |
|---------|------|-------|-----|--------|
| [Element] | [fadeIn/spring/interpolate] | X | Y | [spring({damping:200}) / Easing.out(Easing.exp)] |

#### Code Approach
\```tsx
// Frame-by-frame animation using useCurrentFrame() - NEVER CSS transitions
const frame = useCurrentFrame();
const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
\```

---

## Technical Requirements

### Props Schema (Zod)
\```ts
import { z } from "zod";
export const [Id]Schema = z.object({ ... });
\```

### Critical Rules (MEMORIZE THESE)
> ⛔ FORBIDDEN: CSS transitions, CSS animations, Tailwind animation classes
> ✅ REQUIRED: All animations via useCurrentFrame() + interpolate()/spring()
> ✅ REQUIRED: premountFor={1 * fps} on all <Sequence> components
> ✅ REQUIRED: staticFile() for public folder assets
> ✅ REQUIRED: Clamp extrapolation to prevent values going beyond range
```

### Step 1.2: Request Approval

Use `notify_user` with `BlockedOnUser: true` to request spec approval.

---

## PHASE 2: Asset Audit

After spec approval, generate an **Asset Manifest**.

### Step 2.1: Generate Asset Manifest

Create `docs/remotion/[video_name]_assets.md`:

```markdown
# 🎨 Asset Manifest: [Video Name]

## 1. Code-Generatable Components ✅
*These can be built entirely with React/SVG code*

| Component | Description | Complexity |
|-----------|-------------|------------|
| `ComponentName.tsx` | Description | Low/Medium/High |

---

## 2. Image Prompts for User 🖼️
*I CANNOT generate these myself. I am providing prompts for YOU to generate.*

> **Instructions for User:**
> Use these prompts with your preferred image generation tool (Midjourney, DALL-E, generate_image tool, etc.)
> After generating, save the images to `public/assets/[video_name]/`

| Asset | Prompt | Size | Save As |
|-------|--------|------|---------|
| Background | "Abstract dark gradient with subtle grid pattern, cyberpunk aesthetic, 16:9 aspect ratio" | 1920x1080 | `bg_hero.png` |
| Logo Icon | "Minimal geometric logo, neon cyan glow, dark background, icon style, square" | 512x512 | `logo.png` |

**Total prompts**: X images for you to generate

---

## 3. External Assets Needed 📦
*These require you to provide - stock footage, your logos, audio files*

| Asset | Type | Description | Action |
|-------|------|-------------|--------|
| Your Logo | SVG/PNG | Your brand logo | You provide |
| Background Music | MP3 | Ambient tech music | Source from [Epidemic Sound](https://epidemicsound.com) |
| Screen Recording | MP4 | Demo of your app | You record |

---

## 4. Your Choices ⚡

Tell me for each:

| Item | Options |
|------|---------|
| UI Mockups | [ ] I'll build code components / [ ] I'll provide screenshots |
| Background | [ ] Generate with prompt above / [ ] I'll provide my own |
| Logo | [ ] Generate with prompt above / [ ] I'll provide my own |

---

## After You Decide

**If you want me to proceed with code components:**
Reply: "Build the components"

**If you want to generate images first:**
Run the prompts yourself, then reply: "Assets ready in public/assets/[folder]"

**If you're providing your own assets:**
Reply: "I'm providing: [list files] - they're in public/assets/[folder]"
```

### Step 2.2: Wait for User

Use `notify_user` with `BlockedOnUser: true`. Do NOT proceed until user responds with their choices.

---

## PHASE 3: Component Building

Only after user confirms assets OR chooses code-gen:

### Step 3.1: Create Components

For each component in the manifest:
1. Re-read the relevant rule files (animations.md, timing.md, etc.)
2. Create the component following patterns from the rules EXACTLY
3. Use `useCurrentFrame()` for ALL animations
4. NEVER use CSS transitions or Tailwind animation classes

### Step 3.2: Create Main Composition

1. Import all components
2. Set up `<Sequence>` structure per the spec
3. Add `premountFor={1 * fps}` to every Sequence
4. Register in `Root.tsx`

---

## PHASE 4: Verification

### Step 4.1: Start Studio
// turbo
```bash
pnpm start
```

### Step 4.2: Manual Verification
1. Open composition in browser
2. Scrub through timeline
3. Verify all animations trigger at correct frames
4. Check console for errors

---

## Quick Reference (From Rules)

### Interpolation (from timing.md)
```tsx
const opacity = interpolate(frame, [0, 30], [0, 1], {
  extrapolateRight: 'clamp',
  extrapolateLeft: 'clamp',
});
```

### Spring (from timing.md)
```tsx
const scale = spring({
  frame,
  fps,
  config: { damping: 200 }, // Smooth, no bounce
});
```

### Sequence (from sequencing.md)
```tsx
<Sequence from={1 * fps} durationInFrames={2 * fps} premountFor={1 * fps}>
  <MyComponent />
</Sequence>
```

### Assets (from assets.md)
```tsx
import { Img, staticFile } from 'remotion';
<Img src={staticFile('image.png')} />
```
