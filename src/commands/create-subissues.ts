import chalk from "chalk";
import ora from "ora";
import { select, confirm, input } from "@inquirer/prompts";
import { GitHubAppService } from "../services/github-app.js";
import { GitHubService } from "../services/github.js";
import { LocalGitHubService } from "../services/local-github.js";
import type { StoryData } from "../types/story.js";

interface SubissueCreationResult {
  storyId: string;
  storyTitle: string;
  issueNumber: number;
  issueUrl: string;
  taskSubissues: Array<{
    taskDescription: string;
    issueNumber: number;
    issueUrl: string;
  }>;
}

export async function createSubissuesCommand(parentIssueNumber: string, storyId?: string) {
  const spinner = ora("Setting up subissue creation workflow...").start();

  try {
    const parentIssueNum = parseInt(parentIssueNumber);
    if (isNaN(parentIssueNum)) {
      throw new Error("Invalid parent issue number");
    }

    // Determine which service to use
    const useGitHubApp =
      process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    const githubService = useGitHubApp ? new GitHubAppService() : new GitHubService();
    const localService = new LocalGitHubService();

    spinner.succeed("Subissue creation workflow ready");

    // Start the guided process
    await conductGuidedSubissueCreation(parentIssueNum, githubService, localService, storyId);

  } catch (error: unknown) {
    spinner.fail("Failed to start subissue creation");
    console.error(
      chalk.red("\nError:"),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

async function conductGuidedSubissueCreation(
  parentIssueNumber: number,
  githubService: any,
  localService: LocalGitHubService,
  storyId?: string
) {
  console.log("\n" + chalk.bold.blue("🔗 GITHUB SUBISSUE CREATION WORKFLOW"));
  console.log(chalk.dim("=".repeat(60)));

  // Checkpoint 1: Select Stories to Convert
  console.log("\n" + chalk.bold("📋 Checkpoint 1: Select Stories/Tasks"));

  let storiesToConvert: StoryData[] = [];

  if (storyId) {
    // Convert specific story
    const story = await localService.fetchStory(storyId);
    storiesToConvert = [story];
    console.log(chalk.blue("Selected Story:"), `${story.id} - ${story.title}`);
  } else {
    // Let user select stories
    const allStories = await localService.listStories();
    
    if (allStories.length === 0) {
      console.log(chalk.yellow("No local stories found."));
      console.log(chalk.dim("Create stories first using: workflow create-stories <featureId>"));
      return;
    }

    console.log(chalk.blue(`Found ${allStories.length} local stories.`));
    
    const selectionMode = await select({
      message: "How would you like to select stories?",
      choices: [
        { name: "Select specific stories", value: "select" },
        { name: "Convert all stories for a feature", value: "feature" },
        { name: "Convert all pending stories", value: "all-pending" },
      ],
    });

    if (selectionMode === "select") {
      // TODO: Implement multi-select for specific stories
      console.log(chalk.yellow("Multi-select not implemented yet. Converting first 3 stories as example."));
      storiesToConvert = allStories.slice(0, 3).map(s => ({ 
        id: s.id, 
        title: s.title, 
        type: s.type as any, 
        description: "", 
        featureId: "6", 
        tasks: [], 
        status: "todo" as any 
      }));
    } else if (selectionMode === "feature") {
      const featureId = await input({
        message: "Feature ID to convert:",
        default: "6",
      });
      
      // Filter stories by feature
      const featureStories = allStories.filter(s => s.id.startsWith(featureId + "-"));
      if (featureStories.length === 0) {
        console.log(chalk.yellow(`No stories found for feature #${featureId}`));
        return;
      }
      
      console.log(chalk.blue(`Found ${featureStories.length} stories for feature #${featureId}`));
      // Convert the list format to StoryData format
      for (const story of featureStories) {
        const fullStory = await localService.fetchStory(story.id);
        storiesToConvert.push(fullStory);
      }
    }
  }

  if (storiesToConvert.length === 0) {
    console.log(chalk.yellow("No stories selected for conversion."));
    return;
  }

  // Checkpoint 2: Review Conversion Plan
  console.log("\n" + chalk.bold("📝 Checkpoint 2: Review Conversion Plan"));
  console.log(chalk.blue("Parent Issue:"), `#${parentIssueNumber}`);
  console.log(chalk.blue("Stories to Convert:"), storiesToConvert.length);

  storiesToConvert.forEach((story, index) => {
    console.log(`  ${index + 1}. ${story.title}`);
    if (story.tasks && story.tasks.length > 0) {
      console.log(chalk.dim(`     → Will create ${story.tasks.length} task subissues`));
    }
  });

  const confirmConversion = await confirm({
    message: "Proceed with creating GitHub subissues?",
    default: true,
  });

  if (!confirmConversion) {
    console.log(chalk.yellow("Subissue creation cancelled."));
    return;
  }

  // Checkpoint 3: Configure Subissue Settings
  console.log("\n" + chalk.bold("⚙️ Checkpoint 3: Configure Settings"));

  const createTaskSubissues = await confirm({
    message: "Create individual subissues for each task?",
    default: true,
  });

  const defaultLabels = await input({
    message: "Default labels for subissues (comma-separated):",
    default: "subissue,story",
  });

  const labels = defaultLabels.split(',').map(l => l.trim()).filter(l => l);

  // Checkpoint 4: Create Subissues
  console.log("\n" + chalk.bold("🚀 Checkpoint 4: Creating Subissues"));

  const results: SubissueCreationResult[] = [];

  for (const story of storiesToConvert) {
    const spinner = ora(`Creating subissue for story ${story.id}...`).start();

    try {
      // Create main story subissue
      const storyBody = generateStoryIssueBody(story, parentIssueNumber);
      const storyIssue = await githubService.createIssue({
        title: story.title,
        body: storyBody,
        labels: [...labels, story.type],
      });

      spinner.text = `Created story subissue #${storyIssue.number}, creating task subissues...`;

      const taskSubissues: Array<{
        taskDescription: string;
        issueNumber: number;
        issueUrl: string;
      }> = [];

      // Create task subissues if requested
      if (createTaskSubissues && story.tasks && story.tasks.length > 0) {
        for (const task of story.tasks) {
          const taskBody = generateTaskIssueBody(task, story, parentIssueNumber, storyIssue.number);
          const taskIssue = await githubService.createIssue({
            title: `${story.id}: ${task.description}`,
            body: taskBody,
            labels: [...labels, "task"],
          });

          taskSubissues.push({
            taskDescription: task.description,
            issueNumber: taskIssue.number,
            issueUrl: taskIssue.html_url,
          });
        }
      }

      results.push({
        storyId: story.id,
        storyTitle: story.title,
        issueNumber: storyIssue.number,
        issueUrl: storyIssue.html_url,
        taskSubissues,
      });

      spinner.succeed(`Created subissues for story ${story.id}`);
    } catch (error) {
      spinner.fail(`Failed to create subissues for story ${story.id}`);
      console.error(chalk.red("Error:"), error instanceof Error ? error.message : String(error));
    }
  }

  // Checkpoint 5: Summary and Next Steps
  console.log("\n" + chalk.bold("🎉 Checkpoint 5: Creation Summary"));
  showCreationSummary(parentIssueNumber, results);
}

function generateStoryIssueBody(story: StoryData, parentIssueNumber: number): string {
  let body = `## 📋 Story: ${story.title}\n\n`;
  
  body += `**Type**: ${story.type}\n`;
  body += `**Feature**: #${story.featureId}\n`;
  body += `**Parent Issue**: #${parentIssueNumber}\n\n`;
  
  if (story.description) {
    body += `### Description\n\n${story.description}\n\n`;
  }
  
  if (story.tasks && story.tasks.length > 0) {
    body += `### Tasks (${story.tasks.length})\n\n`;
    story.tasks.forEach((task, index) => {
      const checkbox = task.completed ? "[x]" : "[ ]";
      body += `${checkbox} ${index + 1}. ${task.description}\n`;
    });
    body += '\n';
  }
  
  body += `### Definition of Done\n`;
  body += `- [ ] All tasks completed\n`;
  body += `- [ ] Code reviewed and approved\n`;
  body += `- [ ] Tests pass\n`;
  body += `- [ ] No regressions\n\n`;
  
  body += `---\n`;
  body += `*Created from local story via workflow automation tool*\n`;
  body += `*Original story: ${story.id}*`;
  
  return body;
}

function generateTaskIssueBody(
  task: any, 
  story: StoryData, 
  parentIssueNumber: number, 
  storyIssueNumber: number
): string {
  let body = `## 🔧 Task: ${task.description}\n\n`;
  
  body += `**Story**: #${storyIssueNumber} (${story.title})\n`;
  body += `**Parent Issue**: #${parentIssueNumber}\n`;
  body += `**Story ID**: ${story.id}\n\n`;
  
  body += `### Task Details\n\n`;
  body += `This task is part of the larger story: "${story.title}"\n\n`;
  
  if (task.prNumber) {
    body += `**Related PR**: #${task.prNumber}\n\n`;
  }
  
  body += `### Acceptance Criteria\n`;
  body += `- [ ] Implementation follows project patterns\n`;
  body += `- [ ] Code is properly tested\n`;
  body += `- [ ] Documentation is updated if needed\n\n`;
  
  body += `---\n`;
  body += `*Created from local story task via workflow automation tool*\n`;
  body += `*Original story: ${story.id}, Task: ${task.id || 'N/A'}*`;
  
  return body;
}

function showCreationSummary(parentIssueNumber: number, results: SubissueCreationResult[]) {
  console.log(chalk.dim("=".repeat(60)));
  console.log(chalk.blue("Parent Issue:"), `#${parentIssueNumber}`);
  console.log(chalk.blue("Stories Converted:"), results.length);
  
  let totalSubissues = results.length;
  let totalTaskSubissues = 0;
  
  results.forEach(result => {
    totalTaskSubissues += result.taskSubissues.length;
    totalSubissues += result.taskSubissues.length;
  });
  
  console.log(chalk.blue("Total Subissues Created:"), totalSubissues);
  console.log(chalk.blue("Story Subissues:"), results.length);
  console.log(chalk.blue("Task Subissues:"), totalTaskSubissues);
  
  console.log("\n" + chalk.bold("📋 Created Issues:"));
  results.forEach(result => {
    console.log(`\n  ✅ ${chalk.bold(result.storyTitle)}`);
    console.log(`     Issue: #${result.issueNumber}`);
    console.log(`     URL: ${chalk.dim(result.issueUrl)}`);
    
    if (result.taskSubissues.length > 0) {
      console.log(`     Task Subissues: ${result.taskSubissues.length}`);
      result.taskSubissues.forEach(taskSub => {
        console.log(`       • #${taskSub.issueNumber}: ${taskSub.taskDescription.substring(0, 50)}...`);
      });
    }
  });
  
  console.log("\n" + chalk.bold("🔧 Next Steps:"));
  console.log(chalk.yellow("  • Go to GitHub to review and organize the subissues"));
  console.log(chalk.yellow("  • Assign team members to specific subissues"));
  console.log(chalk.yellow("  • Use the subissues to track development progress"));
  console.log(chalk.yellow("  • Close subissues as tasks are completed"));
  
  console.log(chalk.dim("=".repeat(60)));
}