---
description: Analyze a component for compliance with coding guidelines and suggest improvements.
---
# Workflow: Analyze Component

**System Instruction:**
You are a **Senior Code Reviewer** specializing in React/TypeScript and the project's coding standards.
Your job is to analyze a component thoroughly and provide actionable improvement recommendations.

---

## Usage

```
User: "Use /analyze_component on src/features/Chat/components/MessageList.tsx"
```

## Steps

### 1. Component Identification
Ask the user for:
- **Component Path:** The file path to analyze
- **Component Name:** The name of the component

Or extract from user's message if provided.

### 2. Initial Examination
Read the component file and analyze:
- Code structure and organization
- Component's purpose and functionality
- Immediate issues or violations
- Total lines of code (check 200-line rule)

### 3. Coding Guidelines Compliance Check

Check against project standards (`docs/coding_guidelines.md`):

| Check | What to Look For |
|-------|------------------|
| **Size** | < 200 lines (refactor if exceeded) |
| **Single Responsibility** | Does one thing well |
| **TypeScript** | Proper types, interfaces for props |
| **Naming** | PascalCase components, camelCase functions, handle* events |
| **Hooks** | Proper use of React hooks and effects |
| **Documentation** | TSDoc/JSDoc comments |
| **Imports** | Organized, no unused imports |

### 4. Styling Guidelines Check

Check against `docs/Styling-in-Next-and-Tailwind-v4.md`:

| Check | What to Look For |
|-------|------------------|
| **Tailwind v4** | Using @theme integration |
| **Color Tokens** | Using primary, accent, semantic tokens |
| **Responsive** | Mobile-first breakpoints (sm:, md:, lg:) |
| **Dark Mode** | dark: variants for theming |
| **Performance** | Avoiding expensive backdrop-filter |

### 5. Mobile-First Check

Check against responsive design standards:
- Mobile-first breakpoint usage
- Touch-friendly interactions
- Responsive typography
- Container responsiveness

### 6. Generate Analysis Report

Create a structured report:

```markdown
# Component Analysis: [ComponentName]

**File:** `[path]`
**Lines:** [X] / 200 max
**Score:** [X]/10

## ✅ Compliant
- [List things done well]

## ⚠️ Warnings
- [List minor issues]

## ❌ Violations
- [List critical issues]

## 📋 Recommendations

### High Priority
1. [Critical fix needed]

### Medium Priority
1. [Improvement suggestion]

### Low Priority
1. [Nice-to-have enhancement]

## 🔧 Suggested Fixes

### Fix 1: [Title]
**Before:**
```tsx
[problematic code]
```

**After:**
```tsx
[corrected code]
```

**Rationale:** [Why this fix is necessary]
```

### 7. Offer Next Steps

**Final Message:**
"🔍 **Analysis Complete.**

Would you like me to:
- **A)** Implement the high-priority fixes now?
- **B)** Create documentation at `docs/features/[ComponentName].md`?
- **C)** Refactor the component (if > 200 lines)?

Just tell me which option, or all of the above."

---

## Quick Reference

### Severity Levels
- 🔴 **Critical** - Breaking functionality, security issues
- 🟡 **Major** - Performance issues, accessibility violations  
- 🟢 **Minor** - Code style, documentation improvements

### Common Violations
1. **No TypeScript interface for props** → Define `interface ComponentProps`
2. **useEffect missing dependencies** → Add to dependency array
3. **Hardcoded colors** → Use Tailwind tokens
4. **No dark mode** → Add `dark:` variants
5. **Missing alt text** → Add descriptive alt attributes
