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
