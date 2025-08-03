import chalk from "chalk";
import ora from "ora";
import { GitHubAppService } from "../services/github-app.js";
import { GitHubService } from "../services/github.js";

interface GitHubServiceWithOctokit {
  octokit: {
    issues: {
      createComment: (params: {
        owner: string;
        repo: string;
        issue_number: number;
        body: string;
      }) => Promise<Record<string, unknown>>;
    };
  };
  owner: string;
  repo: string;
}

export async function commentPRCommand(prNumber: string, message: string) {
  const spinner = ora("Adding comment to pull request...").start();

  try {
    const prNum = parseInt(prNumber);
    if (isNaN(prNum)) {
      throw new Error("Invalid PR number");
    }

    if (!message || message.trim().length === 0) {
      throw new Error("Comment message cannot be empty");
    }

    // Determine which service to use
    const useGitHubApp =
      process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY_PATH;

    if (useGitHubApp) {
      const service = new GitHubAppService();
      await service.updateIssueStatus(prNumber, "in-progress"); // This adds a comment

      // Add the actual comment
      await addPRComment(
        service as unknown as GitHubServiceWithOctokit,
        prNum,
        message,
      );
    } else {
      const service = new GitHubService();
      await addPRComment(
        service as unknown as GitHubServiceWithOctokit,
        prNum,
        message,
      );
    }

    spinner.succeed("Comment added successfully");
    console.log("\n" + chalk.bold("Comment Details:"));
    console.log(chalk.blue("PR:"), `#${prNum}`);
    console.log(chalk.blue("Message:"), message);
    console.log("\n" + chalk.dim("View on GitHub to see the comment"));
  } catch (error: unknown) {
    spinner.fail("Failed to add comment");
    console.error(
      chalk.red("\nError:"),
      error instanceof Error ? error.message : String(error),
    );

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Not Found")) {
      console.log(
        chalk.yellow(
          "\nPR not found. Check the PR number and repository access.",
        ),
      );
    }

    process.exit(1);
  }
}

async function addPRComment(
  service: GitHubServiceWithOctokit,
  prNumber: number,
  message: string,
) {
  // Use the GitHub API to add an issue comment (PRs are issues in GitHub API)
  const octokit = service.octokit;
  const owner = service.owner;
  const repo = service.repo;

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: message,
  });
}
