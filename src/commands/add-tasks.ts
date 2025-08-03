import chalk from "chalk";
import ora from "ora";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { confirm, input, editor, select } from "@inquirer/prompts";
import { LocalGitHubService } from "../services/local-github.js";
import { StoryGeneratorService } from "../services/story-generator.js";
import type { StoryData, Task } from "../types/story.js";

export async function addTasksCommand(storyId: string) {
  const spinner = ora("Loading story...").start();

  try {
    // Fetch story data
    const localService = new LocalGitHubService();
    const storyData = await localService.fetchStory(storyId);

    spinner.succeed("Story loaded");

    // Display story information
    console.log("\n" + chalk.bold("Story Details:"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.blue("Title:"), storyData.title);
    console.log(chalk.blue("Type:"), storyData.type);
    console.log(
      chalk.blue("Status:"),
      getStatusColor(storyData.status)(storyData.status),
    );
    console.log(chalk.blue("Feature:"), `#${storyData.featureId}`);
    console.log(chalk.gray("─".repeat(50)));

    // Show current tasks if any
    if (storyData.tasks && storyData.tasks.length > 0) {
      console.log("\n" + chalk.bold("Current Tasks:"));
      storyData.tasks.forEach((task, i) => {
        const status = task.completed ? chalk.green("✓") : chalk.gray("○");
        const prInfo = task.prNumber ? chalk.dim(` (#${task.prNumber})`) : "";
        console.log(`  ${status} ${task.description}${prInfo}`);
      });

      const addMore = await confirm({
        message: "Add more tasks to this story?",
        default: true,
      });

      if (!addMore) {
        console.log(chalk.blue("\nCurrent tasks preserved."));
        return;
      }
    }

    // Choose how to add tasks
    const approach = await select({
      message: "How would you like to add tasks?",
      choices: [
        {
          name: "Interactive task entry",
          value: "interactive",
          description: "Add tasks one by one with prompts",
        },
        {
          name: "Bulk text entry",
          value: "bulk",
          description: "Enter multiple tasks in a text editor",
        },
        {
          name: "Generate with Claude prompt",
          value: "claude",
          description: "Get a prompt to use with Claude Code",
        },
      ],
    });

    let newTasks: Omit<Task, "id">[] = [];

    if (approach === "interactive") {
      newTasks = await addTasksInteractively();
    } else if (approach === "bulk") {
      newTasks = await addTasksBulk();
    } else if (approach === "claude") {
      newTasks = await addTasksWithClaude(storyData);
    }

    if (newTasks.length === 0) {
      console.log(chalk.yellow("\nNo tasks added."));
      return;
    }

    // Update the story file with new tasks
    await updateStoryWithTasks(storyData, newTasks);

    console.log(
      chalk.green(`\n✓ Added ${newTasks.length} tasks to story ${storyId}`),
    );
    console.log(chalk.blue("\nNext steps:"));
    console.log(
      chalk.dim(
        `  workflow update-task ${storyId} <taskId> - Mark tasks complete`,
      ),
    );
    console.log(
      chalk.dim("  workflow list-stories - View updated story status"),
    );
  } catch (error: any) {
    spinner.fail("Failed to add tasks");
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}

async function addTasksInteractively(): Promise<Omit<Task, "id">[]> {
  const tasks: Omit<Task, "id">[] = [];

  console.log("\n" + chalk.bold("Add Tasks Interactively:"));
  console.log(
    chalk.dim("Tip: Keep tasks small and reviewable (1-50 lines of code each)"),
  );

  let addMore = true;
  while (addMore) {
    const description = await input({
      message: `Task ${tasks.length + 1} description:`,
      validate: (value) =>
        value.trim() ? true : "Task description is required",
    });

    tasks.push({
      description: description.trim(),
      completed: false,
    });

    addMore = await confirm({
      message: "Add another task?",
      default: true,
    });
  }

  return tasks;
}

async function addTasksBulk(): Promise<Omit<Task, "id">[]> {
  console.log("\n" + chalk.bold("Bulk Task Entry:"));
  console.log(
    chalk.dim('Enter one task per line. Use format: "- [ ] Task description"'),
  );

  const tasksText = await editor({
    message: "Enter tasks (one per line):",
    default: `- [ ] Create component structure
- [ ] Add props interface
- [ ] Implement click handler
- [ ] Add unit tests
- [ ] Update documentation`,
  });

  const tasks: Omit<Task, "id">[] = [];
  const lines = tasksText.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Parse markdown checkbox format
    const match = trimmed.match(/^-?\s*\[([x\s])\]\s*(.+)$/i);
    if (match) {
      const [, checkStatus, description] = match;
      tasks.push({
        description: description.trim(),
        completed: checkStatus.toLowerCase() === "x",
      });
    } else if (trimmed.startsWith("-") || trimmed.match(/^\d+\./)) {
      // Handle simple list items
      const description = trimmed.replace(/^[-\d.]\s*/, "").trim();
      if (description) {
        tasks.push({
          description,
          completed: false,
        });
      }
    }
  }

  return tasks;
}

async function addTasksWithClaude(
  storyData: StoryData,
): Promise<Omit<Task, "id">[]> {
  console.log("\n" + chalk.bold("Generating Claude Prompt:"));

  // Generate task breakdown prompt
  const storyGenerator = new StoryGeneratorService();
  const prompt = await storyGenerator.generateTaskBreakdownPrompt(storyData);

  console.log(chalk.gray("═".repeat(60)));
  console.log(prompt);
  console.log(chalk.gray("═".repeat(60)));

  console.log("\n" + chalk.bold("Instructions:"));
  console.log("1. Copy the prompt above");
  console.log("2. Paste into Claude Code");
  console.log("3. Copy Claude's task breakdown response");
  console.log("4. Paste it below");

  const hasResponse = await confirm({
    message: "Do you have Claude's task breakdown ready?",
    default: false,
  });

  if (!hasResponse) {
    console.log(
      chalk.blue("\nRun this command again when you have the response."),
    );
    return [];
  }

  const claudeResponse = await editor({
    message: "Paste Claude's task breakdown here:",
    validate: (value) =>
      value.trim() ? true : "Please paste the task breakdown",
  });

  // Parse the response to extract tasks
  const tasks: Omit<Task, "id">[] = [];
  const lines = claudeResponse.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Look for checkbox format or list items
    const checkboxMatch = trimmed.match(/^-?\s*\[([x\s])\]\s*(.+)$/i);
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);

    if (checkboxMatch) {
      const [, checkStatus, description] = checkboxMatch;
      tasks.push({
        description: description.trim(),
        completed: checkStatus.toLowerCase() === "x",
      });
    } else if (listMatch) {
      tasks.push({
        description: listMatch[1].trim(),
        completed: false,
      });
    } else if (numberedMatch) {
      tasks.push({
        description: numberedMatch[1].trim(),
        completed: false,
      });
    }
  }

  return tasks;
}

async function updateStoryWithTasks(
  storyData: StoryData,
  newTasks: Omit<Task, "id">[],
): Promise<void> {
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

  // Parse existing content and add tasks
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

      // Add existing tasks
      if (storyData.tasks && storyData.tasks.length > 0) {
        updatedLines.push("");
        storyData.tasks.forEach((task) => {
          const checkbox = task.completed ? "[x]" : "[ ]";
          const prInfo = task.prNumber ? ` (#${task.prNumber})` : "";
          updatedLines.push(`- ${checkbox} ${task.description}${prInfo}`);
        });
      }

      // Add new tasks
      updatedLines.push("");
      newTasks.forEach((task, index) => {
        const taskId = (storyData.tasks?.length || 0) + index + 1;
        const checkbox = task.completed ? "[x]" : "[ ]";
        updatedLines.push(`- ${checkbox} ${task.description}`);
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
