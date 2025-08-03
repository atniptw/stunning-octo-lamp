import chalk from "chalk";
import ora from "ora";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { confirm, select, input, editor } from "@inquirer/prompts";
import { GitHubService } from "../services/github.js";
import { LocalGitHubService } from "../services/local-github.js";
import { AnalysisService } from "../services/analysis.js";
import { StoryGeneratorService } from "../services/story-generator.js";
import type { FeatureData, StoryType } from "../types/story.js";
import type { AnalysisResult } from "../services/analysis.js";

interface CreateStoriesOptions {
  source: string;
}

export async function createStoriesCommand(
  featureId: string,
  options: CreateStoriesOptions,
) {
  const spinner = ora("Fetching feature data...").start();

  try {
    // Fetch feature data
    let featureData: FeatureData;

    if (options.source === "github") {
      const useLocal =
        process.env.GITHUB_TOKEN === "test_token" ||
        process.env.NODE_ENV === "development";

      if (useLocal) {
        const localService = new LocalGitHubService();
        featureData = await localService.fetchFeature(featureId);
      } else {
        const githubService = new GitHubService();
        featureData = await githubService.fetchFeature(featureId);
      }
    } else {
      spinner.fail(`Source '${options.source}' not yet supported`);
      return;
    }

    spinner.text = "Analyzing feature...";

    // Analyze the feature to get suggestions
    const analysisService = new AnalysisService();
    const analysis = await analysisService.analyzeFeature(featureData);

    spinner.succeed("Feature analyzed");

    // Display feature info
    console.log("\n" + chalk.bold("Creating Stories for Feature:"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(
      chalk.blue("Feature:"),
      `#${featureData.id} ${featureData.title}`,
    );
    console.log(chalk.gray("─".repeat(50)));

    // Show suggested stories
    console.log("\n" + chalk.bold("Suggested Stories:"));
    analysis.suggestedStories.forEach((story, i) => {
      const typeColor =
        story.type === "user-story"
          ? chalk.green
          : story.type === "task"
            ? chalk.blue
            : chalk.red;
      console.log(
        `  ${i + 1}. ${typeColor(`[${story.type.toUpperCase()}]`)} ${story.title}`,
      );
    });

    // Ask how to proceed
    const approach = await select({
      message: "How would you like to create stories?",
      choices: [
        {
          name: "Use suggested stories (quick)",
          value: "suggested",
          description: "Create stories from AI suggestions with option to edit",
        },
        {
          name: "Create stories manually",
          value: "manual",
          description: "Define each story yourself",
        },
        {
          name: "Generate with Claude prompts",
          value: "claude",
          description: "Generate detailed prompts for Claude Code",
        },
      ],
    });

    let storiesToCreate: Array<{
      type: StoryType;
      title: string;
      description: string;
    }> = [];

    if (approach === "suggested") {
      // Let user select which suggested stories to create
      console.log("\n" + chalk.bold("Select stories to create:"));

      for (const suggestion of analysis.suggestedStories) {
        const create = await confirm({
          message: `Create: [${suggestion.type.toUpperCase()}] ${suggestion.title}?`,
          default: true,
        });

        if (create) {
          // Option to edit the story
          const edit = await confirm({
            message: "Edit this story before creating?",
            default: false,
          });

          if (edit) {
            const title = await input({
              message: "Story title:",
              default: suggestion.title,
            });

            const description = await editor({
              message: "Story description:",
              default: suggestion.description,
            });

            storiesToCreate.push({
              type: suggestion.type,
              title,
              description,
            });
          } else {
            storiesToCreate.push(suggestion);
          }
        }
      }
    } else if (approach === "manual") {
      // Manual story creation
      let addMore = true;
      while (addMore) {
        const type = (await select({
          message: "Story type:",
          choices: [
            { name: "User Story", value: "user-story" },
            { name: "Technical Task", value: "task" },
            { name: "Bug Fix", value: "bug" },
          ],
        })) as StoryType;

        const title = await input({
          message: "Story title:",
          validate: (value) => (value.trim() ? true : "Title is required"),
        });

        const description = await editor({
          message: "Story description:",
        });

        storiesToCreate.push({ type, title, description });

        addMore = await confirm({
          message: "Add another story?",
          default: false,
        });
      }
    } else if (approach === "claude") {
      // Generate Claude prompts for each suggested story
      console.log("\n" + chalk.bold("Generating Claude Prompts:"));

      const storyGenerator = new StoryGeneratorService();

      for (const suggestion of analysis.suggestedStories) {
        console.log(chalk.gray("\n" + "═".repeat(60)));
        console.log(
          chalk.bold(
            `Prompt for: [${suggestion.type.toUpperCase()}] ${suggestion.title}`,
          ),
        );
        console.log(chalk.gray("═".repeat(60)));

        // Generate a detailed prompt for this specific story
        const prompt = await storyGenerator.generateStoryPrompt(
          featureData,
          analysis,
          suggestion,
        );
        console.log(prompt);

        console.log(chalk.gray("═".repeat(60)));

        // Ask if user wants to create this story with Claude's help
        const useClaudeForThis = await confirm({
          message: "Use Claude Code to generate this story?",
          default: true,
        });

        if (useClaudeForThis) {
          const storyContent = await input({
            message: "Paste Claude's story response here:",
            validate: (value) =>
              value.trim() ? true : "Story content is required",
          });

          // Parse the basic info from Claude's response
          const lines = storyContent.split("\n");
          const title = lines[0].replace(/^#\s*/, "") || suggestion.title;

          storiesToCreate.push({
            type: suggestion.type,
            title,
            description: storyContent,
          });
        }
      }
    }

    if (storiesToCreate.length === 0) {
      console.log(chalk.yellow("\nNo stories selected for creation."));
      return;
    }

    // Create the story files
    console.log("\n" + chalk.bold("Creating Story Files:"));
    const creationSpinner = ora("Creating stories...").start();

    const createdStories: string[] = [];

    for (let i = 0; i < storiesToCreate.length; i++) {
      const story = storiesToCreate[i];

      // Determine directory based on type
      const typeDir =
        story.type === "user-story"
          ? "user-stories"
          : story.type === "task"
            ? "tasks"
            : "bugs";

      const storyDir = join(process.cwd(), "stories", typeDir);

      // Ensure directory exists
      await mkdir(storyDir, { recursive: true });

      // Generate filename
      const storyId = `${featureId}-${i + 1}`;
      const filename = `${storyId}.md`;
      const filepath = join(storyDir, filename);

      // Create story content
      const storyContent = generateStoryContent(story, featureData, storyId);

      // Write file
      await writeFile(filepath, storyContent, "utf-8");

      createdStories.push(`stories/${typeDir}/${filename}`);
    }

    creationSpinner.succeed("Stories created successfully");

    // Display created stories
    console.log("\n" + chalk.bold("Created Stories:"));
    console.log(chalk.gray("─".repeat(50)));

    createdStories.forEach((file, i) => {
      const story = storiesToCreate[i];
      const typeColor =
        story.type === "user-story"
          ? chalk.green
          : story.type === "task"
            ? chalk.blue
            : chalk.red;
      console.log(
        `  ${typeColor(`[${story.type.toUpperCase()}]`)} ${story.title}`,
      );
      console.log(`     ${chalk.gray(`File: ${file}`)}`);
    });

    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.blue("\nNext steps:"));
    console.log(chalk.dim("  workflow list-stories - View all stories"));
    console.log(
      chalk.dim(
        "  workflow add-tasks <storyId> - Add task breakdown (Developer workflow)",
      ),
    );
  } catch (error: any) {
    spinner.fail("Story creation failed");
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}

function generateStoryContent(
  story: { type: StoryType; title: string; description: string },
  feature: FeatureData,
  storyId: string,
): string {
  const typeLabel = story.type.toUpperCase().replace("-", " ");

  return `# [${typeLabel}] ${story.title}

**Feature:** #${feature.id} ${feature.title}
**Story ID:** ${storyId}
**Type:** ${story.type}
**Status:** todo

## Description

${story.description}

## Acceptance Criteria

${
  story.type === "user-story"
    ? "- [ ] User can successfully complete the intended action\n- [ ] Error states are handled gracefully\n- [ ] UI is intuitive and accessible"
    : story.type === "task"
      ? "- [ ] Implementation follows project patterns\n- [ ] Code is properly tested\n- [ ] Documentation is updated"
      : "- [ ] Bug is reproducibly fixed\n- [ ] No regressions introduced\n- [ ] Edge cases are covered"
}

## Tasks

> Developer: Break this story down into reviewable tasks using \`workflow add-tasks ${storyId}\`

- [ ] To be defined by developer

## Definition of Done

- [ ] All acceptance criteria met
- [ ] All tasks completed
- [ ] Code reviewed and approved
- [ ] Tests pass
- [ ] No regressions

---
*Created by AI Workflow Tool*
`;
}
