import { skillMatch, skillOverlapScore, normalise } from './bench-sales.service';

describe('normalise', () => {
  it('lowercases and trims', () => {
    expect(normalise('  React  ')).toBe('react');
    expect(normalise('TypeScript')).toBe('typescript');
  });
});

describe('skillMatch', () => {
  it('matches identical skills', () => {
    expect(skillMatch('react', 'react')).toBe(true);
  });

  it('matches multi-word containment', () => {
    expect(skillMatch('spring boot', 'spring boot microservices')).toBe(true);
    expect(skillMatch('spring boot microservices', 'spring boot')).toBe(true);
  });

  it('prevents short-skill false positives', () => {
    expect(skillMatch('go', 'mongo')).toBe(false);
    expect(skillMatch('java', 'javascript')).toBe(false);
  });

  it('matches short skills with word boundaries', () => {
    expect(skillMatch('go', 'go, python')).toBe(true);
    expect(skillMatch('sql', 'sql server')).toBe(true);
  });

  it('does not match completely different skills', () => {
    expect(skillMatch('python', 'rust')).toBe(false);
  });
});

describe('skillOverlapScore', () => {
  it('returns 0 for empty arrays', () => {
    expect(skillOverlapScore([], ['react'])).toBe(0);
    expect(skillOverlapScore(['react'], [])).toBe(0);
  });

  it('returns 1.0 for perfect match', () => {
    expect(skillOverlapScore(['react', 'typescript'], ['react', 'typescript'])).toBe(1);
  });

  it('returns partial score for partial match', () => {
    const score = skillOverlapScore(['react', 'node'], ['react', 'python', 'docker']);
    expect(score).toBeCloseTo(1 / 3, 5);
  });

  it('handles case-insensitive matching', () => {
    expect(skillOverlapScore(['React', 'Node.js'], ['react', 'node.js'])).toBe(1);
  });
});
