# ✨ **ULTIMATE ORCHESTRATION PROMPT (HYBRID MODEL)** ✨

**Objective:** To initiate a new project by having you (the AI Orchestrator) build a Minimum Usable State (MUS) and generate a complete, step-by-step prompting roadmap for all subsequent features. Each step must be self-contained and enforce a strict "Plan-and-Solve" methodology.

**Instructions for You (The AI Orchestrator):**  
Upon receiving this completed prompt, you MUST execute the following phases sequentially. DO NOT DEVIATE OR MAKE ASSUMPTIONS.

---

### **Phase 1: Initial Planning & Full Implementation Roadmap Generation**

**A. Generate `Project_Requirements.md` (The Master PRD):**

- Generate a definitive Product Requirements Document using the provided project details.
    
- The PRD must contain ALL requirements (MUS and Future).
    
- **You MUST use the following Markdown table format. NO other format is acceptable:**
    

```markdown
| Requirement ID | Description | User Story | Expected Behavior / Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| FR-001 | ... | ... | ... | MUS |
| FR-002 | ... | ... | ... | Future |
```

- Assign a unique, sequential `FR-XXX` ID and correctly mark the `Status` column as either `MUS` or `Future`.
    

---

**B. Generate `Coding_Guidelines.md` (The Project Rulebook):**

- Generate a comprehensive document detailing project standards.
    
- **It MUST include the following sections:**
    
    1. **Architecture:** High-level overview of the application’s structure. You MUST intelligently recommend the most appropriate architecture style (e.g., feature-based, layered, modular, or service-oriented) based on the technology stack provided.
        
    2. **Technology Stack:** List of all languages, frameworks, and libraries.
        
    3. **Project Directory Structure:** Define the canonical file structure. You MUST design this structure according to best practices for the chosen stack. Example: a Next.js app would follow feature-based folders; a Python backend may use service/modules; a Rust CLI may use crates. In all cases, you MUST include a `/docs` directory for all documentation (PRD, Coding Guidelines, etc.).
        
    4. **Coding Style & Conventions:** Naming conventions, formatting rules, and best practices.
        

---

**C. Generate the Full Implementation Roadmap:**  
This will be a multi-part output consisting of distinct, self-contained prompts for an AI Executor agent.

1. **The Manus MUS Prompt:** Create a single, powerful prompt for the AI Executor to perform the initial project setup and build **only the MUS features**. This prompt MUST explicitly instruct the agent to:
    
    - Create the full project directory structure as defined in `Coding_Guidelines.md`, including the `/docs` folder.
        
    - Take the content of `Project_Requirements.md` and `Coding_Guidelines.md` (which you will provide within the prompt) and place them into `/docs/Project_Requirements.md` and `/docs/Coding_Guidelines.md` respectively.
        
    - Implement ALL requirements marked as `MUS` in the PRD.
        
    - Upon completion, generate a `Manus_Handoff_Report.md` in the project root, detailing all files created/modified and confirming MUS completion.
        
2. **The Post-MUS "Plan-and-Solve" Prompts:** For **each** individual requirement marked with "Future" status in the PRD, you MUST generate a separate, numbered, and self-contained prompt. Each prompt must instruct the AI Executor to follow a strict **two-step Plan-and-Solve process**. Use the exact template below for each future-feature prompt:
    

> **"Instructions for the AI Executor:**
> 
> **Requirement ID:** `[Insert FR-XXX here]`
> 
> You are to implement the feature specified by the Requirement ID above. You must operate under the assumption that the project exists in the state left by the previous step. All project documentation, including the master PRD and coding standards, is located in the `/docs` directory. STRICT ADHERENCE to the following process is mandatory. DO NOT write any code until you have completed Step 1.
> 
> **Step 1: Generate the Implementation Plan.**  
> First, create a detailed implementation plan in a Markdown block. This plan is a micro-specification and must include:
> 
> - **Objective:** A one-sentence summary of the feature.
>     
> - **Files to be Created/Modified:** A bulleted list specifying the full path from the project root for all files that will be touched.
>     
> - **Key Functions/Components/Logic to be Added/Modified:** A detailed breakdown of the new logic, classes, or functions.
>     
> - **Data Schema / Type Definition Changes (if any):** Detail any changes to database models, type interfaces, or data structures.
>     
> - **Acceptance Criteria:** 2-3 precise, testable bullet points that define when this feature is "done."
>     
> 
> **Step 2: Execute the Plan.**  
> After you have outputted the complete and final plan from Step 1, AND ONLY THEN, begin a new section titled "Code Implementation" and provide the complete, final code required to execute your plan. Adhere strictly to the plan you just created and the project's `Coding_Guidelines.md`."

---

### **Phase 2: Provide Phase 1 Output to User**

Present to the user:

1. The generated content for `Project_Requirements.md`
    
2. The generated content for `Coding_Guidelines.md`
    
3. The single Manus MUS Prompt
    
4. The full, numbered list of all Post-MUS "Plan-and-Solve" Prompts
    

---

**[[ PLEASE FILL OUT THE FOLLOWING FOR YOUR NEW PROJECT ]]]**

**A. PROJECT CORE DETAILS**  
**B. TECHNOLOGY STACK**  
**C. MINIMUM USABLE STATE (MUS) - FUNCTIONAL REQUIREMENTS**  
**D. PLANNED FUTURE FUNCTIONAL REQUIREMENTS (Post-MUS)**  
**E. OTHER INITIAL THOUGHTS (Optional)**

---
