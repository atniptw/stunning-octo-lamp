import { describe, it, expect } from 'vitest';
import { LocalGitHubService } from '../local-github.js';

describe('LocalGitHubService', () => {
  it('should be instantiable', () => {
    const service = new LocalGitHubService();
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(LocalGitHubService);
  });

  it('should have required methods', () => {
    const service = new LocalGitHubService();
    expect(typeof service.fetchStory).toBe('function');
    expect(typeof service.fetchFeature).toBe('function');
    expect(typeof service.fetchIssue).toBe('function');
    expect(typeof service.listFeatures).toBe('function');
    expect(typeof service.listStories).toBe('function');
    expect(typeof service.createPullRequest).toBe('function');
  });
});