# LMH — Local Model Helper: Design Spec
**Date:** 2026-05-20
**Status:** Approved

## Overview

Claude Code plugin that offloads tasks to a local Ollama model (running on Intel Core Ultra NPU via AI Boost / OpenVINO), reducing token consumption on Claude (Sonnet). Operates in hybrid mode: explicit `/lmh:` commands always route to local; Claude detects "local-worthy" tasks and asks the user before routing.

---

## Architecture

```
claude-LMH/
├── .claude-plugin/
│   └── plugin.json            # manifest: hooks + metadata
├── skills/
│   ├── local-agent/SKILL.md   # /lmh:local-agent
│   ├── config/SKILL.md        # /lmh:config
│   ├── status/SKILL.md        # /lmh:status
│   ├── stats/SKILL.md         # /lmh:stats
│   └── models/SKILL.md        # /lmh:models
├── src/hooks/
│   ├── session-start.js       # verify Ollama + load config
│   └── prompt-submit.js       # detect local-worthy → inject suggestion
└── README.md
```

**Persistent storage:**
- Config: `~/.claude/lmh/config.json`
- Stats log: `~/.claude/lmh/stats.jsonl` (append-only)

---

## Request Flow

```
user types request
       ↓
UserPromptSubmit hook (prompt-submit.js)
       ↓
local-worthy match? → NO  → Claude processes normally
       ↓ YES
inject system-reminder: "Task detected as local-worthy.
Suggest /lmh:local-agent before processing."
       ↓
Claude asks user
       ↓
user confirms → /lmh:local-agent → skill runs `ollama run <model> "<prompt>"`
user declines → Claude processes normally
```

---

## Hooks

### `session-start.js`
Runs at session start:
1. Read `~/.claude/lmh/config.json` (create default if missing)
2. Check Ollama running (`curl <config.ollamaUrl>/api/version`)
3. Inject into context: configured model, Ollama status, NPU backend
4. If Ollama offline → warning in system-reminder, does not block session

### `prompt-submit.js`
Runs on every `UserPromptSubmit`:

Detects local-worthy tasks via configurable pattern matching:

```js
const LOCAL_PATTERNS = [
  /cri[ae].*\.(gitignore|dockerfile|env|toml|yaml|json)/i,
  /gere?\s+(template|boilerplate|scaffold)/i,
  /liste?\s+(arquivos|files|diretórios)/i,
  /resuma?\s+(esse|este|o)\s+(log|arquivo|file)/i,
  /o que (é|faz)\s+\w+/i,
]
```

- If `config.autoDetect = false` → hook passes through (explicit `/lmh:` only)
- Custom patterns from `config.patterns[]` are merged with built-in patterns

**NPU backend config field:**
- `"auto"` — Ollama auto-detects (default)
- `"openvino"` — force Intel NPU via OpenVINO
- `"cpu"` — explicit CPU fallback

---

## Skills

### `/lmh:local-agent <task>`
Instructs Claude to run `ollama run <model> "<prompt>"` via Bash. Captures output, presents to user. Appends to `stats.jsonl`: timestamp, model, prompt length, response length, estimated tokens saved.

### `/lmh:config [key] [value]`
- No args → show current config
- `model <name>` → set default model
- `backend <auto|openvino|cpu>` → set NPU backend
- `autoDetect <true|false>` → toggle auto-detection
- `patterns add "<pattern>"` → add custom detection pattern

### `/lmh:status`
Runs `ollama list` + `curl <config.ollamaUrl>/api/version`. Shows: Ollama running, active model, actual backend used (NPU/GPU/CPU), memory usage.

### `/lmh:stats`
Reads `stats.jsonl`, aggregates by day/week/total. Shows: local executions count, estimated tokens saved, most-used model. Estimates based on `(prompt_len + response_len) × 0.75 tokens/char` — displayed as estimate, not exact.

### `/lmh:models`
Runs `ollama list`. Lists installed models, marks configured default. Shows hint for `ollama pull <model>`.

---

## Default Config

```json
{
  "model": "llama3.2",
  "backend": "auto",
  "autoDetect": true,
  "ollamaUrl": "http://localhost:11434",
  "patterns": []
}
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Ollama offline at session start | Warning injected, session continues |
| Ollama offline at `/lmh:local-agent` | Clear message: "Run `ollama serve`" — does NOT silently fall back to Claude |
| NPU unavailable with `backend: openvino` | Ollama falls back to CPU automatically; `/lmh:status` shows actual backend |
| Model not installed | Detects "model not found" error → suggests `ollama pull <model>` |
| Pattern match too aggressive | `autoDetect false` via config disables detection; built-in patterns are conservative (high-confidence only) |
| Token savings estimate | Clearly labeled as estimate; formula: `(chars) × 0.75` |

---

## Hardware Target

- **Primary:** Intel Core Ultra with AI Boost NPU (OpenVINO backend)
- **Fallback:** CPU (automatic via Ollama)
- **Default model:** `llama3.2` (4B — good balance for NPU memory constraints)
- **Ollama version requirement:** 0.3.0+ (OpenVINO support)

---

## Out of Scope

- GPU (Nvidia/AMD) optimization — can be added later via `backend` config
- Streaming output from Ollama
- Multi-turn local conversations (single prompt/response only)
- Automatic model selection based on task type
