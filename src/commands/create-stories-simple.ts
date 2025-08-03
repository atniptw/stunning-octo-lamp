import chalk from "chalk";
import ora from "ora";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { confirm } from "@inquirer/prompts";
import { LocalGitHubService } from "../services/local-github.js";
import { AnalysisService } from "../services/analysis.js";
import type { FeatureData, StoryType } from "../types/story.js";

export async function createStoriesSimpleCommand(featureId: string) {
  const spinner = ora("Fetching feature data...").start();

  try {
    // Fetch feature data
    const localService = new LocalGitHubService();
    const featureData = await localService.fetchFeature(featureId);

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

    // Ask for confirmation
    try {
      const proceed = await confirm({
        message: "Create these stories?",
        default: true,
      });

      if (!proceed) {
        console.log(chalk.yellow("\nStory creation cancelled."));
        return;
      }
    } catch (error) {
      console.log(chalk.gray("\nStory creation cancelled."));
      return;
    }

    // Create the story files
    console.log("\n" + chalk.bold("Creating Story Files:"));
    const creationSpinner = ora("Creating stories...").start();

    const createdStories: string[] = [];

    for (let i = 0; i < analysis.suggestedStories.length; i++) {
      const story = analysis.suggestedStories[i];

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
      const story = analysis.suggestedStories[i];
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
      chalk.dim("  workflow add-tasks <storyId> - Add task breakdown"),
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
