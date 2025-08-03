import chalk from "chalk";
import ora from "ora";
import { writeFile } from "fs/promises";
import { confirm, input } from "@inquirer/prompts";
import { GitHubService } from "../services/github.js";
import { LocalGitHubService } from "../services/local-github.js";
import { AnalysisService } from "../services/analysis.js";
import { StoryGeneratorService } from "../services/story-generator.js";
// IssueData type removed - using inline type definitions

interface GenerateStoryOptions {
  source: string;
  output?: string;
}

export async function generateStoryCommand(
  issueId: string,
  options: GenerateStoryOptions,
) {
  const spinner = ora("Fetching issue data...").start();

  try {
    // Fetch issue data (same logic as analyze command)
    let issueData: {
      id: string;
      title: string;
      description: string;
      url: string;
      labels: string[];
    };

    if (options.source === "github") {
      const useLocal =
        process.env.GITHUB_TOKEN === "test_token" ||
        process.env.NODE_ENV === "development";

      if (useLocal) {
        const localService = new LocalGitHubService();
        issueData = await localService.fetchIssue(issueId);
      } else {
        const githubService = new GitHubService();
        issueData = await githubService.fetchIssue(issueId);
      }
    } else {
      spinner.fail(`Source '${options.source}' not yet supported`);
      return;
    }

    spinner.text = "Analyzing requirement...";

    // Analyze the issue
    const analysisService = new AnalysisService();
    const analysis = await analysisService.analyzeRequirement(issueData);

    spinner.text = "Generating Claude prompt...";

    // Generate prompt for Claude Code
    const storyGenerator = new StoryGeneratorService();
    const claudePrompt = await storyGenerator.generateClaudePrompt(
      issueData,
      analysis,
    );

    spinner.succeed("Claude prompt generated");

    // Display the prompt
    console.log("\n" + chalk.bold("Claude Code Prompt:"));
    console.log(chalk.gray("═".repeat(60)));
    console.log(claudePrompt);
    console.log(chalk.gray("═".repeat(60)));

    // Instructions for user
    console.log("\n" + chalk.bold("Next Steps:"));
    console.log(chalk.yellow("1."), "Copy the prompt above");
    console.log(chalk.yellow("2."), "Paste it into Claude Code");
    console.log(chalk.yellow("3."), "Copy Claude's response");
    console.log(chalk.yellow("4."), "Come back here to save the story");
    console.log("");

    // Wait for user to get Claude's response
    const hasResponse = await confirm({
      message: "Do you have Claude's story response ready?",
      default: false,
    });

    if (!hasResponse) {
      console.log(
        chalk.blue(
          "\nNo problem! Run this command again when you have the response.",
        ),
      );
      return;
    }

    // Get the story content from user
    const storyContent = await input({
      message: "Paste Claude's story response here:",
      validate: (value) => {
        if (!value.trim()) return "Please paste the story content";
        if (value.length < 100)
          return "Response seems too short, please paste the complete story";
        return true;
      },
    });

    // Save to file
    let outputFile = options.output;
    if (!outputFile) {
      outputFile = `stories/story-${issueId}.md`;
    }

    const saveFile = await confirm({
      message: `Save story to ${outputFile}?`,
      default: true,
    });

    if (saveFile) {
      // Ensure stories directory exists
      await writeFile(outputFile, storyContent.trim(), "utf-8");
      console.log(chalk.green(`\n✓ Story saved to ${outputFile}`));

      // Suggest next steps
      console.log(chalk.blue("\nNext steps:"));
      console.log(chalk.gray(`  workflow validate-story ${outputFile}`));
      console.log(
        chalk.gray(`  workflow implement ${outputFile} (coming soon)`),
      );
    } else {
      // Just display the story
      console.log("\n" + chalk.bold("Generated Story:"));
      console.log(chalk.gray("─".repeat(50)));
      console.log(storyContent);
      console.log(chalk.gray("─".repeat(50)));
    }
  } catch (error: any) {
    spinner.fail("Story generation failed");
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}
