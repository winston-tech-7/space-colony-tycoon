# Remix Package — DUCK × MY × DUCK

## What's inside

- **PROMPT.md** — the app description with architectural recommendations tied to the methodology. The main entry file.
- **schema.json** — the screen graph (nodes/edges) for programmatic parsing.
- **screens/** — key screenshots.
- **METHODOLOGY.md** — the Telegram Bot + Mini App architectural reference: the 3-process model, identity-bridge, intent-pattern, FSM, media locks, Stars vs Cards, multi-currency, push philosophy, golden rules. The same file ships in every remix package. The agent uses it as a filter when generating code.

## How to use

Unpack the archive into your project root. Any modern AI agent (Claude Code, Cursor, Codex, Windsurf) will read `PROMPT.md`, see the references to `METHODOLOGY.md`, and pick it up as context.

Without IDE integration — feed the agent all four artifacts at once: PROMPT.md + schema.json + screens + METHODOLOGY.md.

---

> A prototype scaffold based on the analyzed app, not an exact copy.
