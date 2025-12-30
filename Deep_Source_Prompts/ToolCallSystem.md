# Tool Call System: Achieving Near-Perfect Tool Accuracy

## Overview

The JohnGPT tool call system achieves near-perfect accuracy through a **three-pillar architecture**:
1. **Structured System Prompts** with explicit tool guidelines
2. **Strongly-Typed Tool Definitions** using Zod schemas
3. **Vector-Powered Execution** for semantic understanding

This document explains the architectural decisions that make tool calls reliable and consistent.

---

## Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Client (Browser)"]
        A[User Input] --> B[useChat Hook]
        B -->|UIMessage[]| C[POST /api/chat]
    end

    subgraph Server["API Route"]
        C --> D[PromptManager.getSystemPrompt]
        D --> E[streamText with Tools]
        E -->|Tool Invocation| F{Which Tool?}
        F -->|searchKnowledge| G[RAG Utils]
        F -->|goTo| H[findDestination]
        G -->|Vector Search| I[(PostgreSQL + pgvector)]
        H -->|Vector Search| I
    end

    subgraph Response["Response Flow"]
        E -->|Stream| J[toUIMessageStreamResponse]
        J -->|Action Payload| K[Client Handles Action]
    end
```

---

## Pillar 1: Structured System Prompts

The key to reliable tool invocation is **teaching the model WHEN to use tools vs when to rely on its own knowledge.**

### The Problem

Without guidance, LLMs will over-call tools for every question, leading to:
- Slow responses (unnecessary DB queries)
- Incorrect answers (searching for general knowledge)
- Poor UX (latency spikes)

### The Solution: Contextual Tool Guidelines

In [prompt-manager.ts](file:///c:/CreativeOS/01_Projects/Code/jstar-platform/src/lib/ai/prompt-manager.ts):

```typescript
private static getToolingRules(context: ChatContext): string {
  return `
<tool_guidelines>
  1. SEARCH_KNOWLEDGE:
     - **TRIGGER (STRICT):** Use ONLY for questions about **J StaR proprietary info** 
       (Pricing, specific services, John's personal bio, Portfolio items).
     - **FORBIDDEN:** DO NOT search the database for:
       * General opinions (e.g., "Is DaVinci good?")
       * General definitions (e.g., "What is Next.js?")
       * Jokes, Small Talk, or General Advice.

  2. GOTO_TOOL (Unified Navigation):
     - **TRIGGER:** User wants to change their view or "see" something.
     - **USAGE:**
       * User: "Go to services" -> goTo({ destination: "services" })
       * User: "Show me the pricing" -> goTo({ destination: "pricing" })
     - **RULE:** If the user asks "Where is X?", DO NOT explain where it is. 
       Just take them there using this tool.
</tool_guidelines>`;
}
```

### Key Techniques

| Technique | Description | Example |
|-----------|-------------|---------|
| **Explicit Triggers** | Define exactly when to use each tool | `TRIGGER (STRICT): Use ONLY for...` |
| **Forbidden Cases** | List what NOT to do | `DO NOT search the database for...` |
| **Usage Examples** | Show input → output mappings | `"Go to services" → goTo({...})` |
| **The "Google Test"** | If Google could answer it, don't search | General coding questions |

---

## Pillar 2: Strongly-Typed Tool Definitions

Using Vercel AI SDK's `tool()` helper with Zod schemas ensures:
1. **Type safety** at compile time
2. **Clear descriptions** for the LLM
3. **Structured outputs** for the client

### Tool Definition Pattern

From [route.ts](file:///c:/CreativeOS/01_Projects/Code/jstar-platform/src/app/api/chat/route.ts):

```typescript
import { tool } from 'ai';
import { z } from 'zod';

tools: {
  searchKnowledge: tool({
    description: 'Search the knowledge base for ANY information related to J StaR, 
                  including services, portfolio, team members, testimonials, pricing, 
                  or specific details found on the website.',
    inputSchema: z.object({
      query: z.string().describe('What to search for in the knowledge base'),
    }),
    execute: async ({ query }) => {
      const results = await searchKnowledgeBase(query, 5);
      return formatSearchResults(results);
    },
  }),

  goTo: tool({
    description: `Smart navigation tool. Handles BOTH page navigation AND section scrolling.
Use when user says "go to X", "show me X", "take me to X".
EXAMPLES:
- "show me services" → goTo({destination: "services"})
- "take me to pricing" → goTo({destination: "pricing"})
NEGATIVE: Do NOT use for general questions, greetings, or casual chat.`,
    inputSchema: z.object({
      destination: z.string().describe('Where the user wants to go'),
    }),
    execute: async ({ destination }) => { /* ... */ },
  }),
}
```

### Why This Works

1. **Rich Descriptions** - The `description` field is consumed by the model to decide WHEN to invoke the tool. Include both positive and negative examples.

2. **Zod Schemas** - Validate inputs automatically. If the model produces malformed input, it fails fast.

3. **Simple Parameters** - Single, clear parameters reduce model confusion. `destination: string` is easier to predict than complex nested objects.

---

## Pillar 3: Vector-Powered Execution

Both tools leverage **semantic understanding** via vector embeddings stored in PostgreSQL with pgvector.

### searchKnowledge → RAG System

From [rag-utils.ts](file:///c:/CreativeOS/01_Projects/Code/jstar-platform/src/lib/ai/rag-utils.ts):

```typescript
export async function searchKnowledgeBase(query: string, limit: number = 5) {
  // Generate embedding for the query
  const queryEmbedding = await generateQueryEmbedding(query);
  
  // Cosine similarity search via pgvector
  const results = await prisma.$queryRaw`
    SELECT 
      page_url, page_title, content_chunk,
      1 - (embedding <=> ${embeddingString}::vector) as similarity
    FROM site_embeddings
    WHERE 1 - (embedding <=> ${embeddingString}::vector) > 0.3
    ORDER BY embedding <=> ${embeddingString}::vector
    LIMIT ${limit}
  `;
  return results;
}
```

### goTo → Smart Destination Finder

From [findDestination.ts](file:///c:/CreativeOS/01_Projects/Code/jstar-platform/src/lib/ai/findDestination.ts):

The `goTo` tool uses vector search to match user intent to both **pages** and **sections**:

```typescript
export async function findDestination(query: string, currentPath: string) {
  const queryEmbedding = await generateQueryEmbedding(query);
  
  // Search BOTH pages and sections
  const pageResults = await prisma.$queryRaw`
    SELECT url, title, 1 - (embedding <=> ${embedding}::vector) as similarity
    FROM page_navigation
    WHERE 1 - (embedding <=> ${embedding}::vector) > 0.4
  `;
  
  const sectionResults = await prisma.$queryRaw`
    SELECT element_id, title, page_url, 
           1 - (embedding <=> ${embedding}::vector) as similarity
    FROM page_sections
    WHERE 1 - (embedding <=> ${embedding}::vector) > 0.4
  `;
  
  // Smart resolution logic...
}
```

### Smart Resolution Logic

The system handles context-aware navigation:

| Scenario | Action |
|----------|--------|
| User on `/` says "show me pricing" | Returns `scrollToSection` if a pricing section exists on the current page |
| User on `/about` says "go to services" | Returns `navigate` to `/services` |
| User says "show me the portfolio section" | Returns `navigateAndScroll` to page + section |

---

## The "stopWhen" Safety

To prevent infinite tool loops, we use:

```typescript
const result = await streamText({
  model: selectedModel,
  messages: modelMessages,
  system: systemPrompt,
  stopWhen: stepCountIs(5), // Allow AI to continue after tool execution for up to 5 steps
  maxRetries: 2,
  tools: { /* ... */ },
});
```

This allows the model to:
1. Call a tool
2. Process the result
3. Respond to the user OR call another tool
4. Repeat up to 5 steps total

---

## Response Format

Tool results are returned as **structured action payloads** that the client can interpret:

```typescript
// goTo tool returns structured actions
return {
  action: 'navigate' | 'scrollToSection' | 'navigateAndScroll' | 'showLoginComponent',
  url?: string,
  sectionId?: string,
  title?: string,
  message: string, // Human-readable confirmation
};
```

The client-side hook then handles these actions:
- **navigate** → `router.push(url)`
- **scrollToSection** → `document.getElementById(sectionId)?.scrollIntoView()`
- **navigateAndScroll** → Navigate then scroll after page load

---

## Summary: The 5 Keys to Perfect Tool Calls

1. **Explicit Triggers** – Tell the model exactly when to use each tool
2. **Forbidden Cases** – Tell it when NOT to use tools
3. **Usage Examples** – Show input → output in the description
4. **Simple Schemas** – One clear parameter per tool
5. **Vector Intelligence** – Use embeddings for semantic matching, not keyword matching

---

## Related Documentation

- [RAG-KnowledgeBase.md](file:///c:/CreativeOS/01_Projects/Code/jstar-platform/docs/features/john-gpt/RAG-KnowledgeBase.md) - How site content is embedded
- [UnifiedNavigation.md](file:///c:/CreativeOS/01_Projects/Code/jstar-platform/docs/features/john-gpt/UnifiedNavigation.md) - Navigation system architecture
- [AdvancedNavigationSystem.md](file:///c:/CreativeOS/01_Projects/Code/jstar-platform/docs/features/AdvancedNavigationSystem.md) - Page/Section embedding system
