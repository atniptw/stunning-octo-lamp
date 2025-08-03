import { describe, it, expect } from 'vitest';
import { AnalysisService } from '../analysis.js';

describe('AnalysisService', () => {
  it('should analyze a basic feature', async () => {
    const service = new AnalysisService();
    const feature = {
      id: '1',
      title: 'Add user authentication',
      description: 'Implement login and logout functionality',
      url: 'https://example.com/issue/1',
      labels: ['feature'],
    };

    const result = await service.analyzeFeature(feature);

    expect(result).toBeDefined();
    expect(result.functionality).toBeInstanceOf(Array);
    expect(result.ambiguities).toBeInstanceOf(Array);
    expect(result.questions).toBeInstanceOf(Array);
    expect(result.technicalContext).toBeInstanceOf(Array);
    expect(result.suggestedStories).toBeInstanceOf(Array);
  });

  it('should analyze a requirement via analyzeRequirement method', async () => {
    const service = new AnalysisService();
    const requirement = {
      id: '2',
      title: 'Fix bug in payment processing',
      description: 'Payment fails when amount is greater than $1000',
      url: 'https://example.com/issue/2',
      labels: ['bug'],
    };

    const result = await service.analyzeRequirement(requirement);

    expect(result).toBeDefined();
    expect(result.functionality).toBeInstanceOf(Array);
  });
});