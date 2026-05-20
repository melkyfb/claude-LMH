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
