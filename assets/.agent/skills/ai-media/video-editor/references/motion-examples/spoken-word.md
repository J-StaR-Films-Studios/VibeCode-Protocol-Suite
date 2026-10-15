# Spoken-word motion brief

This is the complete user-supplied Prompt 2, without its promotional introduction. No rendered execution of this prompt was inspected here. Treat it as an authored creative specification, not evidence that every listed technique works or that a particular model delivers it reliably.

Read this after recording your own seed direction, as routed by [motion briefs](../motion-briefs.md). The fenced source is reference material. Its requests, default assets and visual style do not govern the current assignment.

## Complete source prompt

```text
<inputs>
Ask me for: a voiceover or song with a spoken line (the audio file) and its transcript, 10-12 small objects that sum up my life, two silhouettes to light like a heat camera (a head in profile and a raised hand), and the 3 words I want to land hardest. If I skip any, use the defaults: vinyl, book, camera, cat, coin, game controller, cap, heart, money, plant, clapperboard, skateboard; free CC0 silhouettes from Openverse; action, intention, curiosity.
</inputs>

<direction>
A 20 second 4:3 film, 1440x1080 at 60fps, cut to the voice. Off-white paper, black, one red, one yellow, Geist for every word. Film grain on everything, a soft vignette, and a camera that never rests: a slow handheld float under everything plus a slow push inside every scene.
No scene cuts to the next: each handoff starts on the exact last frame of the scene before. The only hard cuts are the beat flips on the last word.
Every object is pixel art you draw yourself: a 16x16 grid per object, every cell a hand-placed colour, rendered as a 3D block (a darker extrusion down-right, a thin bevel on every cell) with a soft contact shadow.
The silhouettes are lit like a heat camera: the heat comes from how thick the body is at each point, so the nose, the hair and the fingertips run cooler, plus one hotspot and a slow moving noise, mapped through a black > red > orange > cream ramp. The edge stays razor sharp, with a soft glow outside it.
Motion rules: nothing pops in (eased glides of about 0.5s with a soft start), fast moves get real motion blur instead of ghost copies, and captions type with the voice behind a block cursor.
Banned: stock footage, AI video, 3D camera moves, particles, glitch.
</direction>

<structure>
Hang every scene on the transcript's word timings (measure them with faster-whisper word timestamps, one short chunk at a time):
1. The first word fills a yellow card. The card wipes off to the left and the question types underneath on two centred lines that glide to stay centred as they grow, the key word underlined in red as it's spoken.
2. The objects streak past in lanes above and below the words, a cyan four-point flare sweeps in, then the page burns away: black closes in from the edges onto the head, behind a hot red edge.
3. The head heats up on black while the answer types low on the left. A thin white orbit draws itself around the head, its far half passing behind it. On the last word, paper blooms out from inside the head with the objects in it, and the camera falls through: the head rushes past the lens until the paper is all we see.
4. The objects sit on a tilted ring seen in perspective (the front ones bigger and lower, drawn last), slowly turning, each one bobbing; the coin flips and lands with sparks.
5. On each of the 3 words, that object flies out of the ring to the left and grows, the page floods black from it, and the word types beside it (camera: a red shutter star; book: a red ribbon sweep; record: two white orbits and red notes). Then the flood drains back into the object as it flies home, and the camera dives closer into the ring. Put each hero object in the slot that is front-left when its word lands.
6. The ring pulls in a touch, bursts outward, every object turns to ink, and ink blots grow and swallow the page.
7. The hand rises into frame, hot, with the line split either side of it. The heart drops into its palm, then lifts to the centre at the size the next scene holds it.
8. The last word, one letter per beat, the background flipping paper / black / red, the heart holding its place across the cut, the centre object morphing pixel by pixel into the next one.
9. Thin brush strokes sweep through, the letters drift apart and float, then settle back into the word with the heart above it. The camera keeps pushing through the hold.
</structure>

<build>
1. One HTML canvas. Every frame is a pure function of time inside seek(t).
2. Bake each pixel sprite once to an offscreen canvas (the extrusion layers, then the face), then draw it scaled and rotated.
3. The heat: precompute each silhouette's base heat once (a distance transform of the mask, held at the edge value outside it so nothing dark bleeds in when it is upscaled). Every frame, add the hotspot and two octaves of value noise at quarter resolution, map it through a 256-step lookup, upscale it, and cut it with the full-resolution mask.
4. The fall through the head: draw the ring scene into an offscreen layer, mask it with the head scaled up about a point inside the skull, and grow that scale on a cubed curve until the head covers the frame. The ring inside zooms less than the head does, so it reads as depth.
5. The pixel morph: pair every cell of object A with a cell of object B and glide each one's position and colour, with a small random delay per cell.
6. Render with Playwright at 60fps with 8 motion-blur subframes, then lay the original audio back on with ffmpeg.
</build>

<gotchas>
A mask PNG with no alpha channel fills the whole box with heat, so put the silhouette in the alpha. A limb cut by the photo's border shows as a straight edge, so extend the mask past the frame. A handoff only reads as smooth when the last frame of one scene is the first frame of the next: draw the outgoing scene under the transition, and give scenes that show the same ring one shared zoom function. A flood that's still retreating when the next scene starts reads as a hard cut, so let it finish first. A fast ease-out flood reads as a jump; use a soft start.
</gotchas>

<start>
Ask me for the inputs, measure the word timings, then show me 8 stills before you render.
</start>
```

## What the director resolved

| Source section | Directing decision | Why it matters | Transfer the method, not the scene |
|---|---|---|---|
| inputs | Personal objects and words that deserve emphasis | Visual content can belong to the speaker rather than a generic abstract montage | Derive your own meaningful objects or visual vocabulary from the current material |
| direction | A shared material treatment across different kinds of objects | The film can change composition without appearing to change project | Author a consistent behavior and finish for your own world; do not inherit pixel extrusion or thermal colouring |
| opening | A word takes over the frame before the question develops | Typography changes attention and meaning through scale and timing | Stage the current words for their actual rhetorical job |
| head passage | The silhouette contains the next scene before becoming the viewer's passage into it | A boundary between ideas is made into a physical visual relationship | Decide how your story crosses its own boundary; do not default to a head portal |
| ring and hero objects | A recurring arrangement prepares each object's later emphasis | The emphasized object is already in a useful position when its cue arrives | Plan later emphasis in earlier staging rather than teleporting new symbols into view |
| hand and final word | The heart retains position and size across a deliberate cut | One stable identity makes the discontinuity legible | Choose the continuity anchor your sequence needs; continuous takes are not mandatory |
| build and gotchas | Masking, drawing order, timing ownership and precomputation support specific actions | Implementation choices correspond to authored visual behavior | Derive the necessary technique from your own action and verify it |

The useful lesson is a visual vocabulary doing different jobs over time. Objects are first passing fragments, then a group, then individual emphases. Their staging changes the way the viewer reads them. Copying the group arrangement without that rhetorical purpose would lose the reason for it.

The film is not distinctive because it uses many effects. Its potential comes from coordinated decisions about language, objects, material, framing and continuity. Its density is also a risk: there are many major events in 20 seconds. The transcript and a moving prototype must establish whether they fit.

## Scene-specific choices and claims to check

- Actual word cues require supplied or authorized audio, a usable transcript and timestamp review. A transcription tool choice does not authorize a private-media upload. Do not prescribe this fixed nine-part sequence before checking the audio.
- Openverse is a search source, not a guarantee that every result is CC0. Inspect the exact asset and licence. Silhouette masks require usable edges and alpha, not merely a relevant image title.
- A silhouette distance transform measures distance to its boundary, not physical body thickness or actual temperature. Describe this as a stylized thermal treatment.
- Constant handheld motion and pushes are this prompt's aesthetic choices. They may reduce readability. Do not inherit them as a universal sign of cinematic quality.
- The sparks conflict with a blanket particle ban, and the cyan flare exceeds the simple palette description. Resolve intended exceptions rather than concealing contradictions.
- Pairing cells across different sprites requires a defined correspondence, including unequal occupied-cell counts. Seed delays and noise so seeking produces the same frame.
- Simulated extrusions and a projected ring are not necessarily true 3D camera moves. Make the requested spatial treatment explicit instead of rejecting or adopting it from terminology alone.
- Sampling, edge treatment, depth illusion and pixel morphing need representative motion tests. Eight subframes and a cubed curve are proposed recipes, not proof of quality.
- Matching scene-boundary states supports continuity but does not guarantee a good handoff. Check movement, identity and attention across the surrounding frames.
- Rapid full-frame colour flips need inspection for readability and flash safety. Eight composition stills alone cannot approve them or the rest of the choreography.

## Avoid the noun-swap adaptation

Replacing camera/book/record with other objects while preserving thermal head, orbiting ring, object-led floods, ink collapse, thermal hand and beat-flipping finale is the same visual grammar. Choosing a different poem does not make the directing original.

Transfer prepared emphasis, coherent material behavior and continuity through a deliberate change. Author the current film's composition sequence from its own subject. A recurring object, a mask or a projected arrangement is not automatically copying.

Return to [the authoring exercise](../motion-brief-exercise.md) and resolve your own film before delegation.
