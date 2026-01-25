---
name: high-fidelity-extraction
description: Advanced protocol for extracting granular social media and web intelligence using browser automation and DOM analysis.
---

# High Fidelity Data Extraction Protocol

This skill enables the agent to extract deep intelligence from social media platforms (Instagram, TikTok, YouTube, etc.) and complex web environments with high precision.

## 🚀 Core Philosophy: The Extraction Spectrum

When tasked with extraction, always check the prompt for specific limitations. If no limitations are provided, assume **Standard Level**.

### Extraction Capability Matrix

| Feature | Basic (Standard) | Deep (Advanced) | Elite (Full Intelligence) |
| :--- | :--- | :--- | :--- |
| **Captions** | Full Text + Hashtags | + Edited timestamps | + OCR from video overlays |
| **Comments** | Top 3-5 (Top Level) | Top 10 + Threaded replies | Full sentiment & pain point mapping |
| **Engagement** | Likes / Views count | Engagement Rate % | Share/Save estimates & Viral Velocity |
| **Brand Intel** | @Mentions in caption | + Link-in-bio analysis | + Competitor comparison vs Meta Ad Library |
| **Visuals** | Profile Screen/Grid | Individual Post Screenshots | UI/UX Reverse Engineering of Funnel |
| **Technical** | URL collection | Precise ISO Timestamps | API Pattern Mapping & DB Schema generation |

## 📊 Tabular Output Format

Unless the user specifies otherwise, all extracted data should be compiled into a Markdown table for maximum scannability.

### Standard Template:
```markdown
| Post Type | Caption Snippet | Top Comments (Synthesized) | Key Metrics | Brand/Tags |
| :--- | :--- | :--- | :--- | :--- |
| Pinned | "How to be..." | Users asking about discipline tips | 30k Likes | @Adidas, #NYC |
| Recent 1 | "Day in life..." | High praise for work/life balance | 15k Views | @CeraVe |
```

## 🧠 Smart Filtering Strategy (Instagram Reels)
When the goal involves "high-performing" content or maximizing engagement:

1.  **Reels First**: Navigate to the `/reels/` tab immediately. View counts are not visible on the main grid but are overlayed on Reel thumbnails.
2.  **Baseline Calculation**: 
    - Extract view counts from the first 6-12 visible Reels.
    - Calculate the **average (mean)** view count.
3.  **Filtration**:
    - Only click/extract posts that exceed this average.
    - This ensures we focus valuable browser resources on proven content.

## 🛠️ Execution Instructions for the Subagent

1.  **DOM First**: Never navigate blindly. Use `browser_get_dom` to identify the obfuscated class names for captions and comments.
2.  **Surgical Navigation**: To avoid 429 errors (Too Many Requests), navigate directly to post URLs once the links are gathered from the grid, rather than infinite scrolling.
3.  **Expansion Logic**: Always look for `... more` or "View all comments" buttons and trigger them via JavaScript to ensure data completeness.
4.  **Verification**: Always capture a final screenshot of the "Main Extraction Target" to verify text accuracy against the visual truth.

## 🛑 Limitations & Compliance

- **Obey Prompt Bounds**: If the user says "Only get usernames," do NOT extract captions. 
- **Privacy**: Respect platform TOS by focusing on public-facing data and ignoring private user details.
- **Anti-Spam**: Filter out "Promote on..." or generic bot comments automatically.
