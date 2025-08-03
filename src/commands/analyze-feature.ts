import chalk from "chalk";
import ora from "ora";
import { confirm } from "@inquirer/prompts";
import { GitHubService } from "../services/github.js";
import { LocalGitHubService } from "../services/local-github.js";
import { AnalysisService } from "../services/analysis.js";
import type { FeatureData } from "../types/story.js";

interface AnalyzeFeatureOptions {
  source: string;
}

export async function analyzeFeatureCommand(
  featureId: string,
  options: AnalyzeFeatureOptions,
) {
  const spinner = ora("Fetching feature data...").start();

  try {
    // Fetch feature data
    let featureData: FeatureData;

    if (options.source === "github") {
      // Check if we should use local files (when GITHUB_TOKEN is test_token)
      const useLocal =
        process.env.GITHUB_TOKEN === "test_token" ||
        process.env.NODE_ENV === "development";

      if (useLocal) {
        const localService = new LocalGitHubService();
        featureData = await localService.fetchFeature(featureId);
      } else {
        const githubService = new GitHubService();
        featureData = await githubService.fetchFeature(featureId);
      }
    } else {
      spinner.fail(`Source '${options.source}' not yet supported`);
      return;
    }

    spinner.succeed("Feature fetched successfully");

    // Display feature information
    console.log("\n" + chalk.bold("Feature Details:"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.blue("Title:"), featureData.title);
    console.log(chalk.blue("ID:"), featureData.id);
    if (featureData.url) {
      console.log(chalk.blue("URL:"), featureData.url);
    }
    console.log(chalk.blue("\nDescription:"));
    console.log(
      featureData.description || chalk.gray("No description provided"),
    );
    console.log(chalk.gray("─".repeat(50)) + "\n");

    // Analyze the feature
    const analysisSpinner = ora("Analyzing feature...").start();
    const analysisService = new AnalysisService();
    const analysis = await analysisService.analyzeFeature(featureData);
    analysisSpinner.succeed("Analysis complete");

    // Display analysis results
    console.log("\n" + chalk.bold("Analysis Results:"));
    console.log(chalk.gray("─".repeat(50)));

    console.log(chalk.yellow("\nExtracted Functionality:"));
    analysis.functionality.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item}`);
    });

    console.log(chalk.yellow("\nIdentified Ambiguities:"));
    if (analysis.ambiguities.length === 0) {
      console.log(chalk.green("  ✓ No ambiguities found"));
    } else {
      analysis.ambiguities.forEach((item, i) => {
        console.log(chalk.red(`  ${i + 1}. ${item}`));
      });
    }

    console.log(chalk.yellow("\nSuggested Clarifying Questions:"));
    analysis.questions.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item}`);
    });

    console.log(chalk.yellow("\nRecommended Technical Context to Gather:"));
    analysis.technicalContext.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item}`);
    });

    console.log(chalk.yellow("\nSuggested Stories:"));
    analysis.suggestedStories.forEach((story, i) => {
      const typeColor =
        story.type === "user-story"
          ? chalk.green
          : story.type === "task"
            ? chalk.blue
            : chalk.red;
      console.log(
        `  ${i + 1}. ${typeColor(`[${story.type.toUpperCase()}]`)} ${story.title}`,
      );
      console.log(`     ${chalk.gray(story.description)}`);
    });

    console.log(chalk.gray("─".repeat(50)) + "\n");

    // Ask if user wants to proceed with story creation
    try {
      const proceed = await confirm({
        message: "Would you like to create stories from this analysis?",
        default: true,
      });

      if (proceed) {
        console.log(
          chalk.green("\nUse the command: ") +
            chalk.bold(`workflow create-stories ${featureId}`),
        );
      }
    } catch {
      // User cancelled prompt, that's fine
      console.log(chalk.gray("\nAnalysis complete."));
    }
  } catch (error: any) {
    spinner.fail("Analysis failed");
    console.error(chalk.red("Error:"), error.message);
    process.exit(1);
  }
}
