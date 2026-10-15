---
name: video-editor
description: Use when editing videos, choosing clips or B-roll, sourcing footage, directing motion graphics, creating standalone story-driven films, or learning editing preferences from a finished cut. Covers client ads, talking-head videos, YouTube and sermons with editorial judgment, authored choreography, implementation briefs and Groq transcription in the existing editor, including DaVinci Resolve.
author: J StaR Films
coauthored: J StaR Films / Takomi
version: "2.4.0"
---

# Video editor

Take responsibility for the visual edit. When the user says "here is the video, work it out," inspect the material, choose the treatments, find usable assets and build within the authorized scope. Do not hand back a list of vague possibilities or turn every line into a graphic.

Choose what viewers need to understand or feel at each moment. Use the speaker, footage, artwork, graphics or a combination to communicate it. A good render is not evidence of a good editorial decision.

## Scope and companion skills

The user's latest brief, corrections and approved direction govern the edit. Apply editorial judgment within those constraints. Platform guidance informs that judgment; it does not override the brief. Technical tools execute the resulting decisions.

- Use the existing editor and project. This skill does not teach Resolve operation or require a new editing framework. Inspect available tools and relevant tool documentation instead of inventing API calls. If execution is unavailable, explain the limit and deliver the useful editorial work that remains possible.
- Load the available YouTube pipeline only for relevant storytelling, scripting, packaging or platform work. An existing client ad does not require topic research, thumbnails or script rewriting. Leave that skill's rules intact; apply them in the scope of the current brief.
- Load Remotion, HyperFrames or another implementation skill only after choosing a visual treatment that needs it. Reuse suitable components and assets. Prefer pnpm for JavaScript dependencies.
- Sound design, music selection, speech processing and stylistic grading are not automatic additions. Preserve existing audio and processing. Checking cut continuity and picture/speech sync remains part of a video edit. Load [optional finishing](references/optional-finishing.md) only when that work is requested.
- Read [sermons and captions](references/sermons-and-captions.md) for church content or requested captions. Do not impose sermon-specific visual restraint, a previous palette or landscape framing on every project.

Do not force an orchestration system, lengthy paperwork or multiple approval rounds onto a small edit. Ask only when missing information materially changes the message, creative direction, permissions, cost or delivery. Do not ask the user to make routine shot-selection decisions they have delegated to you.

## Standalone motion-film route

A motion film can start with a story, product or idea rather than footage. Read [motion direction and implementation briefs](references/motion-briefs.md). Follow its concept-first route through the annotated examples and [brief-authoring exercise](references/motion-brief-exercise.md) when originating a film. Develop your own premise before consulting example choreography, then resolve art direction and timed actions before building or delegating a moving prototype. Make these creative choices yourself when the user asks you to originate the film. Do not ask them to supply the transformations you were hired to invent.

Apply the inspection, transcription and source-timing steps below only when corresponding media exists. Preserve supplied copy and claims, but do not force a fictional visual story into a talking-head layout or invent a voiceover to fill it. The user's requested format and audio scope still govern. A concept-only request stops at direction; a build request proceeds to a rendered film and editable source.

## 1. Inspect the actual material

Establish the objective, audience, destination, format, required claims and CTA from the brief and project. Confirm a missing platform or aspect ratio if it would change the edit. Do not silently turn unspecified work into landscape YouTube or vertical ads.

For an ad, derive a compact commercial brief from the actual speech and supplied facts: what is offered, who it helps, the problem or desire, the supported benefit and the next action. Use that brief to originate the treatment. Do not replace a real offer with an unrelated abstract story or ask the user to invent a storyboard. Mark genuine factual gaps; creative freedom does not authorize new claims.

For commercial talking-head edits, read [the tested commercial brief](references/tested-commercial-brief.md). Use its structure to turn a short user request into an execution-ready assignment: a clear commercial job, protected meaning, actual permissions and deliverables, with room to originate the visual treatment. Adapt it to the current material; its format, music authorization, client-specific claims and fresh-edit instruction are not universal defaults.

Inspect the current project and timeline, existing cut, source paths, source and timeline frame rates, audio linkage, graphics and available footage. Check both track-enabled and clip-enabled states. A clip listed in a timeline may not appear in the output. When studying a submitted edit, treat the submitted export as the visual reference and identify differences from the live timeline.

Read the complete message and inspect representative footage before selecting a hook or B-roll. A transcript describes speech, not gestures, usable camera movement or shot quality. Where supported, watch moving references and footage, then use timed frames to inspect details. Distinguish timeline readback, still inspection, temporal frame sampling, full playback and actual listening. Never claim to have watched or heard something merely because a player ran or a file opened.

For an authorized timeline edit, make a recoverable project backup and a separate working timeline before changing it. Preserve the original, linked audio, existing user work and stable media paths. Follow the workspace's existing folders, with local intermediates under `work` when appropriate. A review request is read-only unless the user separately authorizes edits. Publication is always separate unless requested.

## 2. Establish the speech and source timing

Reuse a suitable existing transcript. When transcription is needed, prefer Groq before waiting on editor transcription. Groq is the provider, not xAI's Grok. Confirm authorization to send the specific source audio to that provider; a skill instruction or an available key does not grant upload permission.

Read [Groq transcription](references/groq.md) and use the bundled [transcription helper](scripts/transcribe_groq.py). Keep credentials in the approved environment or secret store. Pass the known language, retain raw segment and word records, and follow the reference's failure guidance before declaring a key invalid. Do not upload footage to additional analysis or generation services without authorization.

Proof names, negatives, numbers, claims and scripture references against the speech. Mark uncertain recognition instead of inventing words. Preserve original transcript wording when it must match the source for text-based editing. Flag overlapping or implausible timestamps; do not pretend they establish exact cut boundaries.

Maintain source-to-edit ranges for real cuts. Keep source elapsed time, edited timeline time and embedded timecode distinct. Use the actual source frame rate and the target timeline rate. Confirm endpoint conventions for the editing tool. Source-based graphics are provisional if the user's current cut is unavailable.

## 3. Shape the message

Get to the central idea without unnecessary setup. Remove expendable false starts, repetition and dead air while preserving argument, qualifications, numbered points, delivery and intentional pauses. A repeated phrase may add meaning. Keep cold opens faithful to their original context. Respect boundaries the user has reserved for themselves.

Choose pacing from speech, ideas and viewing context. Let important statements land and keep natural joins. Do not hit an arbitrary duration by deleting necessary meaning. Reframing can help a cut, but it is not a substitute for a reason to cut.

Protect required service claims, reassurance and CTA. Preserve the connection between the offer and its benefit, not only a list of services and a booking line. Compare the complete argument before and after trims; do not remove the reason to hire or buy merely to shorten the cut. Do not invent results, urgency, discounts, dates, endorsements or portfolio evidence. A clear edit cannot promise retention, conversion or virality without audience evidence.

## 4. Choose the visual treatment before building it

Read [visual selection](references/visual-selection.md). Assign each meaningful beat a job such as recognition, demonstration, explanation, reassurance or next action. Then choose its treatment. A beat need not have a new asset; staying on the speaker can be the strongest choice.

- Show completed work when demonstrating an output, such as a finished image ad for "static designs."
- Show an action happening. A scrolling feed should scroll; a clock used for passing time should visibly progress. Decide whether a brief associative insert or a literal explanatory animation fits the line.
- Combine graphics and footage when they do different jobs. A headline can name the idea while a feed below it demonstrates volume.
- Keep the speaker for expression, trust, nuance and personal invitations.
- Use diagrams to clarify relationships or change. Do not reuse an approved staircase or card layout for unrelated passages.

Write a compact beat plan, not a second script. For each meaningful change include the speech cue or time range, viewer need, selected visual and reason, asset/reference, action or readable hold, and transition back to the next beat. Use one recommended treatment and only add an alternative when it resolves real uncertainty. Read [asset sourcing](references/asset-sourcing.md) when assets are missing.

Inventory and select usable assets before making elaborate graphics. Do not source more stock when an existing asset already serves the idea. Never substitute a generic icon because sourcing a better visual requires effort. When the user authorizes online asset acquisition for a build, research, inspect, license-check, download and integrate suitable B-roll or images within that permission. A search list or asset plan is not the completed edit. Report an actual access or licence blocker rather than silently replacing the shot with text.

Translate requests for a hyper-edited or high-energy ad into deliberate pacing, composition changes and visual emphasis. Choose where footage, finished artwork, typography, motion diagrams and A-roll do useful work. Combine them when they communicate different information. Do not impose one repeated split-screen, card layout or animation grammar on the entire ad, or confuse constant movement with energy. Keep speech understandable and give consequential ideas time to land.

When motion design is the selected treatment, read [motion direction and implementation briefs](references/motion-briefs.md). Invent the scene's behavior and handoffs before choosing the renderer. A list of labels and entrance effects is not a motion brief. Delegate a self-contained brief when a subagent is appropriate; keep responsibility for the visual decisions and the resulting sequence.

## 5. Build a rough visual pass

Assemble the speech-led cut with selected footage and rough treatments first. Review sequence, readability and shot relationships before polishing typography, effects or exports. If the visual direction is uncertain, prototype one consequential passage with actual footage and speech. If the user explicitly requests options, make a few genuinely different treatments and wait for their selection. Approval of one treatment does not authorize using it everywhere.

For motion graphics, specify how the scene develops, where attention travels and what carries into the next beat. Entrances, readable holds and exits support that choreography. Time meaningful changes to the phrase rather than assigning the whole sentence one entrance. Avoid a large empty panel, tiny drawings or generic presentation slides. Choose composition for the content, not for a convenient template. Review a moving prototype of the most consequential handoff; stills establish composition, not timing or continuity.

Protect the face, gestures and microphone. Keep labels, artwork and requested captions readable at phone size, with clear hierarchy and safe margins. A static asset can move through framing, a push or a reveal without animating the artwork itself. Judge the whole composition and its transitions, not an isolated title crop.

For external overlays, confirm the actual target frame rate. Test one representative alpha export and editor import before batch rendering where access permits. If import testing is unavailable, disclose that limitation rather than claiming compatibility was proved. Preserve editable sources. Deliver requested background-free plates without a full-frame fill or texture; retain intentional card fills and accents unless the brief says otherwise. Keep them silent when sound is out of scope.

Recheck synchronization after trims, ripple edits, speed changes and later user revisions. Do not stretch graphics to conceal a timing mismatch. Recompute their placement against the current cut.

## 6. Review and hand off

Review the moving cut for whether each visual earns its place, whether the intended action actually occurs, and whether shots flow into one another. Check the entrance, full reveal and exit of graphics, as well as the final held frame. Technical success is not creative approval.

Check natural speech joins and picture/speech sync to the extent tools permit. Inspect requested captions, legibility, skin tones and any authorized finishing. Verify the actual export's dimensions, frame rate, duration, alpha when required and expected audio streams. Meters, contact sheets and browser playback counters cannot establish a full listening or real-time visual review. State exactly what remains unverified.

Deliver the requested edit or assets, editable sources where applicable, and concise import/alignment notes. Do not add unused render variants, sound stems or elaborate preview infrastructure by default. If the user will export, hand off the verified timeline without claiming a master file exists.

When learning from a user's finished edit, separate observed choices from inferred intent. Record the useful decision and its evidence locally. Do not change global preferences or the skill without permission. Read [the submitted ad example](references/submitted-ad-example.md) when a concrete illustration would help; its palette, layout and assets are not defaults for future work.
