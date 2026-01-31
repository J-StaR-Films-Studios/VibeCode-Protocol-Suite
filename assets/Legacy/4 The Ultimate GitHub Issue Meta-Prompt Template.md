### The Ultimate GitHub Issue "Meta-Prompt" Template

> **Prompt for AI Agent: Generate a Professional GitHub Issue**
>
> **Objective:**
> Your task is to generate a complete, professionally formatted GitHub Issue based on the details I provide below. The issue should be clear, actionable, and follow a structured format that makes it easy for any developer (human or AI) to understand the problem and the proposed solution.
>
> **Instructions:**
> Use the information in the `[[...]]` sections to populate the template. Adhere strictly to the Markdown formatting.
>
> ---
>
> **[[ 1. Type of Issue: (Choose one: Bug Report / Feature Request / Refactor / Documentation) ]]**
>
> **[[ 2. Title of the Issue: (A clear, concise summary of the bug or feature) ]]**
>
> **[[ 3. Labels: (Provide a comma-separated list of relevant labels, e.g., `bug`, `enhancement`, `critical-ux`, `v1.2`, `help-wanted`, `clipboard`) ]]**
>
> **[[ 4. Problem Description / User Story: (Describe the problem from a user's perspective. What is happening that shouldn't be, or what is the user trying to achieve? If it's a bug, include steps to reproduce.) ]]**
>
> **[[ 5. Root Cause Analysis / Proposed Solution: (This is the "Plan-and-Solve" part. Explain the technical reason for the issue and outline a clear, step-by-step plan for the fix or implementation. Mention specific files, functions, or libraries that need to be added or modified.) ]]**
>
> **[[ 6. Acceptance Criteria: (Provide a short, bulleted list of testable outcomes that will prove the issue has been successfully resolved. How will we know it's "done"?) ]]**
>
> ---
>
> **Your Deliverable:**
> Based on the information above, generate the complete text for the GitHub Issue, including the title and the fully formatted body.

---

### How to Use the Template: An Example

Let's use our screenshot bug as an example. You would fill out the template like this:

**[[ 1. Type of Issue: ]]**
`Bug Report`

**[[ 2. Title of the Issue: ]]**
`Multimodal query fails to recognize image data from screenshots on the clipboard`

**[[ 3. Labels: ]]**
`bug`, `multimodal`, `clipboard`, `critical-ux`

**[[ 4. Problem Description / User Story: ]]**
`As a user, when I take a screenshot with the Windows Snipping Tool (Win+Shift+S), I expect to be able to use that image directly with Blink's multimodal feature. Currently, the feature only works if I save the screenshot as a file and copy the file. This breaks the workflow. Steps to reproduce: 1. Take a screenshot. 2. Verify it's on the clipboard by pasting in Paint. 3. Try to use the multimodal hotkey. 4. Observe that the query fails.`

**[[ 5. Root Cause Analysis / Proposed Solution: ]]**
`The root cause is that our clipboard manager only checks for file paths (CF_HDROP format) and text. It does not check for raw image data (CF_DIB format). The solution is to refactor clipboard_manager.py to use the Pillow library's ImageGrab.grabclipboard() function to detect and handle image data directly. The check for image data must be prioritized before checking for file paths. The hotkey_manager.py then needs to be updated to handle this new 'image_data' type by Base64 encoding it and sending it to the LLM.`

**[[ 6. Acceptance Criteria: ]]**
`- After taking a screenshot with Win+Shift+S, using the multimodal hotkey successfully sends the image to the LLM.`
`- Copying an image file from Explorer continues to work correctly.`
`- The system correctly prioritizes screenshot data over any old file paths on the clipboard.`
