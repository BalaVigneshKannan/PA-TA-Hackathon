# Demonstration video

Open [PA-TA-Demo.mp4](PA-TA-Demo.mp4). The video is a narrated, edited walkthrough using views captured from the actual running frontend and backend with isolated synthetic data. It is designed to stay below the submission's three-minute limit.

## Deliverables

- `PA-TA-Demo.mp4`: 1920 × 1080, 30 fps, H.264 video and AAC narration; captions summarizing each scene are included visually.
- `PA-TA-Demo.srt`: optional full-narration subtitle track.
- `TRANSCRIPT.md`: narration and scene start times.
- `FOUR-PERSON-SCRIPT.md`: four-presenter script with timed handoffs and screen cues, matching the revised video.
- `FOUR-PERSON-SCRIPT.txt`: plain-text copy for rehearsal.
- `presentation/PA-TA-Demo.pptx`: 25 slides with editable text, demo screenshots, four-presenter speaker notes and scene timings matching the 2:45 video. Narration is in the notes for presenters to read.
- `timeline.json`: exact duration and scene timing.
- `poster.png`: video cover.

## Requirement coverage

| Submission requirement | Video coverage |
|---|---|
| Problem and proposed solution | Administrative steps, generated forms and a centralized application/selection workflow. |
| Working demonstration | Admin setup/rules; student profile, prefilled form and three successful submissions; faculty PA shortlist/acceptance and TA interview/evaluation; submission to Admin; final approval/list; student cancellation and results. Excel and PDF downloads were verified. |
| Users and usage flow | Admin, Student and assigned Faculty, with their role responsibilities and handoffs. |
| Technical choices and impact | React/Vite, Express, PostgreSQL/PGlite, transactions, session authorization, optional institutional assertions and expected benefits. |

## Recording scope

The four-presenter revision uses 365 spoken words. Rehearse at about 135 words per minute with brief handoffs to keep the presentation below three minutes. Presenter labels in the video match the script; the generated narration uses one installed voice. Repository promotion and backend test counts are omitted from the revised narration and visuals.

The recording uses a separate server at `127.0.0.1:5174` and an in-memory PGlite database. It never opens or finalizes the user's existing persistent semester. All student/faculty identities, grades and timetables are synthetic. Credentials are randomly generated and retained only in the ignored `.runtime/` folder.

The demonstration shows a local prototype. Live university SSO/academic integration and production hosting remain to configure. Duty timetable-overlap detection is not implemented. Benefits are expected outcomes, not measured claims.

## Reproduction

After installing the project dependencies and building the frontend:

```powershell
npm.cmd install --prefix demo-video/tools --no-audit --no-fund sharp ffmpeg-static
node demo-video/start-demo.mjs
```

Capture the intended UI states through the browser into `demo-video/.runtime/captures/`, matching the filenames in `scenes.json`. Sign-in settings are generated in the ignored `.runtime/session.json`; do not display or publish its password. This fixture is for local recording only.

In another PowerShell terminal, generate the narration and render:

```powershell
& C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -File demo-video/narrate.ps1
node demo-video/render.mjs
```

Narration uses the installed Microsoft Zira Desktop voice. Rendering uses Sharp and FFmpeg, with pitch-preserving speech timing to meet the duration limit. Dependencies and intermediate audio, screenshots, clips and credential files are ignored by Git. Stop the fixture with Ctrl+C after recording; its synthetic database is discarded.
