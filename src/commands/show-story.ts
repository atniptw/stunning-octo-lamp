import chalk from "chalk";
import ora from "ora";
import { LocalGitHubService } from "../services/local-github.js";
import type { StoryData } from "../types/story.js";

export async function showStoryCommand(storyId: string) {
  const spinner = ora("Loading story...").start();

  try {
    // Fetch story data
    const localService = new LocalGitHubService();
    const storyData = await localService.fetchStory(storyId);

    spinner.succeed("Story loaded");

    // Display comprehensive story information
    displayStoryDetails(storyData);
  } catch (error: any) {
    spinner.fail("Failed to load story");
    console.error(chalk.red("Error:"), error.message);

    // Suggest available stories
    try {
      const localService = new LocalGitHubService();
      const stories = await localService.listStories();

      if (stories.length > 0) {
        console.log("\n" + chalk.dim("Available stories:"));
        stories.forEach((story) => {
          console.log(chalk.dim(`  ${story.id}: ${story.title}`));
        });
      }
    } catch {
      // Ignore error when listing stories
    }

    process.exit(1);
  }
}

function displayStoryDetails(story: StoryData) {
  // Header
  console.log("\n" + chalk.bold.blue("=".repeat(60)));
  console.log(chalk.bold("STORY DETAILS"));
  console.log(chalk.bold.blue("=".repeat(60)));

  // Basic info
  console.log("\n" + chalk.bold("Basic Information:"));
  console.log(chalk.blue("ID:"), story.id);
  console.log(chalk.blue("Title:"), story.title);
  console.log(
    chalk.blue("Type:"),
    getTypeColor(story.type)(story.type.toUpperCase()),
  );
  console.log(
    chalk.blue("Status:"),
    getStatusColor(story.status)(story.status),
  );
  console.log(chalk.blue("Feature:"), `#${story.featureId}`);

  if (story.url) {
    console.log(chalk.blue("URL:"), story.url);
  }

  // Description
  if (story.description) {
    console.log("\n" + chalk.bold("Description:"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(story.description);
    console.log(chalk.gray("─".repeat(50)));
  }

  // Tasks
  console.log("\n" + chalk.bold("Tasks:"));
  if (!story.tasks || story.tasks.length === 0) {
    console.log(chalk.dim("  No tasks defined yet"));
    console.log(chalk.dim(`  Use: workflow add-tasks ${story.id}`));
  } else {
    const completedCount = story.tasks.filter((t) => t.completed).length;
    const totalCount = story.tasks.length;

    console.log(
      chalk.blue("Progress:"),
      `${completedCount}/${totalCount} completed`,
    );
    console.log("");

    story.tasks.forEach((task, i) => {
      const taskNumber = i + 1;
      const status = task.completed ? chalk.green("✓") : chalk.gray("○");
      const prInfo = task.prNumber ? chalk.dim(` (#${task.prNumber})`) : "";

      console.log(`  ${taskNumber}. ${status} ${task.description}${prInfo}`);
    });
  }

  // Next actions
  console.log("\n" + chalk.bold("Available Actions:"));
  console.log(chalk.dim("─".repeat(50)));

  if (!story.tasks || story.tasks.length === 0) {
    console.log(
      chalk.yellow("  workflow add-tasks"),
      story.id,
      chalk.dim("- Add task breakdown"),
    );
  } else {
    console.log(
      chalk.yellow("  workflow update-task"),
      story.id,
      "<taskId>",
      chalk.dim("- Update task status"),
    );
    console.log(
      chalk.yellow("  workflow add-tasks"),
      story.id,
      chalk.dim("- Add more tasks"),
    );
  }

  console.log(
    chalk.yellow("  workflow list-stories"),
    chalk.dim("- View all stories"),
  );

  // Developer workflow suggestions
  if (story.tasks && story.tasks.length > 0) {
    const nextTask = story.tasks.find((t) => !t.completed);
    if (nextTask) {
      const taskIndex = story.tasks.indexOf(nextTask) + 1;
      console.log("\n" + chalk.bold("Next Task:"));
      console.log(chalk.green(`  ${taskIndex}. ${nextTask.description}`));
      console.log(
        chalk.dim(`  Use: workflow update-task ${story.id} ${taskIndex}`),
      );
    } else {
      console.log("\n" + chalk.green("🎉 All tasks completed!"));
      if (story.status !== "done") {
        console.log(
          chalk.dim(
            "Story will be marked as done when you update the last task.",
          ),
        );
      }
    }
  }

  console.log("\n" + chalk.bold.blue("=".repeat(60)));
}

function getTypeColor(type: string) {
  switch (type) {
    case "user-story":
      return chalk.green;
    case "task":
      return chalk.blue;
    case "bug":
      return chalk.red;
    default:
      return chalk.gray;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "done":
      return chalk.green;
    case "in-progress":
      return chalk.yellow;
    case "review":
      return chalk.cyan;
    default:
      return chalk.gray;
  }
}
