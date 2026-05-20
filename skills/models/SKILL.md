---
name: models
description: >
  List available local Ollama models and show which one is configured as default.
  /lmh:models — list installed models, mark default, show install hints
---

# LMH Models

## List installed models

```bash
ollama list 2>/dev/null || echo "Ollama not running or not installed. Start with: ollama serve"
```

## Show configured default

```bash
node -e "
const fs = require('fs'), os = require('os');
const p = os.homedir() + '/.claude/lmh/config.json';
try {
  const c = JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log('Configured default model: ' + c.model);
} catch(e) {
  console.log('Configured default model: llama3.2 (default — config not found)');
}
"
```

## Report

Present the installed models list with a `*` marker next to the configured default. Example:

```
Installed Ollama models:
  llama3.2:latest    2.0 GB   * (configured default)
  codellama:latest   3.8 GB
  mistral:latest     4.1 GB

To set a different default: /lmh:config model <name>
```

## Installing recommended models for Intel NPU

These models work well within Intel AI Boost NPU memory constraints:

```bash
ollama pull llama3.2          # 4B — good balance of quality and speed
ollama pull llama3.2:1b       # 1B — fastest, minimal tasks
ollama pull qwen2.5-coder:3b  # 3B — code-focused
```

To use a model: `/lmh:config model <name>`, then `/lmh:local-agent <task>`
