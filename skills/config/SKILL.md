---
name: config
description: >
  View or modify LMH plugin configuration.
  /lmh:config — show current config
  /lmh:config model <name> — set Ollama model
  /lmh:config backend <auto|openvino|cpu> — set NPU/CPU backend
  /lmh:config autoDetect <true|false> — toggle auto-detection
  /lmh:config patterns add "<regex>" — add custom detection pattern
---

# LMH Config

Config file: `~/.claude/lmh/config.json`

## Show current config

```bash
cat ~/.claude/lmh/config.json 2>/dev/null || echo "Config not found — defaults in use: model=llama3.2, backend=auto, autoDetect=true"
```

## Set a field (model, backend, autoDetect, ollamaUrl)

Read the current config, update the field, write back:

```bash
node -e "
const fs = require('fs'), os = require('os');
const p = os.homedir() + '/.claude/lmh/config.json';
const defaults = { model: 'llama3.2', backend: 'auto', autoDetect: true, ollamaUrl: 'http://localhost:11434', patterns: [] };
let c;
try { c = Object.assign({}, defaults, JSON.parse(fs.readFileSync(p, 'utf8'))); }
catch(e) { c = Object.assign({}, defaults); }
c['<KEY>'] = <VALUE>;
fs.mkdirSync(os.homedir() + '/.claude/lmh', { recursive: true });
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('Updated config:', JSON.stringify(c, null, 2));
"
```

Replace `<KEY>` and `<VALUE>` with the actual key and value.

**Examples:**
- `model` → `'llama3.1'` (string)
- `backend` → `'openvino'` (string: `'auto'`, `'openvino'`, or `'cpu'`)
- `autoDetect` → `false` (boolean)
- `ollamaUrl` → `'http://localhost:11434'` (string)

## Add a custom detection pattern

```bash
node -e "
const fs = require('fs'), os = require('os');
const p = os.homedir() + '/.claude/lmh/config.json';
const defaults = { model: 'llama3.2', backend: 'auto', autoDetect: true, ollamaUrl: 'http://localhost:11434', patterns: [] };
let c;
try { c = Object.assign({}, defaults, JSON.parse(fs.readFileSync(p, 'utf8'))); }
catch(e) { c = Object.assign({}, defaults); }
c.patterns = [...(c.patterns || []), '<REGEX_PATTERN>'];
fs.mkdirSync(os.homedir() + '/.claude/lmh', { recursive: true });
fs.writeFileSync(p, JSON.stringify(c, null, 2));
console.log('Pattern added. All patterns:', c.patterns);
"
```

Replace `<REGEX_PATTERN>` with a regex string (e.g. `escreva.*changelog`).

## Config Fields Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | string | `llama3.2` | Ollama model to use for local tasks |
| `backend` | string | `auto` | `auto` (Ollama decides), `openvino` (Intel NPU), `cpu` (force CPU) |
| `autoDetect` | boolean | `true` | Auto-suggest local routing for matching prompts |
| `ollamaUrl` | string | `http://localhost:11434` | Ollama REST API URL |
| `patterns` | string[] | `[]` | Custom regex patterns for local-worthy detection |
