# Bluestift demo video: build brief

You are building a **2:28 product demo video** for a Y Combinator application. Read this whole file before writing any code. When something here conflicts with a default you would normally choose, this file wins.

Inputs you will find next to this file:
- `bluestift_demo_audio_mix.mp3`: the final audio (narration + music, already mixed). 148.71 s. It is the **master clock**. Do not re-mix it, do not add other audio.
- `bluestift_demo_cues.json`: 21 cues with estimated start times, transition types, background states. Times are **estimates**: replace them using Whisper word timestamps (see Phase 2).
- `script.txt`: the narration text (at the end of this file).

---

## 0. Non-negotiables

1. **Real product, fake data.** Every screen shown is the **real running app** (raya.thebluestift.com and schools.thebluestift.com) driven by script, using demo accounts with fake data. No mockups, no re-created UI, no stock footage, no AI-generated screenshots.
2. **Only what the app really displays.** Typed text, Raya's streamed answers, thinking/loading indicators, button states, menus, graphs: all come from the real app. If the app does not show a "thinking" state, do not invent one.
3. **Animation lives around the product, never instead of it.** Camera moves, cursor, captions, background graph, transitions, highlights: allowed. Fake messages, fake numbers, fake buttons: forbidden.
4. **Audio and video are synchronized to the frame.** The narration decides when each thing happens on screen.
5. **Final file ≤ 100 MB** (target ≈ 90 MB), 1920×1080, 30 fps, H.264. Hard limit, YC rejects larger files.
6. Label the fictional student on screen: *Illustrative example · Demo data* (start, and on teacher screens).
7. Never put in frame: real emails, API keys, tokens, URLs with secrets, real student data, browser chrome with tabs/bookmarks.

---

## 1. Output spec and the size math

- 1920×1080, 30 fps, H.264 High, `yuv420p`, AAC 192 kbps, `-movflags +faststart`.
- **Why not 4K:** 100 MB over 148.7 s leaves about 5 Mbps in total. 1080p at ~4.6 Mbps looks sharp for UI content; 4K at that bitrate looks worse. Final = **1080p**.
- Video bitrate budget: **4.6 Mbps** (never above 4.8). (4.6 + 0.192) Mbps × 148.71 s ÷ 8 ≈ 89 MB.
- To protect the bitrate: no film grain, no noise textures, no full-frame blur layers, keep the background graph low-contrast and slow. Motion blur only on short transitions.
- **Capture sharper than the output** if the machine allows (2560×1440), so zooms up to ~1.5× stay crisp after downscale. If you capture at 1920×1080, never zoom text areas above 1.35×.

Master render, then compress:
```
npx remotion render <CompositionId> out/master.mp4 --codec=h264 --crf=16 --pixel-format=yuv420p
ffmpeg -y -i out/master.mp4 -c:v libx264 -preset slow -b:v 4600k -pass 1 -an -f mp4 NUL
ffmpeg -y -i out/master.mp4 -i bluestift_demo_audio_mix.mp3 -map 0:v -map 1:a -c:v libx264 -preset slow -b:v 4600k -pass 2 -c:a aac -b:a 192k -movflags +faststart -t 148.71 out/bluestift_demo_final.mp4
```
(On Linux/macOS replace `NUL` with `/dev/null`.) Check size after encoding. Verify the Remotion option names against the installed version.

---

## 2. Pipeline (do the phases in order, with the checkpoints)

### Phase 0: demo data (blocking: nothing can be captured before this)
Write a seed script (idempotent, relative dates) so the demo school looks alive and consistent:
- School: *Bluestift Demo High*. UI language **English everywhere** (labels, badges, Raya analysis text: no mixed French/English).
- Student **Sofia Martinez**, enrolled in **both** *Physics 9 · Period 4* and *Algebra 1 · Period 2*.
- Sofia's concept state tells the story: one physics concept clearly weak (kinematics, reading a velocity-time graph, ~35% mastery); below it, in the prerequisite graph, a red chain: *slope of a line* (~22%), *equation of a line*, *equivalent fractions and operations* (~34%); other algebra concepts orange/partial. Velocity and persistence values **varied** (not all 0.5). One active alert: *Leaning on answers*. Mindset field filled. Last activity within the last 48 hours.
- Class views consistent: some students *On track*, some *Needs watching*, none contradictory (no "no data yet" next to a computed mastery). "Active (7d)" non-zero.
- A **study room** with 3 fake classmates, preloaded messages, a visible running timer.
- **Tools Studio**: one quiz and one set of flashcards already generated for Sofia; a demo PDF ready for the "create your own" beat.
- A **notification** "your learning analysis is ready" that can be triggered on cue.
- A **teacher account** (not admin if possible) with access to both classes, the *Raya* section, the instructions-to-Raya feature, and class-team notes.
- **Checkpoint 0:** screenshots of every screen listed in Section 5, in English, sent to the founder for approval.

### Phase 1: capture (real app, scripted)
Use Playwright (or equivalent) to drive the real app, one script per scene, writing:
- `captures/scene_X.mp4`: the screen recording (see quality rules below).
- `captures/scene_X.events.json`: timestamped log of every action (`click`, `type_start`, `type_end`, `navigate`, `stream_start`, `stream_end`) with the **bounding box** of the target element. The camera system (Phase 3) uses these boxes to zoom automatically.

Capture rules:
- Viewport 1920×1080 (or 2560×1440). Hide browser chrome. English locale. Light theme as the app ships.
- **Quality:** Playwright's default `recordVideo` is too compressed and will blur text. Use a capture path that gives near-lossless output (e.g. ffmpeg screen capture of a dedicated browser window at crf ≤ 14, or a CDP screencast), and verify text sharpness and **no dropped frames** (compare frame timestamps). Say so if the machine cannot sustain it, and propose the cloud.
- **Cursor:** the browser does not draw one, so inject a custom cursor element (clean arrow, ~24 px) that follows scripted mouse moves. Moves follow a curved path with ease-in-out and a tiny overshoot, 300–700 ms depending on distance, a 120–250 ms pause before each click. Click feedback: cursor scales to 0.9 and a ripple ring fades in 350 ms. Hover and pressed states must come from the real app.
- **Typing:** per-character delay 45–110 ms with jitter, 150–300 ms after punctuation, no typos.
- **Raya's replies are real.** Run each scene **3 to 5 takes** and keep the best. Fix the prompts, keep takes in `captures/takes/`. Cuts between conversation turns and speed-ups of **idle waiting** (max 1.5×) are fine; typing and streaming stay at natural speed. Never edit the *content* of any message.
- Credentials only via environment variables. Never print or screen-capture them.
- **Checkpoint 1:** capture scene 5 (Raya chat) and scene 11 (teacher dashboard) first, plus a 20 s test render with the Meanwhile transition (Section 6), checking look, file size and sync before capturing the rest.

### Phase 2: alignment
1. Run Whisper on `bluestift_demo_audio_mix.mp3`, or on the voice-only file if available (`@remotion/install-whisper-cpp` + `@remotion/captions`).
2. For each cue in `bluestift_demo_cues.json`, find `alignPhrase` in the word timestamps and overwrite `startSec` and `startFrame` (30 fps).
3. Each capture is split into **beats** using `events.json`; each beat is mapped to its cue window. **Time rules:** idle parts may stretch 0.85× to 1.25×; typing and streaming never faster than 1.15×. If a beat is too long, cut idle time; too short, use a slow camera push-in. Never freeze a frame for more than 0.7 s.
4. Regenerate the alignment whenever the voice is regenerated.

### Phase 3: Remotion composition
- One composition, 1920×1080, 30 fps, 4461 frames, single `<Audio>`.
- Captures via `OffthreadVideo`. Transitions via `@remotion/transitions` (custom presentations). Captions via `@remotion/captions`. Motion blur via `@remotion/motion-blur`.
- **Camera system:** a virtual camera (scale + translate) driven by `events.json`. Before an important click or typed text, ease the camera toward the target box (spring or `Easing.bezier(0.45, 0, 0.15, 1)`, 18–24 frames, max zoom 1.5×), then ease back. Camera moves must feel deliberate, never constant wobble.
- **Persistent background:** dark navy prerequisite graph (~60 nodes, seeded layout, slow drift, low contrast) in every scene. States are listed in the cues file (`backgroundStates`): gray, crack, dim, soft, path lit, physics green, class wide, same node lit, two nodes linked, regroup. Keep it cheap to render (SVG or canvas, no heavy 3D).
- Product screens sit in a rounded frame (24 px radius, soft shadow, very subtle 3D tilt that settles flat). Frames enter with `spring()`.
- **Captions:** bottom-center, semi-transparent pill, 40–44 px semibold, max 2 lines, word-by-word highlight, one keyword colored per phrase. Move the captions to the top if the UI occupies the bottom. They come from the audio transcript, never from the script (ElevenLabs tags like `[softly]` are not text).

### Phase 4: render and compress
Follow the commands in Section 1. Render with limited concurrency if the machine is old (`--concurrency`), or render in the cloud.

### Phase 5: QA (all must pass)
- Duration 148.71 s ± 0.1; size ≤ 100 MB (target ≈ 90); 1920×1080; 30 fps; H.264; audio present.
- Sync check on at least 5 landmarks: orbit opening on "Hi everyone", crack on "algebra", red node pulse on "root cause", Meanwhile transition on "Meanwhile", URL on "thebluestift.com". Visual event within ±2 frames of the word.
- Text readable at 100% on a phone screen. No dropped frames. No flicker on the background graph. No UI element hidden by captions.
- Final card (logo + URL) holds until the end of the audio + 3 s.

---

## 3. Storyboard: narration → what happens on screen

Times are estimates (replace with Whisper timestamps). "REAL" = real app capture.

| Time | Narration | On screen |
|---|---|---|
| 0:00 | "Hi everyone, and welcome to Bluestift." | Two orbit rings (blue + orange) crossing around the logo, gray graph behind. Label *Illustrative example · Demo data*. |
| 0:02 | "Meet a student. She fails physics. Again." | Rings dissolve into the graph. A physics node flashes red once. |
| 0:08 | "…she missed one key idea in algebra, and nobody noticed." | An algebra node cracks; a thin fracture climbs toward physics. Nothing else. |
| 0:16 | "That's the kind of problem Bluestift is built to catch…" | Graph dims, logo breathes, **dive** transition. |
| 0:22 | "It's late, and the physics problem is still open. So she asks Raya for help." | **REAL** Raya chat. Cursor moves to the input; Sofia types a physics question about reading acceleration from a velocity-time graph; Enter. |
| 0:28 | "Raya doesn't give her the answer. It asks what she would try first, offers a hint when she's close, and reveals the missing piece only when she's truly stuck." | **REAL** replies: Raya asks what she would try; Sofia answers; Raya hints. Quick cuts between turns (about 3 s each). Optional small labels *Ask / Hint / Reveal* around the frame. |
| 0:38 | "Still stuck… Luckily, she doesn't have to leave. In a Study Room…" | Same frame; content crossfades to **REAL** Study Room: cursor opens Rooms in the menu, enters the room; participants, shared documents, timer visible. Sofia posts one message live. Glow on "Learning is social". |
| 0:54 | "Then a notification pops up: her learning insights are ready." | **REAL** notification appears top-right, cursor clicks it, it expands into the **REAL** insights page (menu *My Kernel*). |
| 0:58 | "…concept by concept: what's mastered, what's still shaky, and what's holding her back." | Mastery bars scroll gently; camera eases onto the weak ones. |
| 1:05 | "It turns out the problem isn't physics. The root cause is a gap in algebra." | **KEY MOMENT.** Open the graph view, zoom on the red algebra node, background dims, node pulses once, a glowing path climbs in the background graph from algebra to physics. Hold 3 s. |
| 1:11 | "She goes back to Raya, and this time the physics problem clicks!" | **REAL** chat: Sofia types the correct answer, Raya confirms. Physics node turns green in the background. |
| 1:16 | "Raya suggests she lock it in with a quiz and flashcards in Tools Studio." | **REAL** suggestion appears; cursor clicks through to Tools Studio; the pre-generated quiz and flashcards appear. |
| 1:24 | "Or she can make her own: add a lesson, a PDF, notes, even a voice memo…" | **REAL** Studio: choose the demo PDF in the file picker, pick quiz/flashcards/summary/mind map, one result generates. Four small file-type icons pop in around the frame word by word. |
| 1:33 | "Meanwhile, in the classroom…" | **Signature transition** (Section 6). |
| 1:34 | "Her teacher has a full class… she doesn't have to guess where to begin." | **REAL** teacher overview, alert badges pulse once. |
| 1:43 | "She filters for students who may need support and opens our student's profile…" | **REAL**: cursor opens a class, clicks the "needs watching" filter, opens Sofia. Highlight the *Leaning on answers* badge on "relying on answers". |
| 1:53 | "One red node stands out: a foundational gap in algebra…" | **REAL** student graph, zoom on the red node, halo. The same node lights in the background. |
| 1:59 | "From here, she can join her students in their Study Rooms, or guide Raya on how to support each one." | **REAL**: teacher opens a Study Room (crossfade), then the instructions-to-Raya screen and types one short instruction. |
| 2:07 | "And she sees learning insights only, never the student's private conversations." | Lock icon + *Mastery only*, 2 s. |
| 2:10 | "She leaves a note for the class team. Now she knows where to start." | **REAL** notes: type a short note, click Add. Hold 1 s. |
| 2:15 | "One student. One teacher. One shared view of what's really understood." | Split screen: student insights (left), teacher profile (right), a glowing line links the two red nodes. |
| 2:18 | "That's Bluestift." | Frames shrink into the logo; background nodes regroup around it. |
| 2:21 | "We diagnose first. The learning follows." | Large, sober text. |
| 2:23 | "Bluestift is live at thebluestift.com. So jump aboard, and welcome!" | URL appears, holds until the end of the voice + 3 s music tail, fade to black. |

Cue starts in `bluestift_demo_cues.json` override these times once aligned.

---

## 4. Other transitions

- **Dive** (signature, reused): zoom 1.0 → 1.25 with 4–6 px directional blur, 12 frames, cross-dissolving into the next scene.
- **Same frame, new content** (chat → Study Room): the frame stays, content crossfades in 15 frames. It communicates "she doesn't leave Raya".
- **Toast expand** (notification → insights page): the toast scales up and becomes the page.
- **Slide up** (Raya → Tools Studio): frame slides up 18 frames.

---

## 5. Screens that must exist in the app (check in Phase 0)

Student: Raya chat with a streamed Socratic reply; Study Room; notification; *My Kernel* insights page with the mastery list and the graph; Tools Studio with generated content and the create flow.
Teacher: overview with class cards and alert badges; class page with the "needs watching" filter; student profile (mastery, badge, Raya analysis, graph, notes); instructions-to-Raya; Study Room access.
If any screen does not behave as described, **stop and report**. Do not fake it, and do not change the narration yourself.

---

## 6. Signature transition: "Meanwhile, in the classroom…"

Seamless match-cut, in the style of "zoom through the screen" transitions seen on social media. It happens **inside the screen**, not as a cut to black.

1. Last student shot: the camera pushes into the **red algebra node** (the diagnosed root cause) in the student's graph, with directional motion blur, accelerating (ease-in), about 16 frames, until the red disc fills the frame.
2. The full-screen red disc **is** the red alert badge/dot of the teacher dashboard (same colour, same position in the next frame). Swap the shots at peak motion, hidden by the blur (1–2 frames of overlap).
3. The camera **pulls back** (ease-out, about 14 frames) revealing the teacher overview around the badge, which settles in the same place.
4. In the background, the graph zooms out and lights dozens of nodes (the class).
5. Total ≈ 30 frames. Narration "Meanwhile, in the classroom…" starts at the beginning of the push-in; the teacher view is fully readable by "Her teacher has a full class…".
Do the match with measured positions from `events.json` bounding boxes, not by eye. If the node and the badge cannot be aligned precisely, use the nearest elements and tell the founder.

---

## 7. Things that must never happen

- Invented UI, messages, numbers, or Raya answers.
- Text on screen that contradicts the narration (e.g. the highlighted root cause must be an algebra concept, since the narration says "algebra").
- Heavy glow, particle storms, film grain, shaky camera, more than one transition style beyond those listed.
- A frame of private data: emails, tokens, real names.
- Exceeding 100 MB. If the encode exceeds 95 MB, lower the bitrate and re-encode, do not crop duration.

---

## 8. First deliverable (do this before everything else)

A **20-second test render** of scenes 11 → 12 (the Meanwhile transition into the teacher dashboard) at final quality, with its bitrate and file size reported, plus a 5-second sync test on the "root cause" moment. The founder approves the look before the full build.

---

## script.txt (narration, tags removed)

Hi everyone, and welcome to Bluestift.

Meet a student. She fails physics. Again. Her teacher sees a bad grade. She sees proof that she's just not good at it... But two years ago, she missed one key idea in algebra, and nobody noticed. That's the kind of problem Bluestift is built to catch. Here's a quick look at how.

It's late, and the physics problem is still open. So she asks Raya for help. Raya doesn't give her the answer. It asks what she would try first, offers a hint when she's close, and reveals the missing piece only when she's truly stuck. Still stuck, she wants to ask her classmates. Luckily, she doesn't have to leave. In a Study Room, her friends are there with Raya, working from the same documents against a shared timer. Learning is social. A tutor shouldn't leave you alone in a corner.

Then a notification pops up: her learning insights are ready. For the first time, she sees her progress concept by concept: what's mastered, what's still shaky, and what's holding her back. It turns out the problem isn't physics. The root cause is a gap in algebra.

She goes back to Raya, and this time the physics problem clicks! Raya suggests she lock it in with a quiz and flashcards in Tools Studio. Or she can make her own: add a lesson, a PDF, notes, even a voice memo, and generate a quiz, flashcards, a summary, or a mind map. She's learning more effectively, and becoming more independent.

Meanwhile, in the classroom… Her teacher has a full class and only an hour a day. But this morning, she doesn't have to guess where to begin. She filters for students who may need support and opens our student's profile: low mastery, and a warning that she may be relying on answers instead of working problems herself. One red node stands out: a foundational gap in algebra, connected to the physics she's finding difficult. From here, she can join her students in their Study Rooms, or guide Raya on how to support each one. And she sees learning insights only, never the student's private conversations. She leaves a note for the class team. Now she knows where to start.

One student. One teacher. One shared view of what's really understood. That's Bluestift. We diagnose first. The learning follows. Bluestift is live at thebluestift.com. So jump aboard, and welcome!
