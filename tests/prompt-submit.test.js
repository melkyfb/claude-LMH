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
