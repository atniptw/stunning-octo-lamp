import chalk from "chalk";
import { LocalGitHubService } from "../services/local-github.js";

export async function listStoriesCommand() {
  try {
    const localService = new LocalGitHubService();
    const stories = await localService.listStories();

    if (stories.length === 0) {
      console.log(chalk.yellow("No stories found in the stories/ directory"));
      console.log(
        chalk.dim("Create stories using: workflow create-stories <featureId>"),
      );
      return;
    }

    console.log(chalk.bold("\nAvailable Stories:"));
    console.log(chalk.gray("─".repeat(70)));

    // Group stories by type
    const storyTypes = ["user stories", "tasks", "bugs"];

    storyTypes.forEach((type) => {
      const typeStories = stories.filter((s) => s.type === type);
      if (typeStories.length === 0) return;

      const typeColor =
        type === "user stories"
          ? chalk.green
          : type === "tasks"
            ? chalk.blue
            : chalk.red;

      console.log(typeColor(`\n${type.toUpperCase()}:`));

      typeStories.forEach((story) => {
        const statusColor =
          story.status === "done"
            ? chalk.green
            : story.status === "in-progress"
              ? chalk.yellow
              : story.status === "review"
                ? chalk.cyan
                : chalk.gray;

        console.log(`  ${chalk.blue(`#${story.id}`)} ${story.title}`);
        console.log(
          `     Status: ${statusColor(story.status)} | File: ${chalk.gray(story.file)}`,
        );
      });
    });

    console.log(chalk.gray("\n─".repeat(70)));
    console.log(chalk.dim("Commands:"));
    console.log(
      chalk.dim(
        `  ${chalk.bold("workflow add-tasks <storyId>")} - Add task breakdown to a story`,
      ),
    );
    console.log(
      chalk.dim(
        `  ${chalk.bold("workflow update-task <storyId> <taskId>")} - Mark a task as completed`,
      ),
    );
  } catch (error: any) {
    console.error(chalk.red("Error listing stories:"), error.message);
  }
}
