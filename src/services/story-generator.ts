import type { FeatureData, StoryData } from "../types/story.js";
import type { AnalysisResult } from "./analysis.js";
import { readdir } from "fs/promises";
import { join } from "path";

export class StoryGeneratorService {
  async generateClaudePrompt(
    feature: FeatureData,
    analysis: AnalysisResult,
  ): Promise<string> {
    // Scan codebase for context
    const codebaseContext = await this.scanCodebase();

    const prompt = `# Generate AI-Ready Story Specification

You are helping create an AI-ready story specification that will be used by AI tools to implement features. The story must be extremely specific with clear boundaries to prevent AI tools from going off track.

## Source Feature

**Title**: ${feature.title}
**ID**: ${feature.id}
**Description**:
\`\`\`
${feature.description}
\`\`\`

## Analysis Results

**Extracted Functionality**:
${analysis.functionality.map((f) => `- ${f}`).join("\n")}

**Identified Ambiguities**:
${analysis.ambiguities.length > 0 ? analysis.ambiguities.map((a) => `- ${a}`).join("\n") : "- None identified"}

**Clarifying Questions**:
${analysis.questions.map((q) => `- ${q}`).join("\n")}

## Codebase Context

**Project Structure**:
\`\`\`
${codebaseContext.structure}
\`\`\`

**Existing Patterns**:
${codebaseContext.patterns.map((p) => `- ${p}`).join("\n")}

**Dependencies**:
${codebaseContext.dependencies.map((d) => `- ${d}`).join("\n")}

## Task

Generate a complete AI-ready story specification using this exact template:

\`\`\`markdown
# Story: ${feature.id} - ${feature.title}

## Objective
[One clear sentence describing what needs to be accomplished]

## Context
- **Current State**: [How it works now]
- **Desired State**: [How it should work after]
- **Business Reason**: [Why this change is needed]

## Technical Specification

### Allowed Scope
- Files to modify:
  - \`path/to/file1.ts\` - [Brief description of changes]
  - \`path/to/file2.ts\` - [Brief description of changes]

### Forbidden Scope
- Do NOT modify:
  - \`path/to/protected/\` - [Reason why]
  - Any files in \`node_modules/\`
  - Configuration files

### Implementation Requirements
1. Follow existing pattern in \`reference/file.ts\`
2. Use existing utility functions from \`utils/\`
3. Maintain backward compatibility
4. Add TypeScript types for all new interfaces

### Edge Cases to Handle
- [ ] [Specific edge case 1]
- [ ] [Specific edge case 2]
- [ ] [Specific edge case 3]

## Acceptance Criteria
- [ ] [Testable criterion 1]
- [ ] [Testable criterion 2]
- [ ] [Testable criterion 3]

## Test Cases
1. **Given** [initial condition], **when** [action], **then** [expected result]
2. **Given** [initial condition], **when** [action], **then** [expected result]
3. **Given** [initial condition], **when** [action], **then** [expected result]

## Validation Commands
\`\`\`bash
npm run test
npm run type-check
npm run lint
\`\`\`

## Definition of Done
- [ ] All acceptance criteria met
- [ ] All tests pass
- [ ] Code follows project patterns
- [ ] TypeScript compiles without errors
- [ ] No console errors or warnings
\`\`\`

## Instructions

1. **Be extremely specific** about file paths and changes
2. **Use actual file paths** from the codebase context above
3. **Include specific patterns** to follow from existing code
4. **Make edge cases concrete** - no vague descriptions
5. **Ensure test cases are specific** with clear given/when/then
6. **Forbidden scope should prevent common AI mistakes** like modifying unrelated files

Generate the complete story specification now:`;

    return prompt;
  }

  async generateStoryPrompt(
    feature: FeatureData,
    analysis: AnalysisResult,
    storyType: {
      type: "user-story" | "task" | "bug";
      title: string;
      description: string;
    },
  ): Promise<string> {
    const codebaseContext = await this.scanCodebase();

    const prompt = `# Generate Specific ${storyType.type.toUpperCase().replace("-", " ")} Story

You are creating a detailed story specification for a specific part of a larger feature.

## Feature Context

**Feature:** ${feature.title}
**Feature ID:** ${feature.id}

**Feature Description:**
\`\`\`
${feature.description}
\`\`\`

## Story to Create

**Type:** ${storyType.type}
**Title:** ${storyType.title}
**Initial Description:** ${storyType.description}

## Codebase Context

**Project Structure:**
\`\`\`
${codebaseContext.structure}
\`\`\`

**Existing Patterns:**
${codebaseContext.patterns.map((p) => `- ${p}`).join("\n")}

## Task

Create a detailed story specification using this template:

\`\`\`markdown
# [${storyType.type.toUpperCase().replace("-", " ")}] ${storyType.title}

**Feature:** #${feature.id} ${feature.title}
**Type:** ${storyType.type}

## Description

${
  storyType.type === "user-story"
    ? "As a [user type], I want to [action] so that [benefit].\n\n[Detailed explanation of the user need and expected behavior]"
    : storyType.type === "task"
      ? "[Clear description of the technical work to be done]\n\n[Why this work is needed and how it supports the feature]"
      : "[Description of the bug and its impact]\n\n[Expected behavior vs actual behavior]"
}

## Acceptance Criteria

${
  storyType.type === "user-story"
    ? "- [ ] [Specific user action works as expected]\n- [ ] [Error handling for edge cases]\n- [ ] [UI/UX requirements met]"
    : storyType.type === "task"
      ? "- [ ] [Technical implementation complete]\n- [ ] [Tests added/updated]\n- [ ] [Documentation updated]"
      : "- [ ] [Bug is fixed]\n- [ ] [No regressions]\n- [ ] [Root cause addressed]"
}

## Technical Specification

### Files to Modify
- \`specific/file/path.ts\` - [What changes]
- \`another/file.ts\` - [What changes]

### Files NOT to Touch
- \`protected/area/\` - [Why it's protected]
- Configuration files

### Implementation Notes
1. [Specific guidance for developers]
2. [Patterns to follow from existing code]
3. [Edge cases to consider]

## Test Cases

1. **Given** [initial state], **when** [action], **then** [expected result]
2. **Given** [edge case], **when** [action], **then** [expected behavior]

## Definition of Done

- [ ] [Specific to this story]
- [ ] All tests pass
- [ ] Code follows project patterns
- [ ] No console errors
\`\`\`

## Instructions

1. **Be specific about file paths** - use actual paths from the codebase structure
2. **Include concrete test cases** - not generic placeholders
3. **Reference existing patterns** - point to specific files to follow
4. **Make acceptance criteria testable** - each should be verifiable
5. **Keep scope small** - this should be implementable in a few small PRs

Generate the complete story specification now:`;

    return prompt;
  }

  async generateTaskBreakdownPrompt(story: StoryData): Promise<string> {
    const codebaseContext = await this.scanCodebase();

    const prompt = `# Break Down Story into Reviewable Tasks

You are helping a developer break down a story into small, reviewable tasks that can be implemented in separate pull requests.

## Story Details

**Title:** ${story.title}
**Type:** ${story.type}
**Feature:** #${story.featureId}

**Description:**
\`\`\`
${story.description}
\`\`\`

## Codebase Context

**Project Structure:**
\`\`\`
${codebaseContext.structure}
\`\`\`

**Existing Patterns:**
${codebaseContext.patterns.map((p) => `- ${p}`).join("\n")}

## Task Breakdown Guidelines

1. **Keep tasks small**: Each task should be 10-50 lines of code
2. **Make reviewable**: Each task should be understandable in isolation
3. **Sequential order**: Tasks should build on each other logically
4. **Test-driven**: Include testing tasks
5. **Documentation**: Include doc updates where needed

## Output Format

Provide a list of tasks in this format:

\`\`\`
- [ ] Task 1: Brief description (rationale: why this is separate)
- [ ] Task 2: Brief description (rationale: why this comes next)
- [ ] Task 3: Brief description (rationale: small, focused change)
\`\`\`

## Example for Reference

For a "Add user profile component" story:
\`\`\`
- [ ] Create UserProfile interface and types (rationale: type safety first)
- [ ] Create basic UserProfile component structure (rationale: minimal UI first)
- [ ] Add profile data fetching logic (rationale: separate data concerns)
- [ ] Implement edit mode functionality (rationale: separate feature)
- [ ] Add unit tests for component (rationale: test core functionality)
- [ ] Add integration tests (rationale: test user interactions)
- [ ] Update documentation (rationale: maintain docs)
\`\`\`

## Task

Break down the story above into 4-8 small, reviewable tasks. Each task should:
- Be implementable in 1-3 hours
- Result in a focused, reviewable PR
- Build logically toward the story completion
- Include specific file paths when possible

Generate the task breakdown now:`;

    return prompt;
  }

  private async scanCodebase(): Promise<{
    structure: string;
    patterns: string[];
    dependencies: string[];
  }> {
    try {
      // Get basic project structure
      const srcFiles = await this.getDirectoryStructure("src", 2);
      const rootFiles = await this.getDirectoryStructure(".", 1);

      const structure = `${rootFiles}\n${srcFiles}`;

      // Identify patterns from existing code
      const patterns = [
        "CLI commands in src/commands/ with async functions",
        "Services in src/services/ with class-based architecture",
        "Types defined in src/types/ with TypeScript interfaces",
        "Error handling with try-catch and spinner feedback",
        "Use chalk for colored output, ora for spinners",
        "Commander.js for CLI structure",
      ];

      // Get dependencies from package.json
      const dependencies = [
        "commander - CLI framework",
        "chalk - Terminal colors",
        "ora - Loading spinners",
        "@inquirer/prompts - User prompts",
        "TypeScript with strict mode",
      ];

      return { structure, patterns, dependencies };
    } catch (error) {
      return {
        structure: "Unable to scan project structure",
        patterns: ["Follow existing code patterns in src/"],
        dependencies: ["Check package.json for current dependencies"],
      };
    }
  }

  private async getDirectoryStructure(
    dir: string,
    maxDepth: number,
    currentDepth = 0,
  ): Promise<string> {
    if (currentDepth >= maxDepth) return "";

    try {
      const items = await readdir(join(process.cwd(), dir), {
        withFileTypes: true,
      });
      const structure: string[] = [];

      for (const item of items) {
        if (item.name.startsWith(".") || item.name === "node_modules") continue;

        const indent = "  ".repeat(currentDepth);
        if (item.isDirectory()) {
          structure.push(`${indent}${dir}/${item.name}/`);
          if (currentDepth < maxDepth - 1) {
            const subStructure = await this.getDirectoryStructure(
              `${dir}/${item.name}`,
              maxDepth,
              currentDepth + 1,
            );
            if (subStructure) structure.push(subStructure);
          }
        } else {
          structure.push(`${indent}${dir}/${item.name}`);
        }
      }

      return structure.join("\n");
    } catch (error) {
      return `${dir}/ (unable to read)`;
    }
  }
}
