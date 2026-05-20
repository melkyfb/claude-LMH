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
