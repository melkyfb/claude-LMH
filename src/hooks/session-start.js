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
