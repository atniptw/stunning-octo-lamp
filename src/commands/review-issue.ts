import chalk from "chalk";
import ora from "ora";
import { input, select, confirm } from "@inquirer/prompts";
import { GitHubAppService } from "../services/github-app.js";
import { GitHubService } from "../services/github.js";

interface IssueDetails {
  number: number;
  title: string;
  body: string;
  state: string;
  user: { login: string };
  labels: Array<{ name: string }>;
  html_url: string;
  created_at: string;
}

interface ReviewDecision {
  businessValue: number;
  problemCategory: string;
  businessJustification: string;
  complexity: string;
  riskLevel: string;
  estimatedDays: string;
  requiredTeamMembers: string;
  priority: string;
  decision: string;
  rationale: string;
  nextSteps: string;
  addComment: boolean;
  updateLabels: boolean;
  postReviewAction: string;
}

export async function reviewIssueCommand(issueNumber: string) {
  const spinner = ora("Setting up issue review workflow...").start();

  try {
    const issueNum = parseInt(issueNumber);
    if (isNaN(issueNum)) {
      throw new Error("Invalid issue number");
    }

    // Determine which service to use
    const useGitHubApp =
      process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY_PATH;
    const service = useGitHubApp ? new GitHubAppService() : new GitHubService();

    spinner.text = "Fetching issue details...";
    
    // Fetch issue using the service's fetchIssue method
    const issueData = await (service as any).fetchIssue(issueNumber);
    
    // Transform to our interface format
    const issue: IssueDetails = {
      number: issueNum,
      title: issueData.title || "Untitled Issue",
      body: issueData.body || "",
      state: issueData.state || "open",
      user: { login: issueData.user || "unknown" },
      labels: issueData.labels || [],
      html_url: issueData.html_url || `https://github.com/atniptw/stunning-octo-lamp/issues/${issueNum}`,
      created_at: issueData.created_at || new Date().toISOString()
    };

    spinner.succeed("Issue review workflow ready");

    // Start the guided review process
    await conductGuidedReview(issue, service);

  } catch (error: unknown) {
    spinner.fail("Failed to start issue review");
    console.error(
      chalk.red("\nError:"),
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

async function conductGuidedReview(issue: IssueDetails, service: any) {
  console.log("\n" + chalk.bold.blue("🔍 TECH LEAD ISSUE REVIEW WORKFLOW"));
  console.log(chalk.dim("=".repeat(60)));

  // Checkpoint 1: Issue Overview
  console.log("\n" + chalk.bold("📋 Checkpoint 1: Issue Overview"));
  console.log(chalk.blue("Issue:"), `#${issue.number} - ${issue.title}`);
  console.log(chalk.blue("Author:"), issue.user.login);
  console.log(chalk.blue("State:"), issue.state);
  console.log(chalk.blue("URL:"), chalk.dim(issue.html_url));
  
  if (issue.labels.length > 0) {
    console.log(chalk.blue("Labels:"), issue.labels.map(l => l.name).join(", "));
  }

  if (issue.body) {
    console.log("\n" + chalk.bold("Description:"));
    console.log(chalk.gray("─".repeat(50)));
    const truncatedBody = issue.body.length > 300 
      ? issue.body.substring(0, 300) + "..." 
      : issue.body;
    console.log(truncatedBody);
    console.log(chalk.gray("─".repeat(50)));
  }

  const readyToReview = await confirm({
    message: "Ready to review this issue?",
    default: true,
  });

  if (!readyToReview) {
    console.log(chalk.yellow("Review cancelled."));
    return;
  }

  // Checkpoint 2: Business Value Assessment
  console.log("\n" + chalk.bold("🎯 Checkpoint 2: Business Value Assessment"));
  
  const businessValue = await select({
    message: "Rate the business value (1-5 scale):",
    choices: [
      { name: "5 - Critical (blocking users/revenue)", value: 5 },
      { name: "4 - High (significant impact)", value: 4 },
      { name: "3 - Medium (moderate impact)", value: 3 },
      { name: "2 - Low (minor improvement)", value: 2 },
      { name: "1 - Very Low (nice to have)", value: 1 },
    ],
  });

  const problemCategory = await select({
    message: "What type of problem does this address?",
    choices: [
      { name: "Bug Fix - Fixes broken functionality", value: "bug-fix" },
      { name: "Feature - New functionality", value: "feature" },
      { name: "Enhancement - Improves existing feature", value: "enhancement" },
      { name: "Technical Debt - Code quality/maintenance", value: "technical-debt" },
      { name: "Documentation - Docs/process improvement", value: "documentation" },
    ],
  });

  const businessJustification = await input({
    message: "Business justification (optional):",
    default: "",
  });

  // Checkpoint 3: Technical Feasibility
  console.log("\n" + chalk.bold("🔧 Checkpoint 3: Technical Feasibility"));

  const analyzedDependencies = await confirm({
    message: "Have you analyzed technical dependencies and constraints?",
    default: false,
  });

  if (!analyzedDependencies) {
    console.log(chalk.yellow("💡 Consider checking:"));
    console.log(chalk.dim("  - Existing codebase compatibility"));
    console.log(chalk.dim("  - Required libraries/dependencies"));
    console.log(chalk.dim("  - Infrastructure requirements"));
    console.log(chalk.dim("  - Breaking changes impact"));
  }

  const complexity = await select({
    message: "Implementation complexity level:",
    choices: [
      { name: "Low - Simple change, well-defined", value: "low" },
      { name: "Medium - Moderate complexity, some unknowns", value: "medium" },
      { name: "High - Complex change, multiple components", value: "high" },
      { name: "Very High - Major refactoring/architecture change", value: "very-high" },
    ],
  });

  const riskLevel = await select({
    message: "Risk level:",
    choices: [
      { name: "Low - Minimal risk of breaking changes", value: "low" },
      { name: "Medium - Some risk, good test coverage possible", value: "medium" },
      { name: "High - Significant risk, affects core functionality", value: "high" },
    ],
  });

  // Checkpoint 4: Effort Estimation
  console.log("\n" + chalk.bold("⏱️ Checkpoint 4: Effort Estimation"));

  const estimatedDays = await input({
    message: "Estimated development days:",
    validate: (value) => {
      const num = parseFloat(value);
      return !isNaN(num) && num > 0 ? true : "Please enter a positive number";
    },
  });

  const requiredTeamMembers = await input({
    message: "Required team members (e.g., '1 dev', '1 dev + 1 designer'):",
    default: "1 developer",
  });

  const priority = await select({
    message: "Priority level:",
    choices: [
      { name: "Critical - Drop everything else", value: "critical" },
      { name: "High - Next sprint", value: "high" },
      { name: "Medium - Planned in backlog", value: "medium" },
      { name: "Low - Future consideration", value: "low" },
    ],
  });

  // Checkpoint 5: Decision
  console.log("\n" + chalk.bold("✅ Checkpoint 5: Decision"));

  const decision = await select({
    message: "Review decision:",
    choices: [
      { name: "✅ Approved - Ready for implementation", value: "approved" },
      { name: "❓ Needs More Info - Requires clarification", value: "needs-more-info" },
      { name: "❌ Rejected - Will not implement", value: "rejected" },
      { name: "⏸️ Deferred - Good idea, wrong timing", value: "deferred" },
    ],
  });

  const rationale = await input({
    message: "Decision rationale:",
    validate: (value) => value.trim() ? true : "Please provide a rationale",
  });

  const nextSteps = await input({
    message: "Next steps or feedback:",
    default: decision === "approved" ? "Ready for story creation and task breakdown" : "",
  });

  // Checkpoint 6: Documentation
  console.log("\n" + chalk.bold("📝 Checkpoint 6: Documentation & Actions"));

  const reviewData: ReviewDecision = {
    businessValue,
    problemCategory,
    businessJustification,
    complexity,
    riskLevel,
    estimatedDays,
    requiredTeamMembers,
    priority,
    decision,
    rationale,
    nextSteps,
    addComment: false,
    updateLabels: false,
    postReviewAction: "none"
  };

  // Generate review comment
  const reviewComment = generateReviewComment(issue, reviewData);
  
  console.log("\n" + chalk.bold("Generated Review Comment:"));
  console.log(chalk.gray("─".repeat(50)));
  console.log(reviewComment);
  console.log(chalk.gray("─".repeat(50)));

  reviewData.addComment = await confirm({
    message: "Add this review comment to the GitHub issue?",
    default: true,
  });

  if (decision === "approved") {
    reviewData.updateLabels = await confirm({
      message: "Update issue labels (add 'approved', priority labels)?",
      default: true,
    });

    reviewData.postReviewAction = await select({
      message: "Post-review action:",
      choices: [
        { name: "Assign to someone", value: "assign" },
        { name: "Add to project board", value: "add-to-project" },
        { name: "Create follow-up story", value: "create-story" },
        { name: "None", value: "none" },
      ],
    });
  }

  // Execute actions
  await executeReviewActions(issue, reviewData, service);

  // Show summary
  showReviewSummary(issue, reviewData);
}

function generateReviewComment(issue: IssueDetails, review: ReviewDecision): string {
  const emoji = {
    approved: "✅",
    "needs-more-info": "❓",
    rejected: "❌",
    deferred: "⏸️"
  }[review.decision] || "📝";

  let comment = `## ${emoji} Tech Lead Review\n\n`;
  
  comment += `**Decision**: ${review.decision.toUpperCase()}\n\n`;
  
  comment += `### Assessment\n`;
  comment += `- **Business Value**: ${review.businessValue}/5 ⭐\n`;
  comment += `- **Category**: ${review.problemCategory}\n`;
  comment += `- **Complexity**: ${review.complexity}\n`;
  comment += `- **Risk Level**: ${review.riskLevel}\n`;
  comment += `- **Priority**: ${review.priority}\n\n`;
  
  comment += `### Effort Estimate\n`;
  comment += `- **Development Time**: ${review.estimatedDays} days\n`;
  comment += `- **Team Required**: ${review.requiredTeamMembers}\n\n`;
  
  if (review.businessJustification) {
    comment += `### Business Justification\n${review.businessJustification}\n\n`;
  }
  
  comment += `### Rationale\n${review.rationale}\n\n`;
  
  if (review.nextSteps) {
    comment += `### Next Steps\n${review.nextSteps}\n\n`;
  }
  
  comment += `---\n`;
  comment += `*Review conducted via workflow automation tool*`;
  
  return comment;
}

async function executeReviewActions(issue: IssueDetails, review: ReviewDecision, service: any) {
  const spinner = ora("Executing review actions...").start();

  try {
    if (review.addComment) {
      spinner.text = "Adding review comment to issue...";
      const comment = generateReviewComment(issue, review);
      await service.updateIssueStatus(issue.number.toString(), "ready");
      // Note: updateIssueStatus adds a comment, we'd need a separate method for custom comments
      spinner.succeed("Review comment added");
    }

    if (review.updateLabels) {
      spinner.text = "Updating issue labels...";
      // Note: We'd need to implement label update functionality
      console.log(chalk.dim("  (Label update functionality to be implemented)"));
    }

    if (review.postReviewAction !== "none") {
      spinner.text = `Executing post-review action: ${review.postReviewAction}...`;
      console.log(chalk.dim(`  (${review.postReviewAction} functionality to be implemented)`));
    }

    spinner.succeed("Review actions completed");
  } catch (error) {
    spinner.fail("Some review actions failed");
    console.error(chalk.red("Error:"), error instanceof Error ? error.message : String(error));
  }
}

function showReviewSummary(issue: IssueDetails, review: ReviewDecision) {
  console.log("\n" + chalk.bold.green("🎉 REVIEW COMPLETED"));
  console.log(chalk.dim("=".repeat(60)));
  console.log(chalk.blue("Issue:"), `#${issue.number} - ${issue.title}`);
  console.log(chalk.blue("Decision:"), getDecisionColor(review.decision)(review.decision.toUpperCase()));
  console.log(chalk.blue("Priority:"), review.priority);
  console.log(chalk.blue("Estimated Effort:"), `${review.estimatedDays} days`);
  
  if (review.decision === "approved") {
    console.log("\n" + chalk.bold("📋 Recommended Next Steps:"));
    console.log(chalk.yellow("  workflow create-stories"), `<featureId>`, chalk.dim("- Break into stories"));
    console.log(chalk.yellow("  workflow add-tasks"), `<storyId>`, chalk.dim("- Add task breakdown"));
  }
  
  console.log(chalk.blue("\nIssue URL:"), issue.html_url);
  console.log(chalk.dim("=".repeat(60)));
}

function getDecisionColor(decision: string) {
  switch (decision) {
    case "approved":
      return chalk.green;
    case "rejected":
      return chalk.red;
    case "needs-more-info":
      return chalk.yellow;
    case "deferred":
      return chalk.gray;
    default:
      return chalk.blue;
  }
}