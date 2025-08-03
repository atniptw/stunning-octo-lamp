import chalk from "chalk";
import ora from "ora";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function pushChangesCommand(message?: string) {
  const spinner = ora("Analyzing local changes...").start();

  try {
    // Check for uncommitted changes
    const { stdout: status } = await execAsync("git status --porcelain");

    if (!status.trim()) {
      spinner.info("No changes to commit");
      console.log(chalk.yellow("\nNo uncommitted changes found."));
      console.log(chalk.dim("Make your changes first, then run this command."));
      return;
    }

    spinner.text = "Preparing to commit changes...";

    // Show what will be committed
    console.log("\n" + chalk.bold("📝 Changes to commit:"));
    const lines = status.trim().split("\n");
    lines.forEach((line) => {
      const status = line.substring(0, 2);
      const file = line.substring(3);
      const statusColor = getGitStatusColor(status);
      console.log(`  ${statusColor(status)} ${file}`);
    });

    // Generate or use provided commit message
    let commitMessage = message;
    if (!commitMessage) {
      // Try to generate a smart commit message based on files changed
      commitMessage = await generateCommitMessage(lines);
    }

    console.log("\n" + chalk.bold("💬 Commit message:"));
    console.log(chalk.dim(`  "${commitMessage}"`));

    // Stage all changes
    spinner.text = "Staging changes...";
    await execAsync("git add .");

    // Commit changes
    spinner.text = "Creating commit...";
    await execAsync(`git commit -m "${commitMessage}"`);

    // Extract commit hash
    const commitHash = await getLatestCommitHash();

    // Get current branch
    const { stdout: branch } = await execAsync(
      "git rev-parse --abbrev-ref HEAD",
    );
    const currentBranch = branch.trim();

    // Push changes
    spinner.text = `Pushing to ${currentBranch}...`;
    await execAsync(`git push origin ${currentBranch}`);

    spinner.succeed("Changes committed and pushed successfully!");

    console.log("\n" + chalk.bold("✅ Commit Details:"));
    console.log(chalk.blue("Hash:"), chalk.green(commitHash));
    console.log(chalk.blue("Message:"), commitMessage);
    console.log(chalk.blue("Branch:"), currentBranch);
    console.log(chalk.blue("Files:"), lines.length);

    console.log("\n" + chalk.bold("🔧 Next Steps:"));
    console.log(
      chalk.yellow("  workflow check-pr <prNumber>"),
      chalk.dim("- Check if status checks pass"),
    );
    console.log(
      chalk.yellow("  workflow reply-comment <prNumber> <commentId>"),
      chalk.green(commitHash),
      chalk.dim("- Reply to comment with commit"),
    );
    console.log(
      chalk.dim("\n  💡 Use the commit hash above when replying to comments"),
    );
  } catch (error: any) {
    spinner.fail("Failed to commit and push changes");
    console.error(chalk.red("\nError:"), error.message);

    if (error.message.includes("nothing to commit")) {
      console.log(
        chalk.yellow("\nNo changes to commit. Make your changes first."),
      );
    } else if (error.message.includes("rejected")) {
      console.log(
        chalk.yellow("\nPush rejected. Try pulling latest changes first:"),
      );
      console.log(
        chalk.dim("  git pull origin $(git rev-parse --abbrev-ref HEAD)"),
      );
    }

    process.exit(1);
  }
}

async function generateCommitMessage(statusLines: string[]): Promise<string> {
  // Simple commit message generation based on changed files
  const hasTests = statusLines.some(
    (line) =>
      line.includes("test") ||
      line.includes(".spec.") ||
      line.includes(".test."),
  );
  const hasDocs = statusLines.some(
    (line) => line.includes(".md") || line.includes("doc"),
  );
  const hasConfig = statusLines.some(
    (line) =>
      line.includes(".json") ||
      line.includes(".yml") ||
      line.includes(".yaml") ||
      line.includes(".env"),
  );
  const hasSource = statusLines.some(
    (line) =>
      line.includes(".ts") ||
      line.includes(".js") ||
      line.includes(".tsx") ||
      line.includes(".jsx"),
  );

  if (statusLines.length === 1) {
    const file = statusLines[0].substring(3);
    return `Update ${file}`;
  }

  const components: string[] = [];
  if (hasSource) components.push("code");
  if (hasTests) components.push("tests");
  if (hasDocs) components.push("docs");
  if (hasConfig) components.push("config");

  if (components.length === 0) {
    return `Update ${statusLines.length} files`;
  }

  return `Update ${components.join(", ")} (${statusLines.length} files)`;
}

async function getLatestCommitHash(): Promise<string> {
  const { stdout } = await execAsync("git rev-parse --short HEAD");
  return stdout.trim();
}

function getGitStatusColor(status: string) {
  const first = status[0];

  if (first === "A") return chalk.green; // Added
  if (first === "M") return chalk.yellow; // Modified
  if (first === "D") return chalk.red; // Deleted
  if (first === "R") return chalk.blue; // Renamed
  if (first === "C") return chalk.cyan; // Copied
  if (first === "?") return chalk.gray; // Untracked

  return chalk.white;
}
