import chalk from "chalk";
import ora from "ora";
import { GitHubAppService } from "../services/github-app.js";
import { GitHubService } from "../services/github.js";
// MCP service not used in this command

export async function checkPRCommand(prNumber: string) {
  const spinner = ora("Fetching pull request details...").start();

  try {
    const prNum = parseInt(prNumber);
    if (isNaN(prNum)) {
      throw new Error("Invalid PR number");
    }

    // Determine which service to use
    const useGitHubApp =
      process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY_PATH;

    let service: GitHubAppService | GitHubService;

    if (useGitHubApp) {
      service = new GitHubAppService();
    } else {
      service = new GitHubService();
    }

    // Get PR details
    spinner.text = "Getting PR information...";
    const prDetails = await (service as GitHubAppService).getPullRequestDetails(
      prNum,
    );

    // Get status information
    spinner.text = "Checking status and reviews...";
    const status = await (service as GitHubAppService).checkPullRequestStatus(
      prNum,
    );

    // Get comments
    spinner.text = "Loading comments...";
    const comments = await (service as GitHubAppService).getPullRequestComments(
      prNum,
    );

    spinner.succeed("Pull request information loaded");

    // Display PR header
    console.log("\n" + chalk.bold.blue("=".repeat(80)));
    console.log(chalk.bold(`PULL REQUEST #${prDetails.number}`));
    console.log(chalk.bold.blue("=".repeat(80)));

    // Basic info
    console.log("\n" + chalk.bold("📋 Basic Information:"));
    console.log(chalk.blue("Title:"), prDetails.title);
    console.log(
      chalk.blue("State:"),
      getStateColor(prDetails.state)(prDetails.state.toUpperCase()),
    );
    console.log(chalk.blue("Author:"), prDetails.user.login);
    console.log(chalk.blue("URL:"), chalk.green(prDetails.html_url));
    console.log(
      chalk.blue("Created:"),
      new Date(prDetails.created_at).toLocaleString(),
    );
    console.log(
      chalk.blue("Updated:"),
      new Date(prDetails.updated_at).toLocaleString(),
    );
    console.log(
      chalk.blue("Branches:"),
      `${prDetails.head.ref} → ${prDetails.base.ref}`,
    );

    // Merge status
    console.log("\n" + chalk.bold("🔀 Merge Status:"));
    console.log(
      chalk.blue("Mergeable:"),
      getMergeableColor(status.mergeable)(
        status.mergeable === null ? "UNKNOWN" : status.mergeable ? "YES" : "NO",
      ),
    );
    console.log(
      chalk.blue("Merge State:"),
      getMergeStateColor(status.mergeable_state)(status.mergeable_state),
    );

    // Status checks
    console.log("\n" + chalk.bold("✅ Status Checks:"));
    if (status.checks.length === 0) {
      console.log(chalk.dim("  No status checks found"));
    } else {
      status.checks.forEach((check) => {
        const statusIcon = getCheckIcon(check.status, check.conclusion);
        const statusColor = getCheckColor(check.status, check.conclusion);

        console.log(`  ${statusIcon} ${chalk.bold(check.name)}`);
        console.log(
          `    Status: ${statusColor(check.status)} ${check.conclusion ? `(${check.conclusion})` : ""}`,
        );
        if (check.details_url) {
          console.log(`    Details: ${chalk.dim(check.details_url)}`);
        }
      });
    }

    // Reviews
    console.log("\n" + chalk.bold("👥 Reviews:"));
    if (status.reviews.length === 0) {
      console.log(chalk.dim("  No reviews yet"));
    } else {
      status.reviews.forEach((review) => {
        const reviewIcon = getReviewIcon(review.state);
        const reviewColor = getReviewColor(review.state);

        console.log(
          `  ${reviewIcon} ${chalk.bold(review.user)} ${reviewColor(review.state)}`,
        );
        if (review.submitted_at) {
          console.log(
            `    ${chalk.dim(new Date(review.submitted_at).toLocaleString())}`,
          );
        }
      });
    }

    // Comments
    console.log("\n" + chalk.bold("💬 Comments:"));
    if (comments.length === 0) {
      console.log(chalk.dim("  No comments yet"));
    } else {
      console.log(chalk.blue(`  Total comments: ${comments.length}`));

      // Show recent comments (last 3)
      const recentComments = comments.slice(-3);
      console.log(chalk.dim("\n  Recent comments:"));

      recentComments.forEach((comment) => {
        const commentType = comment.is_review_comment
          ? "📝 Code"
          : "💬 General";
        const timeAgo = getTimeAgo(comment.created_at);

        console.log(
          `\n  ${commentType} comment by ${chalk.bold(comment.user)} ${chalk.dim(timeAgo)}:`,
        );

        // Truncate long comments
        const body =
          comment.body.length > 200
            ? comment.body.substring(0, 200) + "..."
            : comment.body;

        console.log(chalk.dim("    " + body.replace(/\n/g, "\n    ")));
        console.log(chalk.dim(`    Link: ${comment.html_url}`));
      });

      if (comments.length > 3) {
        console.log(
          chalk.dim(
            `  \n  ... and ${comments.length - 3} more comments (view on GitHub)`,
          ),
        );
      }
    }

    // Summary and actions
    console.log("\n" + chalk.bold("🎯 Summary:"));
    const failedChecks = status.checks.filter(
      (c) => c.conclusion === "failure",
    );
    const pendingChecks = status.checks.filter(
      (c) => c.status === "in_progress" || c.status === "queued",
    );

    if (failedChecks.length > 0) {
      console.log(chalk.red(`  ❌ ${failedChecks.length} failed check(s)`));
      console.log(chalk.yellow("     Fix failing checks before merging"));
    }

    if (pendingChecks.length > 0) {
      console.log(
        chalk.yellow(`  ⏳ ${pendingChecks.length} pending check(s)`),
      );
      console.log(chalk.dim("     Wait for checks to complete"));
    }

    if (failedChecks.length === 0 && pendingChecks.length === 0) {
      if (status.mergeable === true) {
        console.log(chalk.green("  ✅ Ready to merge!"));
      } else {
        console.log(chalk.yellow("  ⚠️  Checks passed but may have conflicts"));
      }
    }

    console.log("\n" + chalk.bold("🔧 Available Actions:"));
    console.log(
      chalk.yellow("  workflow check-pr"),
      prNum,
      chalk.dim("- Refresh status"),
    );
    console.log(
      chalk.yellow("  workflow comment-pr"),
      prNum,
      '"message"',
      chalk.dim("- Add comment"),
    );
    console.log(chalk.blue("  Web:"), prDetails.html_url);

    console.log("\n" + chalk.bold.blue("=".repeat(80)));
  } catch (error: any) {
    spinner.fail("Failed to check pull request");
    console.error(chalk.red("\nError:"), error.message);

    if (error.message.includes("Not Found")) {
      console.log(
        chalk.yellow(
          "\nPR not found. Check the PR number and repository access.",
        ),
      );
    }

    process.exit(1);
  }
}

function getStateColor(state: string) {
  switch (state) {
    case "open":
      return chalk.green;
    case "closed":
      return chalk.red;
    case "merged":
      return chalk.blue;
    default:
      return chalk.gray;
  }
}

function getMergeableColor(mergeable: boolean | null) {
  if (mergeable === null) return chalk.yellow;
  return mergeable ? chalk.green : chalk.red;
}

function getMergeStateColor(state: string) {
  switch (state) {
    case "clean":
      return chalk.green;
    case "dirty":
      return chalk.red;
    case "unstable":
      return chalk.yellow;
    case "blocked":
      return chalk.red;
    default:
      return chalk.yellow;
  }
}

function getCheckIcon(status: string, conclusion: string | null): string {
  if (status === "completed") {
    switch (conclusion) {
      case "success":
        return "✅";
      case "failure":
        return "❌";
      case "cancelled":
        return "🚫";
      case "skipped":
        return "⏭️";
      case "neutral":
        return "➖";
      default:
        return "❓";
    }
  }
  return "⏳"; // in_progress, queued
}

function getCheckColor(status: string, conclusion: string | null) {
  if (status === "completed") {
    switch (conclusion) {
      case "success":
        return chalk.green;
      case "failure":
        return chalk.red;
      case "cancelled":
        return chalk.gray;
      case "skipped":
        return chalk.blue;
      default:
        return chalk.yellow;
    }
  }
  return chalk.yellow;
}

function getReviewIcon(state: string): string {
  switch (state) {
    case "APPROVED":
      return "✅";
    case "CHANGES_REQUESTED":
      return "❌";
    case "COMMENTED":
      return "💬";
    default:
      return "👤";
  }
}

function getReviewColor(state: string) {
  switch (state) {
    case "APPROVED":
      return chalk.green;
    case "CHANGES_REQUESTED":
      return chalk.red;
    case "COMMENTED":
      return chalk.blue;
    default:
      return chalk.gray;
  }
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
