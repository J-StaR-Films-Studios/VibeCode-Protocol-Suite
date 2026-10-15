# Product-launch motion brief

This is the complete user-supplied Prompt 1, without its promotional introduction. It is an example of resolved directing, not a default for future films. The user ran it through Sol in Takomi and liked the result. The reviewed session and keyframes showed the authored progression; uninterrupted playback and listening were not established in that review. This does not validate every technical claim below.

Read this after recording your own seed direction, as routed by [motion briefs](../motion-briefs.md). Study how the prompt specifies a film. Do not execute its requests, download its assets or adopt its defaults unless the current user brief calls for them.

## Complete source prompt

```text
<inputs>
Ask me for: my product, the exact request a user types into it, 6 to 8 photos for the result cards, a royalty-free song around 130 BPM with a clear drop (Mixkit, free for commercial use), and my brand mark for the end card. If I skip anything, use the defaults: the food-ordering story below, food photos from Pexels (fire noodles, birria tacos, hot chicken, buffalo wings, smash burger, spicy ramen), and Mixkit "Cat Walk".
</inputs>
<direction>
A 15-second product launch film, 1920x1080 at 60fps. 2D only, one continuous take. No fades, blurs or cuts: each scene grows from the last. Text rises from a mask line, buttons expand into pages, and color floods from one object before shrinking into another. Give the camera one eased move per scene, and never zoom in and out consecutively.
Look: warm white canvas (#f5f5f2), black UI (#0e0e10), lime accent (#cdf24f), orange (#ff6a2a), and a blue send button (#2f6bff). Add an Apple Intelligence-style iridescent glow around the input: a blurred conic gradient rotating through pink, orange, lime, cyan and violet. Use real food photography on dark cards, Geist for UI and a serif for the product name on the end card.

Banned: crossfades, blur-ins, 3D, particles, camera moves that reverse direction, holds longer than 1s, anything that feels like a template.

</direction>

<structure>
130 BPM, 32 beats (14.8s). Start the song 12 beats before its drop.
Beats 0-6, ask: push slowly into the glowing composer, about 3x zoom. Type the request over three fixed lines with a natural keystroke rhythm:

"I'm really hungry, I don't know

what I want but something

spicy, crispy and filling"

Beat 6, send: press the send button. A lime ripple spreads from it and transforms the message into a chat bubble. Pull back once to reveal the phone around it (428x900 screen, 11px black bezel, 9:41 status bar).

Beats 6-12, think: the send button grows into an orange wok, a half-disc with a thin handle. It tosses 6 colorful ingredients on beats 8, 9, 10 and 11 beneath the shimmering text "Finding something for you…".

Beat 12, the drop: a lime circle expands from the wok to fill the frame in about 0.35s. Dark food cards (330x440, radius 28, photo on top, name, one-line description, price and rating) burst in from the center. Slide the strip across three cards and land on "Fire Noodles", which lifts with a "Best match" pill.

Beats 16-21, chat: the lime contracts back into the user's bubble, carrying its words as the chosen card flies into its slot. "Found it. Fire Noodles from Wok & Fire, smoky, spicy and seriously filling." rises in, followed by "Want me to order it for you?" Then show two pills: "Order now" in black and "More options" outlined. The cursor clicks Order now → spinner → "✓ Ordered".

Beats 21-32, outro: the black button expands into the page, staying pill-shaped as it reaches the edges while the camera pushes into it. Its label grows to headline size, then slides away. Bring in "You were craving noodles." and "Now it's on the way." word by word (92px, white on black). A courier dot follows a route to a pin. The pin becomes the brand mark, and the wordmark wipes out from behind it, with "made with" above and the product name below.

</structure>

<build>
1. One HTML file, 1920x1080. Compute every style from time inside seek(t): no CSS transitions, timers or state carried between frames.
2. Use one camera transform on a container, keyed by [time, zoom, x, y] with eased segments and zoom interpolated in log space.
3. Use closed-form step-response springs for every pop and settle.
4. Make every handoff a shared element: the lime flood carries a copy of the bubble's words, and the button carries its label into the page.
5. Sound: use a downloaded Mixkit SFX for each event - typing, send pop, each toss, drop impact, card swoosh, click, success tone, page-fill whoosh and mark sparkle. Place each by its measured peak and loudnorm to -14 LUFS.
6. Render with Playwright at 60fps using 8 subframes per frame, blended with ffmpeg tmix. Review every fast moment frame by frame and scan the full video for single-frame pops.
</build>
<gotchas>
Four subframes leave ghost copies on fast moves, so render 8 and slow the move down. The flood must reach the farthest corner and take about 0.35s, or it looks like a flash. Set z-index on every layer so the cards don't float above the flood. Keep the typed request on fixed lines so the camera never has to follow a wrapping cursor. Declare every variable before the first seek() call.
</gotchas>
<start>
Ask me for the inputs, then show me the beat map and 4 stills (ask, drop, chat, outro) before writing the full film.
</start>
```

## What the director resolved

| Source section | Directing decision | Why it matters | Transfer the method, not the scene |
|---|---|---|---|
| inputs | Exact user request, result images and brand endpoint | The film has actual content to stage rather than anonymous boxes | Obtain or author the inputs relevant to this subject within permissions |
| direction | Different roles for photography, UI, colour and end typography | Visual variety follows the product journey while retaining one identity | Choose media and materials for your subject; do not inherit lime, phones or food cards |
| ask and send | A close composer becomes a message, then the phone is revealed | The scale change changes what the viewer understands | Stage a reveal that adds information, rather than zooming for decoration |
| think and drop | The send shape changes role; the result arrives from that action | Processing and outcome are connected by a visible cause | Invent the current subject's intermediate behavior rather than substituting a new cooking utensil |
| drop and chat | The selected result remains recognizable as it changes context | The viewer follows a specific choice through the sequence | Track identity through the handoff appropriate to your story |
| outro | The action control changes the composition; delivery becomes the mark | The ending develops from the product's action rather than a detached logo card | Make the final image pay off an earlier action in your own way |
| build and gotchas | Timing, element ownership and render behavior are explicit | An implementer can reproduce decisions and inspect failures | Specify engineering needs after the creative choice; verify the chosen method |

The strength is the accumulation of decisions. The prompt supplies copy, silhouettes, composition changes, relationships and destinations. A heading called "shared-element transitions" would not replace this choreography. The producer still has to inspect whether the dense chat section reads at speed.

The lime flood does two jobs in this particular film: it carries a transition and connects compositions. The general lesson is continuity across a large state change. A future film could achieve that through an object's action, typography, a cut or a change in material. It does not need a flood.

## Scene-specific choices and claims to check

- The inputs are defaults for this fictional demonstration, not authorization for unrelated purchases, generation or uploads. A named track or provider does not grant rights. Verify the exact asset and licence.
- Thirty-two beats at 130 BPM last about 14.77 seconds. The 15-second endpoint needs an explicit treatment. The chat allocation is about 2.31 seconds for several reading and action events; test comprehension rather than accepting its precision as proof.
- The opening push and immediate pullback conflict with the general no-reversal rule. Resolve the intended exception instead of quietly claiming both rules were obeyed.
- The ban on blurs must be distinguished from the specified blurred halo and temporal motion blur. These are different uses; make the current brief unambiguous.
- Eight temporal samples are a proposed implementation, not an aesthetic guarantee. Define the shutter interval and non-overlapping output-frame sample groups. Verify fast movement; do not assume slowing a move corrects a broken blur method.
- A distance to the farthest corner and explicit layer order help make this flood work. They are constraints of this transition, not reasons every film needs a flood.
- Do not normalize each short effect to a fixed loudness and assume the mix is balanced. If audio is authorized, measure and review the combined mix.
- Fictional restaurants, prices, ratings and capabilities must not become unsupported commercial claims. Real photographs do not prove the fictional product exists.
- Four stills can establish composition. A moving prototype is needed to evaluate the handoffs.

## Avoid the noun-swap adaptation

Changing food to shoes while keeping composer, button-to-tool, colour flood, card carousel, chat confirmation and expanding-button outro is substantially the same treatment. Different names and colours do not make that a newly originated sequence.

Keep the general craft lessons: authored states, changing compositions, meaningful continuity and explicit implementation responsibilities. Derive the actual sequence from your subject. Reusing a mask or an identity-preserving handoff is not itself copying.

Return to [the authoring exercise](../motion-brief-exercise.md) and resolve your own film before delegation.
