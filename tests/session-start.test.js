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
