import chalk from "chalk";
import ora from "ora";
import { GitHubMCPService } from "../services/github-mcp.js";
import { exec } from "child_process";
import { promisify } from "util";
import { readFile } from "fs/promises";

const execAsync = promisify(exec);

export async function gitPushMCPCommand() {
  const spinner = ora("Preparing to push via GitHub MCP...").start();
  let mcpService: GitHubMCPService | null = null;

  try {
    // Get current branch
    const { stdout: currentBranch } = await execAsync(
      "git rev-parse --abbrev-ref HEAD",
    );
    const branch = currentBranch.trim();

    spinner.text = "Analyzing local changes...";

    // Get list of changed files
    const { stdout: diffFiles } = await execAsync(
      "git diff --name-only HEAD~1..HEAD",
    );
    const changedFiles = diffFiles
      .trim()
      .split("\n")
      .filter((f) => f);

    if (changedFiles.length === 0) {
      spinner.fail("No changes to push");
      process.exit(1);
    }

    console.log(chalk.blue("\nFiles to push:"));
    changedFiles.forEach((file) => console.log(chalk.dim(`  - ${file}`)));

    // Get last commit message
    const { stdout: lastCommitMessage } = await execAsync(
      "git log -1 --pretty=%B",
    );
    const commitMessage = lastCommitMessage.trim();

    console.log(chalk.blue("\nCommit message:"));
    console.log(chalk.dim(`  ${commitMessage}`));

    // Read file contents
    spinner.text = "Reading file contents...";
    const files = await Promise.all(
      changedFiles.map(async (filePath) => {
        try {
          const content = await readFile(filePath, "utf-8");
          return {
            path: filePath,
            content: Buffer.from(content).toString("base64"),
          };
        } catch {
          // File might be deleted
          return null;
        }
      }),
    );

    const validFiles = files.filter((f) => f !== null);

    // Connect to MCP
    spinner.text = "Connecting to GitHub MCP...";
    mcpService = new GitHubMCPService();
    await mcpService.connect();

    const repo = process.env.GITHUB_REPO;
    if (!repo) {
      throw new Error("GITHUB_REPO not configured");
    }

    const [owner, repoName] = repo.split("/");

    // Push files via MCP
    spinner.text = `Pushing ${validFiles.length} files to ${branch}...`;

    const client = (mcpService as any).client;
    const result = await client.callTool({
      name: "push_files",
      arguments: {
        owner,
        repo: repoName,
        branch,
        files: validFiles,
        message: commitMessage,
      },
    });

    if (result.error) {
      throw new Error(`MCP push failed: ${result.error.message}`);
    }

    spinner.succeed(
      `Successfully pushed ${validFiles.length} files to ${branch}`,
    );

    // Parse result
    const content = result.content[0];
    if (content.type === "text") {
      const data = JSON.parse(content.text);
      console.log(chalk.green("\nCommit created:"));
      console.log(chalk.blue("SHA:"), data.commit.sha);
      console.log(chalk.blue("URL:"), data.commit.html_url);
    }
  } catch (error: any) {
    spinner.fail("Failed to push via MCP");
    console.error(chalk.red("\nError:"), error.message);

    if (error.message.includes("404")) {
      console.log(
        chalk.yellow("\nBranch may not exist on remote. Create it first with:"),
      );
      console.log(
        chalk.dim("  git push -u origin $(git branch --show-current)"),
      );
    }

    process.exit(1);
  } finally {
    if (mcpService) {
      await mcpService.disconnect();
    }
  }
}
