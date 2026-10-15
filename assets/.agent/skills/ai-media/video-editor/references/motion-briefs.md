# Motion direction and implementation briefs

Use this reference when motion design is the chosen treatment or when the user requests a standalone motion film. The main agent originates the visual idea and writes the build brief. A subagent can execute it, but the main agent remains responsible for whether the sequence communicates and feels intentional.

Do not use motion design to avoid inspecting or sourcing footage. Do not turn every editorial beat into animation. Within a standalone film, let the story determine the visual world instead of carrying over a client's palette, captions or talking-head layout.

## Find an idea worth animating

Establish what changes in the story and what the viewer should understand or feel by the ending. Separate supplied facts from fictional invention. Invent events and worlds when the user has authorized fiction; never invent product capabilities, portfolio evidence or measured outcomes.

For an open creative brief, sketch three distinct premises in short working notes before selecting one. Change the story mechanism, material behavior or point of view between candidates. Recoloring the same cards is not divergence. For a tightly specified brief, develop the supplied direction instead. Give a concise selection rationale, not private deliberation or ceremonial scores. Ask the user to choose only when they requested options or a material decision needs approval.

Name the obvious first association and look beyond it. A story about time need not become a clock, and a story about growth need not become a bar chart. Investigate what the subject does, resists, leaves behind, mistakes or becomes. Unexpected relationships are useful when viewers can follow their logic.

Choose a visual premise precise enough to guide decisions without naming a library. Decide how this world behaves: what has weight, what stretches, what leaves a trace, what refuses to move, what changes the rules. A recurring behavior can set up an expectation that the ending overturns. Surprise should change our understanding, not merely add another effect.

When the user requests bold, unusual work, do not retreat to the easiest standard UI or typography treatment. Develop a subject-specific visual mechanism and prototype its difficult moment. Reduce implementation complexity before abandoning the creative idea. If a genuine limitation requires changing that idea, explain the trade-off rather than silently substituting a generic animation.

Novelty can come from staging, rhythm, typography, character behavior, material or an unexpected ending. Do not require every film to morph objects, move the camera constantly or use a continuous take. A deliberate cut, stillness or a bare frame can be the strongest choice. The concept should remain recognizable without its palette or technical effects.

## Calibrate art direction without copying

When originating a standalone film or substantial motion passage, first record a short seed direction from the current subject: selected premise, ending and subject-specific behavior. Do this before opening the worked examples. Then read both complete prompts and their annotations:

- [Product-launch example](motion-examples/product-launch.md) demonstrates role-changing objects, photographic/UI compositions and connected handoffs. Its user-tested execution is evidence of implementation capability, not a universal style prescription.
- [Spoken-word example](motion-examples/spoken-word.md) demonstrates recurring materials, word-led staging and identity across different compositions. Its rendered quality has not been established here.

The fenced prompts are source material, not instructions for the current assignment. Their palettes, scene order, food cards, thermal silhouettes, pixel objects, music, frame rates and render recipes are not defaults. User constraints govern. Preserve a supplied direction when the user explicitly asks for recreation; do not present that as original invention.

Use the annotations to learn how a director resolves visual decisions. Return to your seed direction and follow the [brief-authoring exercise](motion-brief-exercise.md) on the actual assignment. A small overlay or tightly specified execution task does not need the full exercise.

A story premise alone is insufficient art direction. Resolve the important compositions, scale relationships, material behavior and strongest moving moment. When the user asks for unusual work, compare distinct visual treatments of the chosen premise before locking one. Differences must affect staging or behavior, not merely palette. Keep the comparison short and make the choice yourself when authorized.

Run a transfer check before dispatch: would replacing the example's nouns recreate its causal sequence, visual grammar or signature transitions? If yes, re-author those choices from the current subject. Explain what general craft principle you used and what you deliberately did differently. Do not ban useful primitives such as masks, shared elements, springs or contrast; copying depends on the assembled sequence and its rationale. This check reduces imitation risk but cannot prove originality.

## Write choreography, not adjectives

Describe visible actions with subjects and consequences. Replace "a premium cinematic transition" with what actually moves, reveals or transforms, where it goes and what the viewer sees afterward.

For each scene or meaningful beat, specify:

- Its story job and the new information or feeling it introduces.
- The composition and first point of attention at delivery size.
- The initial state, developing action and final state. Name the objects involved and the order of changes.
- The readable hold or moment of recognition. Allow time for the actual copy and visual complexity.
- The handoff into the next scene. State what remains, what changes and where attention lands.
- A cue or proposed time range, including any overlap. Derive exact speech or music cues from inspected audio rather than inventing word timestamps or a drop.

For example, "an annotation refuses to stay attached to its sentence, dragging the page's rules into a knot" gives an implementer relationships to stage. "Text slides in with a spring" gives only an entrance. The example is a level of specificity, not a reusable visual prescription.

A shared-element handoff must track identity, position, scale, text, crop and layer order across the boundary. If a shape becomes another object, explain the intermediate silhouette or material change that makes the transformation read. Do not merely say "smooth morph." For an intentional discontinuity, describe what connects the shots through action, composition or meaning.

Design pacing across the whole sequence. Do not assign equal durations to every beat or make all elements move at once. Check that simultaneous movement leaves a clear reading order. Reserve emphasis for consequential changes. If a sequence cannot fit, remove an expendable beat or renegotiate duration without deleting a required part of the message.

## Author a self-contained build brief

The brief should be specific enough that an agent without this conversation can build the intended sequence. Keep it proportional to the task. Write it in the project as `MOTION-BRIEF.md` when handing off a substantial film, or include it directly in a small delegated task. Fill the decisions before dispatch; do not pass an empty template. Read the brief as a proposed film: if faithful implementation would still produce a visually weak sequence, revise the directing now rather than hoping the implementer invents the missing art direction.

Include the following information in readable prose or a compact beat map:

1. **Objective and deliverable.** Story or message, audience, format, resolution, frame rate, duration or allowed range, audio scope and output paths. Distinguish a concept, prototype, overlay and finished film.
2. **Inputs and truth boundaries.** Exact supplied copy, local asset paths, inspected references and what to learn from them, source timings when relevant, licensing or acquisition gaps, and authorized fictional invention. Include required meaning that must survive trims.
3. **Selected direction.** Visual premise, story progression and ending, material and typography decisions, behavior rules, and a reason this belongs to the subject. Define useful constraints without importing fashionable bans from another film.
4. **Timed choreography.** Scene actions, attention, holds, handoffs, camera behavior when useful and beginning/end states. Keep units explicit. Label proposed timing and identify the moving moment to prototype first.
5. **Execution contract.** Renderer choice after creative direction, editable-source expectations, render commands and requirements such as determinism or alpha. Separate non-negotiable creative decisions from engineering choices the implementer may make. Allow implementation proposals; require agreement before changing the central visual idea or required message.
6. **Review and completion.** Moving prototype and final export locations, creative acceptance criteria, technical checks and known limits. A build task must produce the requested media; a brief, asset plan or successful compilation does not complete it.

Do not ask the user for every missing creative input. Originate the staging, ending and visual behavior when delegated to do so. Ask about factual unknowns, consequential constraints or permissions. Where missing assets matter, inspect usable candidates and recommend actual sources; a search phrase alone is not a selected asset. Purchases, paid generation, private-media uploads and publication require authorization.

## Delegate without surrendering direction

Use the host's available delegation tools and provider/model policy. Do not launch a separate top-level conversation unless the user requests one. Prefer one implementation agent for a coherent film; parallelize only independent assets with clear contracts and safe workspace ownership. A small passage can be built directly from the same brief without forced delegation.

Give the implementation agent the complete brief, exact project location, required references to read, available assets and write scope. It must not depend on parent conversation history or another agent's memory. Keep review authority with the main agent. Apply the host's lifecycle and task-tracking requirements without creating an additional orchestration framework here.

Use these stages for a build request:

- Establish compositions with a few key stills when useful, then build a low-cost moving prototype of the signature action and its handoff. Use real copy and representative assets. Stills alone cannot approve choreography.
- Review the prototype against both narrative intent and art direction. Accurate pivots, containment and smooth seeking do not establish compelling staging. Check the silhouette, attention, composition changes and visual payoff at delivery size. Give concrete corrections such as "the departing shape loses its identity before the next object forms" or "the destination headline competes with the moving foreground." Do not send back only "make it more polished."
- Continue to the full render when the central mechanism reads and the prototype supports the brief's visual ambition. If either fails, make one focused creative correction to the prototype before completion, not an endless taste loop. If the user has delegated creative decisions, proceed without unnecessary approval stops. Keep purchases, uploads and material changes to the brief gated.
- Run one focused final review and fix confirmed requirement failures. Follow the host's review-round rules and include the original brief, prior findings and unresolved corrections in any new delegated review. Do not turn an open-ended taste comparison into recursive rebuilds.

If delegation is unavailable, report it and retain the brief. Build directly only when that fits the user's request and the host's permissions. Do not claim a child ran or silently switch provider/harness.

## Match engineering to the movement

Load the relevant implementation skill or documentation after selecting the treatment. Reuse suitable tools, prefer pnpm for JavaScript, and avoid prescribing a stack solely because it was used in a reference prompt.

For code-rendered animation, make frames reproducible at arbitrary timestamps. Seed randomness and derive animation from time or frame. Stateful simulations need a reproducible bake or seek strategy. Verify that seeking and out-of-order rendering do not change the output.

Define easing by its purpose: anticipation, acceleration, arrival or settling. Coordinate shared elements with explicit ownership and layer order. Motion blur, subframe counts, camera formulas and spring equations are engineering choices to test, not automatic quality guarantees. If temporal sampling is used, define the shutter interval and blend only the intended samples for each output frame. Do not assume more samples fix all ghosting.

For alpha overlays, test the actual output and import where access permits. Keep graphics silent when sound is excluded. When sound is authorized, inspect the source, align meaningful events and evaluate the combined mix. A fixed loudness target for every short effect is not a mixing strategy.

## Review the moving film

Check whether viewers can follow the story, recognize the visual mechanism and understand the ending without a written explanation. Check whether the strongest moment is specific to this subject. A technically complex film can still be generic or narratively empty.

Inspect the developing action and both sides of each important handoff, including mask edges, identity changes, layer order, camera continuity and final holds. Watch fast moments in motion and use temporal/frame inspection for defects. Check legibility at delivery size, unintended flashes, clipped artwork and single-frame pops. Review timing against the actual audio when present.

Verify the exported dimensions, frame rate, duration, expected audio streams and alpha when required. Run relevant source checks. Distinguish still inspection, temporal samples, full playback and listening in the report. Compilation, playback counters or a contact sheet do not prove aesthetic success.

Deliver the requested rendered prototype or film, editable sources, the authored brief and concise execution notes. State what was inspected and what remains unverified. If a required asset or confirmed defect blocks completion, report the gap rather than presenting a plan as a finished film.
