import chalk from "chalk";
import ora from "ora";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { confirm, input, select } from "@inquirer/prompts";
import { LocalGitHubService } from "../services/local-github.js";
import type { StoryData } from "../types/story.js";

export async function updateTaskCommand(storyId: string, taskId: string) {
  const spinner = ora("Loading story...").start();

  try {
    // Fetch story data
    const localService = new LocalGitHubService();
    const storyData = await localService.fetchStory(storyId);

    spinner.succeed("Story loaded");

    // Display story and tasks
    console.log("\n" + chalk.bold("Story:"), storyData.title);
    console.log(chalk.blue("Type:"), storyData.type);
    console.log(
      chalk.blue("Status:"),
      getStatusColor(storyData.status)(storyData.status),
    );

    if (!storyData.tasks || storyData.tasks.length === 0) {
      console.log(chalk.yellow("\nNo tasks found for this story."));
      console.log(chalk.dim(`Use: workflow add-tasks ${storyId} to add tasks`));
      return;
    }

    // Show current tasks
    console.log("\n" + chalk.bold("Current Tasks:"));
    storyData.tasks.forEach((task, i) => {
      const taskNumber = i + 1;
      const status = task.completed ? chalk.green("✓") : chalk.gray("○");
      const isTarget = taskId === String(taskNumber) || taskId === task.id;
      const prefix = isTarget ? chalk.yellow("→") : " ";
      const prInfo = task.prNumber ? chalk.dim(` (#${task.prNumber})`) : "";

      console.log(
        `${prefix} ${taskNumber}. ${status} ${task.description}${prInfo}`,
      );
    });

    // Find the target task
    const taskIndex = findTaskIndex(storyData.tasks, taskId);
    if (taskIndex === -1) {
      console.log(chalk.red(`\nTask "${taskId}" not found.`));
      console.log(chalk.dim("Use task numbers (1, 2, 3, etc.) or task IDs"));
      return;
    }

    const targetTask = storyData.tasks[taskIndex];
    const taskNumber = taskIndex + 1;

    console.log("\n" + chalk.bold("Target Task:"));
    console.log(
      chalk.blue("Task:"),
      `${taskNumber}. ${targetTask.description}`,
    );
    console.log(
      chalk.blue("Status:"),
      targetTask.completed ? chalk.green("Completed") : chalk.gray("Pending"),
    );

    if (targetTask.prNumber) {
      console.log(chalk.blue("PR:"), `#${targetTask.prNumber}`);
    }

    // Choose action
    const action = await select({
      message: "What would you like to do?",
      choices: [
        {
          name: targetTask.completed
            ? "Mark as incomplete"
            : "Mark as completed",
          value: "toggle",
          description: "Toggle completion status",
        },
        {
          name: "Add/update PR number",
          value: "pr",
          description: "Link this task to a pull request",
        },
        {
          name: "Edit task description",
          value: "edit",
          description: "Update the task description",
        },
        {
          name: "Cancel",
          value: "cancel",
        },
      ],
    });

    if (action === "cancel") {
      console.log(chalk.gray("No changes made."));
      return;
    }

    // Apply the action
    let updated = false;

    if (action === "toggle") {
      targetTask.completed = !targetTask.completed;
      updated = true;

      const newStatus = targetTask.completed ? "completed" : "incomplete";
      console.log(chalk.green(`\n✓ Task marked as ${newStatus}`));
    }

    if (action === "pr" || (action === "toggle" && targetTask.completed)) {
      const currentPR = targetTask.prNumber ? String(targetTask.prNumber) : "";

      const prNumber = await input({
        message: "Pull request number (or empty to remove):",
        default: currentPR,
        validate: (value) => {
          if (!value.trim()) return true; // Allow empty
          const num = parseInt(value);
          return !isNaN(num) && num > 0
            ? true
            : "Please enter a valid PR number";
        },
      });

      if (prNumber.trim()) {
        targetTask.prNumber = parseInt(prNumber);
        console.log(
          chalk.green(`\n✓ Task linked to PR #${targetTask.prNumber}`),
        );
      } else {
        delete targetTask.prNumber;
        console.log(chalk.green("\n✓ PR link removed"));
      }

      updated = true;
    }

    if (action === "edit") {
      const newDescription = await input({
        message: "New task description:",
        default: targetTask.description,
        validate: (value) =>
          value.trim() ? true : "Description cannot be empty",
      });

      targetTask.description = newDescription.trim();
      updated = true;
      console.log(chalk.green("\n✓ Task description updated"));
    }

    if (updated) {
      // Update the story file
      await updateStoryFile(storyData);

      // Calculate new story status
      const completedTasks = storyData.tasks.filter((t) => t.completed).length;
      const totalTasks = storyData.tasks.length;
      const newStoryStatus = calculateStoryStatus(completedTasks, totalTasks);

      console.log("\n" + chalk.bold("Updated Status:"));
      console.log(
        chalk.blue("Task Progress:"),
        `${completedTasks}/${totalTasks} completed`,
      );
      console.log(
        chalk.blue("Story Status:"),
        getStatusColor(newStoryStatus)(newStoryStatus),
      );

      if (newStoryStatus === "done") {
        console.log(chalk.green("🎉 Story completed! All tasks are done."));
      }
    }
  } catch (error: any) {
    spinner.fail("Failed to update task");
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}

function findTaskIndex(tasks: any[], taskId: string): number {
  // Try to find by task number (1-based)
  const taskNumber = parseInt(taskId);
  if (!isNaN(taskNumber) && taskNumber >= 1 && taskNumber <= tasks.length) {
    return taskNumber - 1; // Convert to 0-based index
  }

  // Try to find by task ID
  return tasks.findIndex((task) => task.id === taskId);
}

async function updateStoryFile(storyData: StoryData): Promise<void> {
  // Find the story file
  const storyTypes = ["user-stories", "tasks", "bugs"];
  let storyFile = "";
  let storyContent = "";

  for (const type of storyTypes) {
    try {
      const typeDir = join(process.cwd(), "stories", type);
      const possibleFiles = [`${storyData.id}.md`, `story-${storyData.id}.md`];

      for (const filename of possibleFiles) {
        try {
          const filepath = join(typeDir, filename);
          storyContent = await readFile(filepath, "utf-8");
          storyFile = filepath;
          break;
        } catch {
          // File doesn't exist, continue
        }
      }

      if (storyFile) break;
    } catch {
      // Directory doesn't exist, continue
    }
  }

  if (!storyFile) {
    throw new Error(`Story file for ${storyData.id} not found`);
  }

  // Update the tasks section in the file
  const lines = storyContent.split("\n");
  const updatedLines: string[] = [];
  let inTasksSection = false;
  let tasksInserted = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for the Tasks section
    if (line.match(/^##\s*Tasks/i)) {
      inTasksSection = true;
      updatedLines.push(line);

      // Skip the developer note line if it exists
      if (
        i + 1 < lines.length &&
        lines[i + 1].includes("Break this story down")
      ) {
        updatedLines.push(lines[i + 1]);
        i++; // Skip the next line
      }

      // Add updated tasks
      updatedLines.push("");
      storyData.tasks?.forEach((task, index) => {
        const taskNumber = index + 1;
        const checkbox = task.completed ? "[x]" : "[ ]";
        const prInfo = task.prNumber ? ` (#${task.prNumber})` : "";
        updatedLines.push(`- ${checkbox} ${task.description}${prInfo}`);
      });

      tasksInserted = true;

      // Skip existing task lines
      while (
        i + 1 < lines.length &&
        (lines[i + 1].match(/^-\s*\[/) || lines[i + 1].trim() === "")
      ) {
        i++;
      }
    } else if (inTasksSection && line.match(/^##/)) {
      // Reached next section
      inTasksSection = false;
      updatedLines.push(line);
    } else if (!inTasksSection) {
      updatedLines.push(line);
    }
  }

  // Write updated content
  await writeFile(storyFile, updatedLines.join("\n"), "utf-8");
}

function calculateStoryStatus(completed: number, total: number): string {
  if (total === 0) return "todo";
  if (completed === 0) return "todo";
  if (completed === total) return "done";
  return "in-progress";
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
