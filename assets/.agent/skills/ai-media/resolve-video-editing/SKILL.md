---
name: resolve-video-editing
description: Use when editing sermons or talking-head videos in DaVinci Resolve with message-preserving cuts, restrained graphics, transcription, audio finishing, and reviewable previews.
author: J StaR Films
coauthored: J StaR Films / Takomi
version: 1.0.0
---

# Resolve video editing

Use this skill to produce a tightly polished, engaging edit that feels deliberate throughout. Apply these recurring preferences to the actual footage and brief. Keep claims, timing, branding, credentials and asset choices project-local.

## Editing flow

Inspect and back up the project, verify the transcript, shape the teaching, preview the visual direction, finish graphics and sound, review playback, then deliver within the brief. Transcription and visual research can proceed together, but settle the substantive cuts before placing graphics throughout the timeline. Recheck their timing after later cuts.

Use judgment within an authorized edit. Remove expendable pauses and repetition without asking about each cut. Ask when missing information changes the message, creative direction or delivery scope. Show concrete choices early so the user can judge the result.

## Start with the actual project

Inspect the open Resolve project, current timeline, media, source paths, audio linkage, frame rate and existing processing. Report what you found and a concrete edit plan. If the user asks for a go-ahead before editing, wait for it. If they already authorize editing, proceed within that scope.

Prefer Resolve's supported connector or scripting API. A returned project name does not prove visual access to the app. Distinguish timeline readback, image inspection and actual listening. Fairlight plugin settings and automation may be inaccessible through the public API. Never infer a volume of zero from an unsupported property returning false.

Before changes, make a recoverable project backup and a new working timeline. Preserve the original and linked audio. Store intermediates under work and user-facing exports under outputs in the active workspace. Keep referenced media paths stable. Deliver editable projects with their required assets.

When the platform is unspecified, use a landscape YouTube edit as the starting assumption and state it. Follow any platform or aspect ratio the user specifies. Mark strong future vertical moments, but create vertical edits only when requested.

## Groq first

Use Groq for transcription before waiting on Resolve's transcription. The provider is Groq, not xAI's Grok. Read [references/groq.md](references/groq.md) for key handling, preparation, requests and failure recovery. Run [scripts/transcribe_groq.py](scripts/transcribe_groq.py) with project-local audio and output paths. Use its requests-based client, read GROQ_API_KEY from the process environment, and pass the known speech language. Diagnose a failed request with the bundled client's recovery guidance before declaring the key invalid.

Save raw segment and word timing. Proof names, negatives and scripture references by listening. Recognition can reverse a claim or invent words during noise, silence or glossolalia. Mark uncertainty; do not invent captions. A transcript is an editorial aid, not proof of clean cuts or perfect timing.

## Editorial decisions

Choose an opening that reaches the teaching or central idea quickly. Remove setup delays, dated announcements, false starts, redundant explanations and dead air when they do not contribute to meaning. Preserve the speaker's argument, numbered points, necessary context, emphasis and intentional pauses.

Read the whole message before choosing a hook or deleting repeated passages. Identify the core claims, supporting scriptures, examples and qualifications. A restatement may add a necessary distinction. Keep negatives and caveats that prevent an edited claim from changing meaning. A cold open must remain faithful to its original context.

Build a source-to-edit map with exact source ranges and frame-aligned boundaries. Keep source time, timeline time and display timecode distinct. Use each media item's reported source frame rate; it can differ from the timeline rate. Confirm inclusive or exclusive endpoints for the chosen tool. Listen across joins and check linked-picture sync. If the user reserves gap removal or timing changes for themselves, leave those boundaries alone.

Choose length from the content. Do not shorten merely to hit a generic social-media target. Keep the speaker visible for nuanced claims and passages where facial expression carries meaning.

Use speech rhythm and ideas to guide pacing. Preserve breaths that make a join natural and pauses that let a statement land. Use a subtle reframe or relevant visual when it helps a cut; avoid a fixed schedule of zooms, transitions or B-roll. Strong retention comes from a clear opening and sustained teaching, without a promise of virality.

## Motion design and B-roll

Build graphics around the statement being spoken. Typography, composition and animation must communicate that idea. File validity and smooth animation do not establish professional design. Avoid a large empty panel with a few words, generic presentation slides and decoration added only to fill space.

Create a few genuinely different short previews before applying a design throughout the timeline. Show them here with real footage and audio. Wait for the user's selection when they request examples before implementation. A still cannot prove an animation's rhythm.

### Develop the animation concept

Start from the passage and the viewer's task. Decide whether the graphic should emphasize a claim, explain a relationship, introduce a section or make a scripture readable. Give each proposed treatment a specific reason to exist.

Inspect a small set of real motion references: sermon graphics, broadcast titles, editorial typography, licensed templates or component demos. Watch their motion when animation is the reference. Record the source and the useful design decision, such as type hierarchy, image integration, reveal order or reading hold. Adapt that decision to the current passage and footage.

Sketch the opening frame, readable hold and exit before building the animation. Relate visual changes to the spoken idea. For example, a statement can reveal its key phrase at the speaker's emphasis; a scripture can establish its reference before holding the passage for reading. These are possible treatments, not a required animation sequence or a change to the caption policy below.

Vary composition, typography, image integration and motion behavior across concept previews. Judge the held frame for balance and clarity, then judge the moving version for pacing. Keep the useful restraint of the approved design while allowing a new message to suggest a new visual idea.

### Choose a suitable implementation

Resolve remains the editing and finishing environment. Choose an available graphics tool that fits the concept, existing assets and editability needs:

- Native Resolve/Fusion can keep titles, masks, tracking and compositing editable in the project.
- HyperFrames is an optional route for authored motion compositions and reusable blocks. If selected, read its entrypoint and the relevant creative, animation or registry guidance. Inspect available block demos or rendered examples before adapting them.
- Remotion is an optional route for frame-based React compositions, reusable statement and scripture layouts, and variants driven by cue data. If selected, read the relevant Remotion skill and reuse suitable project components.

A rendering framework is an implementation choice. Choose the visual idea first, and use a template or component only when its layout and motion support that idea. Check it with the actual words and footage. Do not require HyperFrames, convert an existing graphics project or add a framework solely because it is available.

For externally rendered overlays, verify frame rate, duration, transparency and compositing in Resolve with a representative import before rendering the whole set. Preserve editable graphics sources and keep the delivered media paths stable.

### Compose the graphics

Use two levels of emphasis:

- Major statements deserve a composed treatment with one dominant idea, purposeful type and a controlled reveal. Warm paper, sturdy serif type and restrained accent colour are a useful starting direction when they suit the footage. Integrate the speaker through a deliberate crop or overlay; protect the face, gesture and microphone.
- Small references and chapter labels should fit closely around their text. Keep padding and background thickness proportional to the type. Use a quiet corner treatment clear of the speaker and other overlays.

Feature the main scriptures selectively. Give an important passage a readable verse treatment with its reference and enough screen time to follow the spoken reading. Use a compact reference for passing mentions. Verify the wording and translation, split long passages at meaningful boundaries, and keep all text within safe margins. Avoid squeezing a full verse into a corner label or covering the speaker with an oversized slab.

Use contrast, texture and layered composition only where they support hierarchy. Animate with the speech, hold the finished text long enough to read, then clear it deliberately. Follow the approved direction consistently, choosing treatments by meaning instead of alternating them mechanically.

Inspect the entire rendered composition at the entrance, full reveal and exit. Check line wrapping, glyph edges, verse fit and collisions with the speaker. Source contact sheets cannot establish whether a Fusion graphic or grade rendered correctly. After ripple cuts, recheck graphic placement against the spoken passage.

Inventory available B-roll before choosing it. Suitable licensed stock and animation can support an exact passage when event footage is absent. Keep source and licence records. Do not imply stock footage depicts the event. Avoid generic filler or literal imagery that misrepresents a theological claim.

## Captions are optional

The user ultimately disabled the caption overlay. Leave burned-in captions off by default. If requested, preview an excerpt with audio before applying captions throughout. A separate SRT may be useful, but do not publish an unproofed transcript.

For requested captions:

- Display short complete static phrases, typically two to five words, adjusted to the actual speech.
- Split at audible pauses. End the current batch when the phrase ends; clear the screen during a meaningful gap and show the next batch with its speech.
- Do not show a future clause through a pause, progressively open up text, move previous words sideways, reflow an existing batch, use karaoke highlighting or accumulate a long sentence.
- Recognition timestamps and silence detection only propose boundaries. Listen to examples that include quiet speech, audience noise and long pauses.

Keep any caption overlay separate and easy to disable. If the user rejects it, respect that decision instead of making increasingly elaborate versions.

## Audio deserves a creative pass

Prepare the speech before transcription from the linked source, preferably without added music. Check sync before and after editing. Clean distracting noise without making the voice thin or metallic. Adjust level, EQ and dynamics by listening; do not copy fixed settings into every project.

Inspect existing processing before changing it. Preserve user-created effects unless the authorized edit requires adjustment. Treat voice isolation, EQ and dynamics as listening decisions, without carrying numeric settings from a previous project into a new one. Do not infer a specific plugin from an ambiguous description of the sound.

Select suitable licensed music that supports the mood and stays below intelligible speech. Listen where the preacher is quiet and emphatic. Shape entrances, exits and level changes deliberately. Consider EQ, compression or expansion only when they solve an audible problem. Check for pumping, distortion, abrupt joins and unintended music tails. Use meters as supporting evidence, not a substitute for listening.

Inspect supplied music folders before sourcing another track. Keep the full original file, track title, artist, source URL and licence identifiable alongside the project. Distinguish the original track from a preview, excerpt or edited music bed. Arrange repeats around musical phrases and use fades that avoid an audible seam.

If effects are inaccessible through the tool, state what can be verified and use rendered audio for assessment where possible. Do not pretend a Fairlight adjustment succeeded without readback or audible evidence. Keep user-created processing intact during a read-only review.

## Colour and finishing

Inspect real frames before grading. Correct white balance, exposure and distracting casts, protect skin tones, and match shots. Show a representative before/after preview before broad stylistic grading. Avoid crushed faces, clipped highlights and aggressive artificial looks.

Subtle reframing can support cuts when the source resolution permits it. Check the whole composition and graphic placement, not just a crop of the title.

Review the finished edit throughout for continuity, sync, speech, music, graphic timing and any requested captions. Verify actual exports for dimensions, frame rate, duration, playable audio/video and clipping. Timeline readback, automated checks and sampled frames do not replace a full listening review. State plainly if a complete review could not be performed.

Deliver the recoverable edited project, required assets and concise notes. Render the master when export is part of the authorized brief. If the user will export, leave the verified timeline ready and explain any unverified render settings; do not claim a video file was delivered. Publication remains a separate task unless authorized. Include actual checks and remaining limitations.

## YouTube packaging when requested

Use the available youtube-pipeline skill for the requested packaging stage. Base titles and thumbnail copy on a strong claim the message actually supports. Make the title and image complement each other. Use actual speaker frames as image references, check identity and headline readability at mobile size, and keep essential content clear of the duration badge. Generated portraits require an identity check even when a source frame was supplied.

Prepare the requested description, chapters, tags, pinned comment and thumbnail options as local deliverables. Confirm church, channel and speaker names when needed; omit unknown attribution. Derive chapters from the latest edited timeline, starting at video time zero. Recompute them after further cuts, including user edits. Check current upload requirements, file dimensions and sizes, and chapter spacing. Keep audience testing separate from design judgment and technical validation.

## Handoff behavior

Respect the user's latest corrections over this skill. Show concrete creative choices early, then apply approved decisions consistently. Keep the final report brief and link deliverables. If asked only to inspect the user's finishing changes, take notes without changing their project.
