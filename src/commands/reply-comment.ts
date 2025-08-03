import chalk from "chalk";
import ora from "ora";
import { GitHubAppService } from "../services/github-app.js";
import { GitHubService } from "../services/github.js";

export async function replyCommentCommand(
  prNumber: string,
  commentId: string,
  commitHash?: string,
) {
  const spinner = ora("Preparing comment reply...").start();

  try {
    const prNum = parseInt(prNumber);
    const commentIdNum = parseInt(commentId);

    if (isNaN(prNum) || isNaN(commentIdNum)) {
      throw new Error("Invalid PR number or comment ID");
    }

    // Get commit hash if not provided
    let hash = commitHash;
    if (!hash) {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);

      try {
        const { stdout } = await execAsync("git rev-parse --short HEAD");
        hash = stdout.trim();
        console.log(chalk.blue("Using latest commit:"), chalk.green(hash));
      } catch {
        throw new Error(
          "Could not get commit hash. Provide one explicitly or ensure git is available.",
        );
      }
    }

    // Determine which service to use
    const useGitHubApp =
      process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    const service = useGitHubApp ? new GitHubAppService() : new GitHubService();

    // Get PR and comment details for context
    spinner.text = "Getting comment context...";
    const [prDetails, comments] = await Promise.all([
      (service as GitHubAppService).getPullRequestDetails(prNum),
      (service as GitHubAppService).getPullRequestComments(prNum),
    ]);

    // Find the specific comment
    const targetComment = comments.find((c) => c.id === commentIdNum);
    if (!targetComment) {
      throw new Error(`Comment #${commentIdNum} not found in PR #${prNum}`);
    }

    // Generate reply message
    spinner.text = "Generating reply...";
    const replyMessage = generateReplyMessage(targetComment, hash, prDetails);

    // Post the reply
    spinner.text = "Posting reply...";
    await addPRComment(service, prNum, replyMessage);

    spinner.succeed("Reply posted successfully!");

    console.log("\n" + chalk.bold("💬 Reply Details:"));
    console.log(chalk.blue("PR:"), `#${prNum} - ${prDetails.title}`);
    console.log(chalk.blue("Original Comment:"), `by ${targetComment.user}`);
    console.log(
      chalk.dim(
        "  " +
          (targetComment.body.length > 100
            ? targetComment.body.substring(0, 100) + "..."
            : targetComment.body),
      ),
    );
    console.log(chalk.blue("Commit Referenced:"), chalk.green(hash));
    console.log(chalk.blue("Reply Posted:"), "Yes ✅");

    console.log("\n" + chalk.bold("🎯 Next Steps:"));
    console.log(
      chalk.yellow("  workflow check-pr"),
      prNum,
      chalk.dim("- Check if status checks pass"),
    );
    console.log(
      chalk.yellow("  workflow fix-pr"),
      prNum,
      chalk.dim("- See remaining action items"),
    );
    console.log(
      chalk.blue("  Web:"),
      prDetails.html_url,
      chalk.dim("- View on GitHub"),
    );
  } catch (error: any) {
    spinner.fail("Failed to reply to comment");
    console.error(chalk.red("\nError:"), error.message);

    if (error.message.includes("not found")) {
      console.log(
        chalk.yellow(
          "\nTip: Use workflow check-pr <prNumber> to see available comment IDs",
        ),
      );
    }

    process.exit(1);
  }
}

function generateReplyMessage(
  comment: any,
  commitHash: string,
  prDetails: any,
): string {
  const commentType = comment.is_review_comment ? "code review" : "general";
  const thanksMessage = `Thanks for the ${commentType} feedback, @${comment.user}!`;

  // Create a professional reply
  let reply = `${thanksMessage}\n\n`;

  if (comment.is_review_comment) {
    reply += `I've addressed this in commit ${commitHash}. `;
    reply += `The changes should resolve the issue you identified.\n\n`;
  } else {
    reply += `I've made the requested changes in commit ${commitHash}.\n\n`;
  }

  // Add commit reference
  const repoUrl = prDetails.html_url.replace(/\/pull\/\d+$/, "");
  reply += `**Commit:** ${repoUrl}/commit/${commitHash}\n\n`;

  reply += `Please let me know if you need any additional changes! 🚀`;

  return reply;
}

async function addPRComment(service: any, prNumber: number, message: string) {
  // Use the GitHub API to add an issue comment (PRs are issues in GitHub API)
  const octokit = (service as any).octokit;
  const owner = (service as any).owner;
  const repo = (service as any).repo;

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body: message,
  });
}
