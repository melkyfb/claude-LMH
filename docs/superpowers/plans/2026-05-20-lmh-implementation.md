# LMH — Local Model Helper: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code plugin that offloads tasks to a local Ollama model via hooks and skills, reducing token consumption on Claude (Sonnet).

**Architecture:** Node.js hooks intercept Claude sessions and prompts — SessionStart checks Ollama health and injects status, UserPromptSubmit detects local-worthy tasks and suggests routing. Five SKILL.md files expose `/lmh:` slash commands. All config and stats persist under `~/.claude/lmh/`.

**Tech Stack:** Node.js (built-ins only — no npm deps at runtime), Jest (dev), Ollama CLI + REST API (`http://localhost:11434`), Claude Code plugin system (`.claude-plugin/plugin.json`)

---

## File Map

| File | Responsibility |
|------|----------------|
| `.claude-plugin/plugin.json` | Plugin manifest — declares hooks and metadata |
| `src/hooks/lmh-config.js` | Shared utilities: read/write config, append/read stats |
| `src/hooks/session-start.js` | SessionStart hook — verify Ollama, inject status context |
| `src/hooks/prompt-submit.js` | UserPromptSubmit hook — detect local-worthy tasks, inject suggestion |
| `skills/local-agent/SKILL.md` | `/lmh:local-agent` — run task via `ollama run`, record stats |
| `skills/config/SKILL.md` | `/lmh:config` — view/edit `~/.claude/lmh/config.json` |
| `skills/status/SKILL.md` | `/lmh:status` — show Ollama status + config |
| `skills/stats/SKILL.md` | `/lmh:stats` — aggregate token savings from stats.jsonl |
| `skills/models/SKILL.md` | `/lmh:models` — list installed Ollama models |
| `tests/lmh-config.test.js` | Unit tests for lmh-config.js |
| `tests/session-start.test.js` | Unit tests for buildMessage() from session-start.js |
| `tests/prompt-submit.test.js` | Unit tests for isLocalWorthy() from prompt-submit.js |
| `package.json` | Jest dev dependency only |
| `README.md` | Install and usage docs |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.claude-plugin/plugin.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize git repo**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH
git init
```

Expected: `Initialized empty Git repository in .../claude-LMH/.git/`

- [ ] **Step 2: Create package.json**

```json
{
  "name": "claude-lmh",
  "version": "1.0.0",
  "description": "Local Model Helper — Claude Code plugin that offloads tasks to local Ollama models",
  "scripts": {
    "test": "jest --testPathPattern=tests/"
  },
  "devDependencies": {
    "jest": "^29.0.0"
  }
}
```

Save to: `package.json`

- [ ] **Step 3: Install Jest**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH && npm install
```

Expected: `added N packages` with `node_modules/` created.

- [ ] **Step 4: Create .claude-plugin/plugin.json**

```bash
mkdir -p /home/melkyfb/githubmelkyfb/claude-LMH/.claude-plugin
```

```json
{
  "name": "lmh",
  "description": "Local Model Helper — offload tasks to Ollama to reduce Claude token usage. Supports Intel NPU via OpenVINO.",
  "author": {
    "name": "melkyfb"
  },
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/src/hooks/session-start.js\"",
            "timeout": 8,
            "statusMessage": "Checking local model (Ollama)..."
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/src/hooks/prompt-submit.js\"",
            "timeout": 3,
            "statusMessage": "Checking for local-worthy task..."
          }
        ]
      }
    ]
  }
}
```

Save to: `.claude-plugin/plugin.json`

- [ ] **Step 5: Create directory structure**

```bash
mkdir -p /home/melkyfb/githubmelkyfb/claude-LMH/src/hooks
mkdir -p /home/melkyfb/githubmelkyfb/claude-LMH/skills/local-agent
mkdir -p /home/melkyfb/githubmelkyfb/claude-LMH/skills/config
mkdir -p /home/melkyfb/githubmelkyfb/claude-LMH/skills/status
mkdir -p /home/melkyfb/githubmelkyfb/claude-LMH/skills/stats
mkdir -p /home/melkyfb/githubmelkyfb/claude-LMH/skills/models
mkdir -p /home/melkyfb/githubmelkyfb/claude-LMH/tests
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
*.log
.DS_Store
```

Save to: `.gitignore`

- [ ] **Step 7: Commit scaffold**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH
git add package.json package-lock.json .claude-plugin/plugin.json .gitignore
git commit -m "chore: initial project scaffold with plugin manifest and Jest"
```

---

## Task 2: lmh-config.js — Shared Utilities

**Files:**
- Create: `src/hooks/lmh-config.js`
- Create: `tests/lmh-config.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/lmh-config.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');

// Override home dir so tests write to a temp dir, not real ~/.claude/lmh
const TEMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'lmh-test-'));
process.env.LMH_CONFIG_DIR = path.join(TEMP_HOME, '.claude', 'lmh');

const {
  DEFAULT_CONFIG,
  getConfigDir,
  getConfigPath,
  getStatsPath,
  readConfig,
  writeConfig,
  ensureConfig,
  appendStats,
  readStats
} = require('../src/hooks/lmh-config');

afterAll(() => {
  fs.rmSync(TEMP_HOME, { recursive: true, force: true });
});

describe('getConfigDir', () => {
  it('returns path under LMH_CONFIG_DIR when set', () => {
    expect(getConfigDir()).toBe(process.env.LMH_CONFIG_DIR);
  });
});

describe('readConfig', () => {
  it('returns DEFAULT_CONFIG when file missing', () => {
    const cfg = readConfig();
    expect(cfg).toEqual(DEFAULT_CONFIG);
  });

  it('merges partial file with defaults', () => {
    const dir = getConfigDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(getConfigPath(), JSON.stringify({ model: 'mistral' }));
    const cfg = readConfig();
    expect(cfg.model).toBe('mistral');
    expect(cfg.backend).toBe(DEFAULT_CONFIG.backend);
    expect(cfg.autoDetect).toBe(DEFAULT_CONFIG.autoDetect);
  });
});

describe('writeConfig / readConfig roundtrip', () => {
  it('persists all fields', () => {
    const custom = { ...DEFAULT_CONFIG, model: 'codellama', backend: 'openvino' };
    writeConfig(custom);
    expect(readConfig()).toEqual(custom);
  });
});

describe('ensureConfig', () => {
  it('creates default config if missing', () => {
    const cfgPath = getConfigPath();
    try { fs.unlinkSync(cfgPath); } catch (e) {}
    ensureConfig();
    expect(fs.existsSync(cfgPath)).toBe(true);
    expect(readConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('does not overwrite existing config', () => {
    writeConfig({ ...DEFAULT_CONFIG, model: 'llama3.1' });
    ensureConfig();
    expect(readConfig().model).toBe('llama3.1');
  });
});

describe('appendStats / readStats', () => {
  it('appends entries and reads them back', () => {
    const entry1 = { timestamp: '2026-05-20T10:00:00Z', model: 'llama3.2', promptLen: 50, responseLen: 200, estimatedTokensSaved: 187 };
    const entry2 = { timestamp: '2026-05-20T11:00:00Z', model: 'mistral', promptLen: 30, responseLen: 100, estimatedTokensSaved: 97 };
    appendStats(entry1);
    appendStats(entry2);
    const stats = readStats();
    expect(stats).toHaveLength(2);
    expect(stats[0]).toEqual(entry1);
    expect(stats[1]).toEqual(entry2);
  });

  it('returns empty array when stats file missing', () => {
    // Use a fresh config dir
    const origDir = process.env.LMH_CONFIG_DIR;
    process.env.LMH_CONFIG_DIR = path.join(TEMP_HOME, 'empty-stats');
    expect(readStats()).toEqual([]);
    process.env.LMH_CONFIG_DIR = origDir;
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH && npx jest tests/lmh-config.test.js
```

Expected: `Cannot find module '../src/hooks/lmh-config'`

- [ ] **Step 3: Implement lmh-config.js**

```js
// src/hooks/lmh-config.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
  model: 'llama3.2',
  backend: 'auto',
  autoDetect: true,
  ollamaUrl: 'http://localhost:11434',
  patterns: []
};

function getConfigDir() {
  // LMH_CONFIG_DIR env var allows tests to redirect to a temp dir
  if (process.env.LMH_CONFIG_DIR) return process.env.LMH_CONFIG_DIR;
  return path.join(os.homedir(), '.claude', 'lmh');
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json');
}

function getStatsPath() {
  return path.join(getConfigDir(), 'stats.jsonl');
}

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf8');
    return Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw));
  } catch (e) {
    return Object.assign({}, DEFAULT_CONFIG);
  }
}

function writeConfig(config) {
  const dir = getConfigDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), 'utf8');
}

function ensureConfig() {
  try {
    fs.accessSync(getConfigPath());
  } catch (e) {
    writeConfig(DEFAULT_CONFIG);
  }
  return readConfig();
}

function appendStats(entry) {
  try {
    const dir = getConfigDir();
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(getStatsPath(), JSON.stringify(entry) + '\n', 'utf8');
  } catch (e) {
    // silent fail — stats are best-effort
  }
}

function readStats() {
  try {
    const raw = fs.readFileSync(getStatsPath(), 'utf8');
    return raw.split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  } catch (e) {
    return [];
  }
}

module.exports = {
  DEFAULT_CONFIG,
  getConfigDir,
  getConfigPath,
  getStatsPath,
  readConfig,
  writeConfig,
  ensureConfig,
  appendStats,
  readStats
};
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH && npx jest tests/lmh-config.test.js
```

Expected: `Tests: 7 passed, 7 total`

- [ ] **Step 5: Commit**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH
git add src/hooks/lmh-config.js tests/lmh-config.test.js
git commit -m "feat: add lmh-config.js shared utilities with tests"
```

---

## Task 3: session-start.js — SessionStart Hook

**Files:**
- Create: `src/hooks/session-start.js`
- Create: `tests/session-start.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/session-start.test.js
const { buildMessage } = require('../src/hooks/session-start');

const baseConfig = {
  model: 'llama3.2',
  backend: 'auto',
  autoDetect: true,
  ollamaUrl: 'http://localhost:11434',
  patterns: []
};

describe('buildMessage', () => {
  it('includes model name from config', () => {
    const msg = buildMessage(baseConfig, true, '0.3.6');
    expect(msg).toContain('llama3.2');
  });

  it('shows ONLINE and version when Ollama is running', () => {
    const msg = buildMessage(baseConfig, true, '0.3.6');
    expect(msg).toContain('ONLINE');
    expect(msg).toContain('0.3.6');
    expect(msg).toContain('/lmh:local-agent');
  });

  it('shows WARNING and ollama serve hint when Ollama is offline', () => {
    const msg = buildMessage(baseConfig, false, null);
    expect(msg).toContain('WARNING');
    expect(msg).toContain('ollama serve');
    expect(msg).not.toContain('ONLINE');
  });

  it('shows backend setting from config', () => {
    const cfg = { ...baseConfig, backend: 'openvino' };
    const msg = buildMessage(cfg, true, '0.3.6');
    expect(msg).toContain('openvino');
  });

  it('includes auto-detect status', () => {
    const msg = buildMessage({ ...baseConfig, autoDetect: false }, true, '0.3.6');
    expect(msg).toContain('false');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH && npx jest tests/session-start.test.js
```

Expected: `Cannot find module '../src/hooks/session-start'`

- [ ] **Step 3: Implement session-start.js**

```js
#!/usr/bin/env node
// src/hooks/session-start.js
// SessionStart hook: verifies Ollama is running, injects LMH status into context.

const http = require('http');
const { ensureConfig } = require('./lmh-config');

function buildMessage(config, ollamaOnline, version) {
  const lines = [
    'LMH (Local Model Helper) loaded.',
    `  Model: ${config.model} | Backend: ${config.backend} | Auto-detect: ${config.autoDetect}`,
    `  Ollama URL: ${config.ollamaUrl}`,
  ];

  if (ollamaOnline) {
    lines.push(`  Ollama: ONLINE (v${version || 'unknown'})`);
    lines.push('  Local model ready. Use /lmh:local-agent to offload tasks and save tokens.');
  } else {
    lines.push('  WARNING: Ollama is OFFLINE. Run `ollama serve` to enable local model routing.');
    lines.push('  /lmh:local-agent will fail until Ollama is running. Claude will handle all tasks.');
  }

  return lines.join('\n');
}

if (require.main === module) {
  const config = ensureConfig();
  let urlObj;
  try {
    urlObj = new URL(config.ollamaUrl);
  } catch (e) {
    process.stdout.write(buildMessage(config, false, null));
    process.exit(0);
  }

  const req = http.get({
    hostname: urlObj.hostname,
    port: urlObj.port || 11434,
    path: '/api/version',
    timeout: 4000
  }, (res) => {
    let body = '';
    res.on('data', chunk => { body += chunk; });
    res.on('end', () => {
      try {
        const version = JSON.parse(body).version || 'unknown';
        process.stdout.write(buildMessage(config, true, version));
      } catch (e) {
        process.stdout.write(buildMessage(config, true, 'unknown'));
      }
    });
  });

  req.on('error', () => {
    process.stdout.write(buildMessage(config, false, null));
  });

  req.on('timeout', () => {
    req.destroy();
    process.stdout.write(buildMessage(config, false, null));
  });
}

module.exports = { buildMessage };
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH && npx jest tests/session-start.test.js
```

Expected: `Tests: 5 passed, 5 total`

- [ ] **Step 5: Commit**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH
git add src/hooks/session-start.js tests/session-start.test.js
git commit -m "feat: add session-start hook with Ollama health check"
```

---

## Task 4: prompt-submit.js — UserPromptSubmit Hook

**Files:**
- Create: `src/hooks/prompt-submit.js`
- Create: `tests/prompt-submit.test.js`

- [ ] **Step 1: Write failing tests**

```js
// tests/prompt-submit.test.js
const { isLocalWorthy } = require('../src/hooks/prompt-submit');

const baseConfig = {
  model: 'llama3.2',
  autoDetect: true,
  patterns: []
};

describe('isLocalWorthy — autoDetect off', () => {
  it('returns false regardless of prompt when autoDetect is false', () => {
    const cfg = { ...baseConfig, autoDetect: false };
    expect(isLocalWorthy('crie um .gitignore para este projeto', cfg)).toBe(false);
    expect(isLocalWorthy('create a .dockerfile', cfg)).toBe(false);
  });
});

describe('isLocalWorthy — builtin patterns', () => {
  it('matches Portuguese .gitignore creation', () => {
    expect(isLocalWorthy('crie um .gitignore para este projeto', baseConfig)).toBe(true);
  });

  it('matches English .gitignore creation', () => {
    expect(isLocalWorthy('create a .gitignore for this project', baseConfig)).toBe(true);
  });

  it('matches Dockerfile creation', () => {
    expect(isLocalWorthy('crie um dockerfile para node', baseConfig)).toBe(true);
  });

  it('matches boilerplate generation', () => {
    expect(isLocalWorthy('gere um template para um projeto python', baseConfig)).toBe(true);
  });

  it('matches file listing in Portuguese', () => {
    expect(isLocalWorthy('liste os arquivos deste projeto', baseConfig)).toBe(true);
  });

  it('matches file listing in English', () => {
    expect(isLocalWorthy('list the files in this directory', baseConfig)).toBe(true);
  });

  it('matches log summarization', () => {
    expect(isLocalWorthy('resuma esse log para mim', baseConfig)).toBe(true);
  });

  it('does NOT match complex architectural questions', () => {
    expect(isLocalWorthy('refactor the entire auth system to use JWT', baseConfig)).toBe(false);
  });

  it('does NOT match debugging requests', () => {
    expect(isLocalWorthy('why is my React component causing an infinite loop', baseConfig)).toBe(false);
  });
});

describe('isLocalWorthy — custom patterns', () => {
  it('matches a custom pattern added to config', () => {
    const cfg = { ...baseConfig, patterns: ['escreva.*changelog'] };
    expect(isLocalWorthy('escreva um changelog para esta versão', cfg)).toBe(true);
  });

  it('does not match when custom pattern does not fit', () => {
    const cfg = { ...baseConfig, patterns: ['escreva.*changelog'] };
    expect(isLocalWorthy('crie uma nova feature', cfg)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH && npx jest tests/prompt-submit.test.js
```

Expected: `Cannot find module '../src/hooks/prompt-submit'`

- [ ] **Step 3: Implement prompt-submit.js**

```js
#!/usr/bin/env node
// src/hooks/prompt-submit.js
// UserPromptSubmit hook: detects local-worthy tasks and injects a suggestion
// to route the task to /lmh:local-agent instead of consuming Claude tokens.

const { readConfig } = require('./lmh-config');

const BUILTIN_PATTERNS = [
  /cri[ae]\s+(um\s+)?\.?(gitignore|dockerfile|env|toml|yaml|json|md|sh|txt)/i,
  /create\s+(a\s+)?\.?(gitignore|dockerfile|env|toml|yaml|json|md|sh|txt)/i,
  /gere?\s+(um\s+)?(template|boilerplate|scaffold)/i,
  /generate\s+(a\s+)?(template|boilerplate|scaffold)/i,
  /liste?\s+(os\s+|as\s+)?(arquivos|files|diretórios|directories)/i,
  /list\s+(the\s+)?(files|directories)\s+(in\s+)?/i,
  /resuma?\s+(esse|este|o|this|the)\s+(log|arquivo|file)/i,
  /summarize\s+(this|the)\s+(log|file)/i,
];

function isLocalWorthy(prompt, config) {
  if (!config.autoDetect) return false;

  const customPatterns = (config.patterns || []).map(p => {
    try { return new RegExp(p, 'i'); } catch (e) { return null; }
  }).filter(Boolean);

  const allPatterns = [...BUILTIN_PATTERNS, ...customPatterns];
  return allPatterns.some(pattern => pattern.test(prompt));
}

if (require.main === module) {
  let input = '';
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      const prompt = (data.prompt || '').trim();
      const config = readConfig();

      if (isLocalWorthy(prompt, config)) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'UserPromptSubmit',
            additionalContext:
              `LMH detected a local-worthy task (no deep project context needed). ` +
              `Before processing, ask: "This looks like a task I can offload to your local Ollama model (${config.model}) to save Claude tokens. Want to use /lmh:local-agent instead?" ` +
              `Wait for their response before proceeding.`
          }
        }));
      }
    } catch (e) {
      // silent fail — never block the prompt
    }
  });
}

module.exports = { isLocalWorthy, BUILTIN_PATTERNS };
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH && npx jest tests/prompt-submit.test.js
```

Expected: `Tests: 12 passed, 12 total`

- [ ] **Step 5: Run all tests together**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH && npx jest
```

Expected: `Test Suites: 3 passed, 3 total`

- [ ] **Step 6: Commit**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH
git add src/hooks/prompt-submit.js tests/prompt-submit.test.js
git commit -m "feat: add prompt-submit hook with local-worthy detection and tests"
```

---

## Task 5: skills/local-agent/SKILL.md

**Files:**
- Create: `skills/local-agent/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

```markdown
---
name: local-agent
description: >
  Offload a task to the local Ollama model to save Claude tokens.
  Use when: user explicitly types /lmh:local-agent, or when LMH hook suggests routing.
  Examples: /lmh:local-agent create a .gitignore for a Node.js project
            /lmh:local-agent summarize this log file
            /lmh:local-agent generate a Dockerfile for a Python app
---

# LMH Local Agent

Offload the given task to the local Ollama model via `ollama run`.

## Steps

### 1. Read config to get the configured model

```bash
cat ~/.claude/lmh/config.json 2>/dev/null || echo '{"model":"llama3.2"}'
```

Extract the `model` field. If the file is missing, use `llama3.2`.

### 2. Run the task via Ollama

Use `printf` to pipe the prompt to avoid shell quoting issues with special characters:

```bash
printf '%s' "<TASK_FROM_USER>" | ollama run <MODEL>
```

Example for `.gitignore`:
```bash
printf '%s' "Create a .gitignore file for a Node.js project. Output only the file contents, no explanation." | ollama run llama3.2
```

### 3. Present the output

Show the raw output from Ollama to the user. If the output is a file (like `.gitignore`), offer to write it:

```bash
# Write the output to a file if user confirms
cat > .gitignore << 'EOF'
<OLLAMA_OUTPUT>
EOF
```

### 4. Record stats

After successful execution, append to stats log:

```bash
node -e "
const fs = require('fs');
const os = require('os');
const dir = os.homedir() + '/.claude/lmh';
fs.mkdirSync(dir, { recursive: true });
const entry = {
  timestamp: new Date().toISOString(),
  model: '<MODEL>',
  promptLen: <PROMPT_CHAR_COUNT>,
  responseLen: <RESPONSE_CHAR_COUNT>,
  estimatedTokensSaved: Math.round((<PROMPT_CHAR_COUNT> + <RESPONSE_CHAR_COUNT>) * 0.75)
};
fs.appendFileSync(dir + '/stats.jsonl', JSON.stringify(entry) + '\n');
console.log('Stats recorded. Estimated tokens saved:', entry.estimatedTokensSaved, '(estimate)');
"
```

Replace `<MODEL>`, `<PROMPT_CHAR_COUNT>`, `<RESPONSE_CHAR_COUNT>` with actual values.

## Error Handling

**Model not found:**
```
Error: model 'llama3.2' not found
```
→ Tell user: "Model not installed. Run: `ollama pull llama3.2`"

**Ollama not running (connection refused):**
```
Error: dial tcp: connection refused
```
→ Tell user: "Ollama is not running. Start it with: `ollama serve`"  
→ Do NOT silently fall back to processing with Claude. Let the user decide.

**Exit code non-zero for any other reason:**
→ Show the error output and ask user how to proceed.
```

Save to: `skills/local-agent/SKILL.md`

- [ ] **Step 2: Verify file created**

```bash
cat /home/melkyfb/githubmelkyfb/claude-LMH/skills/local-agent/SKILL.md | head -5
```

Expected: frontmatter with `name: local-agent`

- [ ] **Step 3: Commit**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH
git add skills/local-agent/SKILL.md
git commit -m "feat: add /lmh:local-agent skill"
```

---

## Task 6: skills/config/SKILL.md

**Files:**
- Create: `skills/config/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

```markdown
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
```

Save to: `skills/config/SKILL.md`

- [ ] **Step 2: Commit**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH
git add skills/config/SKILL.md
git commit -m "feat: add /lmh:config skill"
```

---

## Task 7: skills/status/SKILL.md

**Files:**
- Create: `skills/status/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

```markdown
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
```

Save to: `skills/status/SKILL.md`

- [ ] **Step 2: Commit**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH
git add skills/status/SKILL.md
git commit -m "feat: add /lmh:status skill"
```

---

## Task 8: skills/stats/SKILL.md

**Files:**
- Create: `skills/stats/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

```markdown
---
name: stats
description: >
  Show LMH token savings statistics from local model executions.
  /lmh:stats — total executions, estimated tokens saved, most-used model
---

# LMH Stats

Read and aggregate the stats log:

```bash
node -e "
const fs = require('fs'), os = require('os');
const p = os.homedir() + '/.claude/lmh/stats.jsonl';
try {
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter(l => l.trim());
  if (!lines.length) { console.log('No stats yet. Run some /lmh:local-agent tasks first.'); process.exit(0); }

  const entries = lines.map(l => JSON.parse(l));

  const total = entries.length;
  const totalSaved = entries.reduce((s, e) => s + (e.estimatedTokensSaved || 0), 0);

  // Aggregate by model
  const modelCounts = {};
  entries.forEach(e => { modelCounts[e.model] = (modelCounts[e.model] || 0) + 1; });
  const topModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0];

  // Last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentEntries = entries.filter(e => new Date(e.timestamp) > weekAgo);
  const recentSaved = recentEntries.reduce((s, e) => s + (e.estimatedTokensSaved || 0), 0);

  console.log('LMH Token Savings Stats');
  console.log('────────────────────────');
  console.log('Total local executions: ' + total);
  console.log('Estimated tokens saved (all time): ' + totalSaved + '  ← estimate, not exact');
  console.log('Estimated tokens saved (last 7 days): ' + recentSaved);
  console.log('Most-used model: ' + (topModel ? topModel[0] + ' (' + topModel[1] + ' runs)' : 'none'));
  console.log('');
  console.log('Note: savings estimated as (promptLen + responseLen) × 0.75 tokens/char.');
} catch(e) {
  console.log('No stats yet. Run some /lmh:local-agent tasks first.');
}
"
```
```

Save to: `skills/stats/SKILL.md`

- [ ] **Step 2: Commit**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH
git add skills/stats/SKILL.md
git commit -m "feat: add /lmh:stats skill"
```

---

## Task 9: skills/models/SKILL.md

**Files:**
- Create: `skills/models/SKILL.md`

- [ ] **Step 1: Create SKILL.md**

```markdown
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

Present the installed models list with a `★` marker next to the configured default. Example:

```
Installed Ollama models:
  llama3.2:latest    2.0 GB   ★ (configured default)
  codellama:latest   3.8 GB
  mistral:latest     4.1 GB

To set a different default: /lmh:config model <name>
```

## Installing recommended models for Intel NPU

These models work well within Intel AI Boost NPU memory constraints:

```bash
ollama pull llama3.2        # 4B — good balance of quality and speed
ollama pull llama3.2:1b     # 1B — fastest, minimal tasks
ollama pull qwen2.5-coder:3b  # 3B — code-focused
```

To use a model: `/lmh:config model <name>`, then `/lmh:local-agent <task>`
```

Save to: `skills/models/SKILL.md`

- [ ] **Step 2: Commit**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH
git add skills/models/SKILL.md
git commit -m "feat: add /lmh:models skill"
```

---

## Task 10: README.md and Final Verification

**Files:**
- Create: `README.md`

- [ ] **Step 1: Run full test suite one final time**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH && npx jest
```

Expected:
```
Test Suites: 3 passed, 3 total
Tests:       N passed, N total
```

- [ ] **Step 2: Create README.md**

```markdown
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
```

- [ ] **Step 3: Final commit**

```bash
cd /home/melkyfb/githubmelkyfb/claude-LMH
git add README.md
git commit -m "docs: add README with install, usage, and NPU setup instructions"
```

- [ ] **Step 4: Verify final structure**

```bash
find /home/melkyfb/githubmelkyfb/claude-LMH -not -path '*/node_modules/*' -not -path '*/.git/*' | sort
```

Expected output should include all files from the File Map at the top of this plan.
