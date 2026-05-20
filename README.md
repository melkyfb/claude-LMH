# LMH — Local Model Helper

A Claude Code plugin that offloads tasks to a local [Ollama](https://ollama.com) model,
reducing token consumption on Claude (Sonnet). Optimized for Intel Core Ultra with AI Boost NPU.

## How It Works

- **Explicit routing**: Use `/lmh:local-agent <task>` to always run on the local model
- **Auto-detection**: LMH watches your prompts for simple tasks (.gitignore, templates, file listing) and asks: *"Want to use your local model for this?"*

## Requirements

- [Claude Code](https://claude.ai/code) with plugin support
- [Ollama](https://ollama.com) 0.3.0+ installed and running
- Node.js 18+ (for hooks)
- Recommended: Intel Core Ultra with AI Boost NPU + OpenVINO backend

## Installation

```bash
# In Claude Code
/plugins install path/to/claude-LMH

# Or copy to your Claude plugins directory
cp -r claude-LMH ~/.claude/plugins/lmh
```

Then start a new Claude Code session — LMH activates automatically.

## First Run

```bash
# Install a model
ollama pull llama3.2

# Start Ollama
ollama serve

# In Claude Code — test it
/lmh:status
/lmh:local-agent create a .gitignore for a Node.js project
```

## Commands

| Command | Description |
|---------|-------------|
| `/lmh:local-agent <task>` | Run task on local Ollama model |
| `/lmh:config` | Show or edit configuration |
| `/lmh:status` | Check Ollama status and active config |
| `/lmh:stats` | View estimated token savings |
| `/lmh:models` | List installed Ollama models |

## Configuration

```json
// ~/.claude/lmh/config.json
{
  "model": "llama3.2",
  "backend": "auto",
  "autoDetect": true,
  "ollamaUrl": "http://localhost:11434",
  "patterns": []
}
```

| Field | Options | Description |
|-------|---------|-------------|
| `model` | any Ollama model name | Model to use for local tasks |
| `backend` | `auto`, `openvino`, `cpu` | `openvino` = Intel NPU via OpenVINO |
| `autoDetect` | `true`/`false` | Auto-suggest local routing |
| `patterns` | regex string array | Custom task detection patterns |

## Intel NPU Setup

To use the Intel AI Boost NPU:

1. Ensure Ollama 0.3.0+ with OpenVINO support is installed
2. Set backend: `/lmh:config backend openvino`
3. Verify with `/lmh:status`

## Token Savings

Stats are stored in `~/.claude/lmh/stats.jsonl`. View with `/lmh:stats`.
Savings are estimates: `(promptLen + responseLen) × 0.75 tokens/char`.
