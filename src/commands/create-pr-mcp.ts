import chalk from "chalk";
import ora from "ora";
import { LocalGitHubService } from "../services/local-github.js";
import { GitHubMCPService } from "../services/github-mcp.js";
import type { StoryData } from "../types/story.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function createPRMCPCommand(storyId: string) {
  const spinner = ora("Preparing to create PR via GitHub MCP...").start();
  let mcpService: GitHubMCPService | null = null;

  try {
    // Load story data
    const localService = new LocalGitHubService();
    const storyData = await localService.fetchStory(storyId);

    spinner.text = "Checking git status...";

    // Get current branch
    const { stdout: currentBranch } = await execAsync(
      "git rev-parse --abbrev-ref HEAD",
    );
    const branch = currentBranch.trim();

    if (branch === "main" || branch === "master") {
      spinner.fail("Cannot create PR from main branch");
      console.log(chalk.red("\nPlease create a feature branch first:"));
      console.log(chalk.dim(`  git checkout -b story-${storyId}`));
      process.exit(1);
    }

    // Check for uncommitted changes
    const { stdout: status } = await execAsync("git status --porcelain");
    if (status.trim()) {
      spinner.warn("You have uncommitted changes");
      console.log(chalk.yellow("\nUncommitted files:"));
      console.log(chalk.dim(status));
      console.log(
        chalk.yellow(
          "\nYou should commit these changes before creating a PR\n",
        ),
      );
    }

    // Get all commits on this branch
    spinner.text = "Analyzing branch commits...";
    const { stdout: commits } = await execAsync(
      `git log origin/main..HEAD --oneline`,
    );

    if (!commits.trim()) {
      spinner.fail("No commits to create PR");
      console.log(chalk.red("\nThis branch has no new commits."));
      console.log(
        chalk.yellow(
          "\nTip: The MCP server needs your commits to be on GitHub.",
        ),
      );
      console.log(chalk.dim("1. Make your changes and commit them"));
      console.log(
        chalk.dim("2. Push your branch: git push -u origin " + branch),
      );
      console.log(chalk.dim("3. Then run this command again"));
      process.exit(1);
    }

    console.log(chalk.blue("\nCommits to include in PR:"));
    console.log(chalk.dim(commits));

    // Check if branch exists on remote
    spinner.text = "Checking remote branch...";
    try {
      await execAsync(`git rev-parse --verify origin/${branch}`);
      // Branch exists, check if it's up to date
      await execAsync(
        `git rev-list --count HEAD..origin/${branch}`,
      );
      const { stdout: ahead } = await execAsync(
        `git rev-list --count origin/${branch}..HEAD`,
      );

      if (parseInt(ahead.trim()) > 0) {
        console.log(
          chalk.yellow(
            `\nLocal branch is ${ahead.trim()} commits ahead of remote.`,
          ),
        );
        console.log(chalk.yellow("Push your changes first: git push"));
        process.exit(1);
      }
    } catch {
      // Branch doesn't exist on remote
      console.log(chalk.yellow("\nBranch not found on remote."));
      console.log(
        chalk.yellow("Push your branch first: git push -u origin " + branch),
      );
      process.exit(1);
    }

    // Now create the PR via MCP
    spinner.text = "Creating pull request via GitHub MCP...";

    mcpService = new GitHubMCPService();
    const prTitle = generatePRTitle(storyData);
    const prBody = generatePRBody(storyData);

    const pr = await mcpService.createPullRequest({
      title: prTitle,
      body: prBody,
      head: branch,
      base: process.env.GITHUB_DEFAULT_BASE || "main",
    });

    spinner.succeed("Pull request created successfully via MCP!");
    console.log("\n" + chalk.bold("Pull Request Details:"));
    console.log(chalk.blue("Number:"), `#${pr.number}`);
    console.log(chalk.blue("Title:"), pr.title);
    console.log(chalk.blue("URL:"), chalk.green(pr.html_url));
    console.log(chalk.blue("Method:"), chalk.dim("GitHub MCP Server"));
    console.log(
      "\n" + chalk.dim("Open the URL above to view your pull request"),
    );
  } catch (error: any) {
    spinner.fail("Failed to create pull request");

    if (error.message.includes("Not Found")) {
      console.error(chalk.red("\nError: Branch not found on GitHub"));
      console.log(
        chalk.yellow(
          "\nThe GitHub MCP server requires your branch to exist on GitHub.",
        ),
      );
      console.log(chalk.yellow("Please push your branch first:"));
      console.log(
        chalk.dim("  git push -u origin $(git branch --show-current)"),
      );
      console.log(
        chalk.dim("\nNote: MCP works with GitHub's API, not git directly."),
      );
      console.log(chalk.dim("See docs/MCP_WORKFLOW.md for details."));
    } else {
      console.error(chalk.red("\nError:"), error.message);
      console.log(
        chalk.dim("\nFor MCP workflow details, see docs/MCP_WORKFLOW.md"),
      );
    }

    process.exit(1);
  } finally {
    if (mcpService) {
      await mcpService.disconnect();
    }
  }
}

function generatePRTitle(story: StoryData): string {
  return `${story.type === "bug" ? "Fix" : "Add"}: ${story.title} (#${story.id})`;
}

function generatePRBody(story: StoryData): string {
  let body = `## 📋 Story: ${story.title}\n\n`;
  body += `**Type:** ${story.type}\n`;
  body += `**Feature:** #${story.featureId}\n`;
  body += `**Story ID:** ${story.id}\n\n`;

  if (story.description) {
    body += `### Description\n\n${story.description}\n\n`;
  }

  if (story.tasks && story.tasks.length > 0) {
    body += `### Tasks Completed\n\n`;
    story.tasks.forEach((task, _index) => {
      const status = task.completed ? "✅" : "⬜";
      body += `${status} ${task.description}`;
      if (task.prNumber) {
        body += ` (#${task.prNumber})`;
      }
      body += "\n";
    });

    const completed = story.tasks.filter((t) => t.completed).length;
    const total = story.tasks.length;
    body += `\n**Progress:** ${completed}/${total} tasks completed\n`;
  }

  body += `\n---\n`;
  body += `*Created by AI Workflow Tool via GitHub MCP Server*`;

  return body;
}
