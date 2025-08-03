import type { FeatureData } from "../types/story.js";

export interface AnalysisResult {
  functionality: string[];
  ambiguities: string[];
  questions: string[];
  technicalContext: string[];
  suggestedStories: Array<{
    type: "user-story" | "task" | "bug";
    title: string;
    description: string;
  }>;
}

export class AnalysisService {
  async analyzeRequirement(requirement: {
    id: string;
    title: string;
    description: string;
    url: string;
    labels: string[];
  }): Promise<AnalysisResult> {
    // Convert issue data to feature-like format for analysis
    const featureData: FeatureData = {
      id: requirement.id,
      title: requirement.title,
      description: requirement.description,
      url: requirement.url,
      labels: requirement.labels,
    };

    return this.analyzeFeature(featureData);
  }

  async analyzeFeature(feature: FeatureData): Promise<AnalysisResult> {
    // For MVP, we'll do basic pattern matching
    // Later this will use AI to analyze the requirement

    const text = `${feature.title}\n${feature.description}`.toLowerCase();

    // Extract potential functionality
    const functionality: string[] = [];
    const keywords = [
      "add",
      "create",
      "implement",
      "fix",
      "update",
      "remove",
      "integrate",
    ];

    keywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        const sentences = feature.description.split(/[.!?]+/);
        sentences.forEach((sentence) => {
          if (sentence.toLowerCase().includes(keyword)) {
            functionality.push(sentence.trim());
          }
        });
      }
    });

    // Identify ambiguities
    const ambiguities: string[] = [];
    const vagueTerms = [
      "somehow",
      "maybe",
      "probably",
      "might",
      "could",
      "should work",
      "etc",
    ];

    vagueTerms.forEach((term) => {
      if (text.includes(term)) {
        ambiguities.push(`Vague term "${term}" found - needs clarification`);
      }
    });

    // Check for missing information
    if (!feature.description || feature.description.length < 50) {
      ambiguities.push("Description is too brief - needs more detail");
    }

    if (!text.includes("when") && !text.includes("given")) {
      ambiguities.push("No clear trigger conditions specified");
    }

    if (
      !text.includes("should") &&
      !text.includes("must") &&
      !text.includes("will")
    ) {
      ambiguities.push("No clear expected behavior specified");
    }

    // Generate clarifying questions
    const questions: string[] = [];

    if (
      !text.includes("user") &&
      !text.includes("developer") &&
      !text.includes("admin")
    ) {
      questions.push("Who is the primary user for this feature?");
    }

    if (
      !text.includes("error") &&
      !text.includes("fail") &&
      !text.includes("edge")
    ) {
      questions.push("How should the system handle errors or edge cases?");
    }

    if (functionality.length === 0) {
      questions.push("What specific functionality needs to be implemented?");
    }

    // Suggest technical context to gather
    const technicalContext: string[] = [
      "Existing code patterns in related modules",
      "Current implementation of similar features",
      "Dependencies that might be affected",
      "Test coverage requirements",
    ];

    // Add specific context based on keywords
    if (text.includes("api")) {
      technicalContext.push("API contract and versioning requirements");
    }

    if (text.includes("database") || text.includes("data")) {
      technicalContext.push("Database schema and migration requirements");
    }

    if (text.includes("ui") || text.includes("frontend")) {
      technicalContext.push("UI/UX patterns and component library usage");
    }

    // Generate suggested stories based on the feature content
    const suggestedStories = this.generateStorysuggestions(feature);

    return {
      functionality:
        functionality.length > 0
          ? functionality
          : ["No clear functionality extracted"],
      ambiguities,
      questions,
      technicalContext,
      suggestedStories,
    };
  }

  private generateStorysuggestions(feature: FeatureData): Array<{
    type: "user-story" | "task" | "bug";
    title: string;
    description: string;
  }> {
    const suggestions: Array<{
      type: "user-story" | "task" | "bug";
      title: string;
      description: string;
    }> = [];
    const text = feature.description.toLowerCase();

    // Look for user-facing functionality
    if (
      text.includes("user") ||
      text.includes("toggle") ||
      text.includes("button") ||
      text.includes("interface")
    ) {
      suggestions.push({
        type: "user-story",
        title: `User can ${this.extractUserAction(feature)}`,
        description: `As a user, I want to ${this.extractUserAction(feature)} so that I can achieve the desired outcome.`,
      });
    }

    // Look for technical tasks
    if (
      text.includes("api") ||
      text.includes("database") ||
      text.includes("implement") ||
      text.includes("create")
    ) {
      suggestions.push({
        type: "task",
        title: `Setup technical foundation for ${feature.title}`,
        description: `Create the necessary technical components and infrastructure to support ${feature.title}.`,
      });
    }

    // Always suggest testing tasks
    suggestions.push({
      type: "task",
      title: `Add tests for ${feature.title}`,
      description: `Create comprehensive tests to ensure ${feature.title} works correctly and prevents regressions.`,
    });

    return suggestions;
  }

  private extractUserAction(feature: FeatureData): string {
    const text = feature.description.toLowerCase();

    if (text.includes("toggle")) return "toggle the setting";
    if (text.includes("add")) return "add new items";
    if (text.includes("delete") || text.includes("remove"))
      return "remove items";
    if (text.includes("edit") || text.includes("update")) return "edit items";
    if (text.includes("search")) return "search for items";
    if (text.includes("view") || text.includes("see"))
      return "view the information";

    return "use the feature";
  }
}
