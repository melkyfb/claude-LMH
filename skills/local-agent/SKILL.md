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
Tell user: "Model not installed. Run: `ollama pull llama3.2`"

**Ollama not running (connection refused):**
```
Error: dial tcp: connection refused
```
Tell user: "Ollama is not running. Start it with: `ollama serve`"
Do NOT silently fall back to processing with Claude. Let the user decide.

**Exit code non-zero for any other reason:**
Show the error output and ask user how to proceed.
