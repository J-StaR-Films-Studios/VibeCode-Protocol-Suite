To increase the reliability of AI-generated code, you can implement several architectural and workflow changes discussed in the video and common in modern development practices.

### Insights from the Video

* **Full Stack Type Safety:** Maintain a tightly-knit type relationship between your back end and front end. This provides immediate feedback to an AI agent; if a back-end change breaks the front end, the type-checker will flag it, allowing the agent to self-correct [[04:42](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=282)].
* **Unified Language (TypeScript):** Using the same language on both sides allows the Language Server Protocol (LSP) to treat the entire codebase as a single entity. This makes it significantly more reliable for an AI to trace types across the stack [[05:16](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=316)].
* **Command-Line Feedback Loops:** Ensure your environment has a simple command the AI can run to verify if the back end and front end agree (e.g., a full-project build or type-check). Without this, an agent may struggle to know when it has actually solved a problem [[06:45](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=405)].
* **Colocation of Logic and UI:** Tools like Tailwind that collocate styles, logic, and UI in a single file make it easier for AI to understand the context of a component without jumping between multiple files [[07:04](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=424)].
* **Agentic Development Tools:** Utilize tools that have direct access to your type system. Seeing an agent write code, catch its own type errors, and fix them automatically is far more reliable than manual copy-pasting [[19:20](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=1160)].
* **AI-Driven Test-Driven Development (TDD):** Define "success" for the agent through tests first. An agent can then run in a loop, attempting to fulfill the requirements of the test until it succeeds [[25:07](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=1507)].
* **Selective Use of Return Types:** While type inference is often preferred, explicitly defining return types for functions can provide critical context to AI agents about what a function *should* return, helping it understand the intended "shape" of data in your context [[32:34](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=1954)].
* **Pre-commit Hooks for Agents:** Implement pre-commit hooks (like type checks or linting) specifically for AI agents. This "lack of trust" forces the agent to fix breaking changes before they ever reach your version history [[34:44](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=2084)].
* **Ask Mode for Navigation:** Instead of letting an agent guess where code is implemented, use "Ask Mode" or search tools to have it find specific entry points or implementation details across the codebase [[37:33](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=2253)].

### Additional Best Practices for Reliability

* **Strict Configuration Rules:** Create a `.cursorrules` file or a specific system prompt to enforce coding patterns, such as "always use functional components" or "strictly avoid the `any` type."
* **Context Pruning:** Avoid overloading the AI with the entire repository. Manually pinning only the most relevant files (e.g., the specific schema, API route, and component you are working on) reduces the likelihood of "hallucinations" caused by irrelevant code.
* **Small, Incremental PRs:** AI reliability drops as the complexity of the request increases. Break down large features into small, testable chunks that the AI can handle one at a time.
* **Modular Architecture:** The more decoupled your code is, the easier it is for an AI to reason about a single module without needing to understand the "spaghetti" of the rest of the application.
* **Manual Validation:** Despite high-quality automation, "manual testing" remains essential. Running the application yourself to ensure the "vibe" and functionality meet expectations catches edge cases that automated tests might miss [[28:03](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=1683)].

**Video Source:** [My hot takes are wrong now (I blame AI)](https://www.google.com/search?q=https://www.youtube.com/watch%3Fv%3DCL0vkl8Sxvs)

To increase the reliability of your AI-generated code, the speaker (Theo) emphasized that the "feedback loop" provided by your tech stack is the most important factor. Here are the specific details and examples he mentioned for Full Stack Type Safety and a Unified Language:


### 1. Full Stack Type Safety

The core idea is that if you change something in your database or backend, your frontend code should immediately show a "red squiggly line" (type error) before you even run the app. This allows an AI agent to catch its own mistakes by running a simple type-check command.

* **What he uses/recommends:**
* **tRPC:** His long-time favorite. It allows the frontend to "import" the types of your backend functions directly, so there is no mismatch between what the backend sends and what the frontend expects [[04:21](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=261)].
* **Convex:** He currently uses this for his database and backend. It provides an end-to-end type-safe experience out of the box [[04:30](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=270)].
* **TanStack Start / TanStack Router:** He mentions these for defining "server functions" that maintain type safety between the server and the browser [[04:21](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=261), [08:35](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=515)].
* **Next.js Server Components:** He notes they provide great type-safety benefits because you're writing backend code that returns UI directly [[04:16](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=256)].


* **What he says to avoid (if possible):**
* **Manual Codegen (OpenAPI/GraphQL):** While viable, he considers this "clunky" because it requires an extra build step to generate types from a spec. If you *must* use a non-TypeScript backend, he suggests tools like **`openapi-ts`** (often paired with **React Query**) to generate those definitions [[05:48](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=348)].



### 2. Unified Language (TypeScript)

He argues that having TypeScript on both the frontend and backend is the "gold standard" for AI reliability.

* **The "One Entity" Concept:** When your whole project is TypeScript, the **LSP (Language Server Protocol)** treats the entire codebase as a single unit. This means an AI agent can "see" through a function call on the frontend all the way into the database schema on the backend as if it were one file [[05:21](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=321)].
* **The Problem with Other Languages:**
* **Rust and Go:** He acknowledges they are great for performance, but warns they make your life harder for 99% of web apps. Because they require a "translation layer" (like OpenAPI) to talk to a TypeScript frontend, the AI loses the ability to trace types perfectly across the stack [[06:19](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=379)].
* **The Takeaway:** Unless you are "saving every single compute cycle," stick to TypeScript for the backend so the AI has maximum context to catch errors [[06:35](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=395)].



### Summary of Tools Mentioned

| Category | Recommended Tools |
| --- | --- |
| **Frameworks** | Next.js, TanStack Start, Vite [[08:35](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=515)] |
| **Backends/DBs** | Convex, tRPC [[04:30](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=270)] |
| **Styling** | Tailwind CSS (helps by keeping logic and UI in one file) [[07:04](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=424)] |
| **Deployment** | Railway (he mentioned this as his preferred hosting platform) [[01:31](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=91)] |

**Direct Answer:** He specifically uses **Convex**, **TypeScript**, **Next.js**, and **Tailwind** in his current "vibe coding" workflow because they minimize the number of files and "translation layers" the AI has to deal with [[08:40](http://www.youtube.com/watch?v=CL0vkl8Sxvs&t=520)].