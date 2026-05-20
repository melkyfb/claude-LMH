---
name: status
description: >
  Show LMH plugin and Ollama status.
  /lmh:status — check if Ollama is running, show active model and config
---

# LMH Status

Run the following commands and report all results clearly:

## 1. Check Ollama version

```bash
curl -s http://localhost:11434/api/version 2>/dev/null && echo "" || echo "OLLAMA_OFFLINE"
```

If the output is `OLLAMA_OFFLINE` or empty: Ollama is not running. Tell the user to run `ollama serve`.

## 2. List loaded models

```bash
ollama list 2>/dev/null || echo "ollama CLI not found or not running"
```

## 3. Show LMH config

```bash
cat ~/.claude/lmh/config.json 2>/dev/null || echo '{"model":"llama3.2","backend":"auto","autoDetect":true,"ollamaUrl":"http://localhost:11434","patterns":[]}'
```

## Report Format

Present results as:

```
LMH Status
──────────
Ollama: ONLINE v<version> / OFFLINE
Configured model: <model>
Backend: <backend>
  (Note: actual NPU vs CPU selection is made by Ollama internally.
   Set backend=openvino to prefer Intel NPU if available.)
Auto-detect: <true/false>
Ollama URL: <url>
Custom patterns: <count>

Installed models:
<ollama list output>
```
