import { describe, it, expect } from 'vitest';

describe('Basic functionality', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle string operations', () => {
    const str = 'AI Workflow Tool';
    expect(str.includes('Workflow')).toBe(true);
    expect(str.length).toBeGreaterThan(0);
  });

  it('should handle array operations', () => {
    const arr = ['story', 'task', 'bug'];
    expect(arr).toHaveLength(3);
    expect(arr.includes('story')).toBe(true);
  });
});