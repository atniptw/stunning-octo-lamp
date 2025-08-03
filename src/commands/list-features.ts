import chalk from "chalk";
import { LocalGitHubService } from "../services/local-github.js";

export async function listFeaturesCommand() {
  try {
    const localService = new LocalGitHubService();
    const features = await localService.listFeatures();

    if (features.length === 0) {
      console.log(chalk.yellow("No features found in the features/ directory"));
      return;
    }

    console.log(chalk.bold("\nAvailable Features:"));
    console.log(chalk.gray("─".repeat(50)));

    features.forEach((feature) => {
      console.log(chalk.blue(`#${feature.id}`), feature.title);
      console.log(chalk.gray(`   File: ${feature.file}`));
    });

    console.log(chalk.gray("─".repeat(50)));
    console.log(
      chalk.dim(
        `\nUse: ${chalk.bold("workflow analyze-feature <id>")} to analyze a feature`,
      ),
    );
  } catch (error: any) {
    console.error(chalk.red("Error listing features:"), error.message);
  }
}
