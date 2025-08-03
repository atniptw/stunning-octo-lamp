import { readdir, readFile } from "fs/promises";
import { join } from "path";
import type { FeatureData, StoryData } from "../types/story.js";

export class LocalGitHubService {
  private featuresDir: string;
  private storiesDir: string;

  constructor() {
    this.featuresDir = join(process.cwd(), "features");
    this.storiesDir = join(process.cwd(), "stories");
  }

  async fetchFeature(featureId: string): Promise<FeatureData> {
    try {
      const files = await readdir(this.featuresDir);

      // Find file that matches the feature ID pattern
      const matchingFile = files.find((file) => {
        if (file.includes(featureId)) return true;
        if (file === `${featureId}.md`) return true;
        if (file === `feature-${featureId}.md`) return true;
        return false;
      });

      if (!matchingFile) {
        const mdFiles = files.filter((f) => f.endsWith(".md"));
        throw new Error(
          `Feature #${featureId} not found. Available features:\n` +
            mdFiles
              .map((f, i) => `  ${i + 1}. ${f.replace(".md", "")}`)
              .join("\n"),
        );
      }

      const filePath = join(this.featuresDir, matchingFile);
      const content = await readFile(filePath, "utf-8");

      // Parse the markdown file
      const lines = content.split("\n");
      const title = lines[0].replace(/^#\s+/, "");

      let descriptionStart = 1;
      while (
        descriptionStart < lines.length &&
        lines[descriptionStart].trim() === ""
      ) {
        descriptionStart++;
      }

      const description = lines.slice(descriptionStart).join("\n");

      // Extract labels from filename or content
      const labels: string[] = ["feature"];
      const labelMatch = content.match(/Labels?:\s*(.+)/i);
      if (labelMatch) {
        labels.push(...labelMatch[1].split(",").map((l) => l.trim()));
      }

      return {
        id: featureId,
        title,
        description: description.trim(),
        url: `local://features/${matchingFile}`,
        labels,
      };
    } catch (error: any) {
      if (error.code === "ENOENT") {
        throw new Error(`Features directory not found at ${this.featuresDir}`);
      }
      throw error;
    }
  }

  async fetchIssue(issueId: string): Promise<any> {
    // Delegate to fetchStory for backward compatibility
    return this.fetchStory(issueId);
  }

  async fetchStory(storyId: string): Promise<StoryData> {
    try {
      // Look for story in all subdirectories
      const storyTypes = ["user-stories", "tasks", "bugs"];
      let storyContent = "";
      let storyFile = "";
      let storyType: "user-story" | "task" | "bug" = "task";

      for (const type of storyTypes) {
        try {
          const typeDir = join(this.storiesDir, type);
          const files = await readdir(typeDir);
          const matchingFile = files.find(
            (file) => file.includes(storyId) || file === `${storyId}.md`,
          );

          if (matchingFile) {
            storyFile = join(typeDir, matchingFile);
            storyContent = await readFile(storyFile, "utf-8");
            storyType = type as "user-story" | "task" | "bug";
            break;
          }
        } catch {
          // Directory might not exist, continue
        }
      }

      if (!storyContent) {
        throw new Error(`Story #${storyId} not found in any story directories`);
      }

      // Parse the story file
      const lines = storyContent.split("\n");
      const title = lines[0].replace(/^#\s+/, "");

      let descriptionStart = 1;
      while (
        descriptionStart < lines.length &&
        lines[descriptionStart].trim() === ""
      ) {
        descriptionStart++;
      }

      const description = lines.slice(descriptionStart).join("\n");

      // Extract tasks from checklist
      const tasks = this.extractTasksFromContent(storyContent);

      // Extract feature ID from content or filename
      const featureIdMatch =
        storyContent.match(/Feature[:#]\s*(\d+)/i) ||
        storyContent.match(/Closes #(\d+)/i);
      const featureId = featureIdMatch ? featureIdMatch[1] : "0";

      return {
        id: storyId,
        title,
        type: storyType,
        description: description.trim(),
        featureId,
        url: `local://stories/${storyFile}`,
        labels: [storyType],
        tasks,
        status: this.calculateStoryStatus(tasks),
      };
    } catch (error: any) {
      throw error;
    }
  }

  private extractTasksFromContent(content: string): Array<{
    id: string;
    description: string;
    completed: boolean;
    prNumber?: number;
  }> {
    const tasks: Array<{
      id: string;
      description: string;
      completed: boolean;
      prNumber?: number;
    }> = [];
    const lines = content.split("\n");

    let taskId = 1;
    for (const line of lines) {
      const taskMatch = line.match(/^[\s]*-?\s*\[([x\s])\]\s*(.+)$/i);
      if (taskMatch) {
        const [, checkStatus, description] = taskMatch;
        const completed = checkStatus.toLowerCase() === "x";

        // Extract PR number if present
        const prMatch = description.match(/\(#(\d+)\)/);
        const prNumber = prMatch ? parseInt(prMatch[1]) : undefined;

        tasks.push({
          id: String(taskId++),
          description: description.replace(/\s*\(#\d+\)/, "").trim(),
          completed,
          prNumber,
        });
      }
    }

    return tasks;
  }

  private calculateStoryStatus(
    tasks: Array<{ completed: boolean }>,
  ): "todo" | "in-progress" | "review" | "done" {
    if (tasks.length === 0) return "todo";

    const completedTasks = tasks.filter((t) => t.completed).length;
    const totalTasks = tasks.length;

    if (completedTasks === 0) return "todo";
    if (completedTasks === totalTasks) return "done";
    return "in-progress";
  }

  async listFeatures(): Promise<
    Array<{ id: string; title: string; file: string }>
  > {
    try {
      const files = await readdir(this.featuresDir);
      const mdFiles = files.filter((f) => f.endsWith(".md"));

      const features = await Promise.all(
        mdFiles.map(async (file, index) => {
          const content = await readFile(join(this.featuresDir, file), "utf-8");
          const title = content.split("\n")[0].replace(/^#\s+/, "");

          let id = String(index + 1);
          const numberMatch = file.match(/(\d+)/);
          if (numberMatch) {
            id = numberMatch[1];
          }

          return { id, title, file };
        }),
      );

      return features;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  async listStories(): Promise<
    Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      file: string;
    }>
  > {
    const stories: Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      file: string;
    }> = [];
    const storyTypes = ["user-stories", "tasks", "bugs"];

    for (const type of storyTypes) {
      try {
        const typeDir = join(this.storiesDir, type);
        const files = await readdir(typeDir);
        const mdFiles = files.filter((f) => f.endsWith(".md"));

        for (const file of mdFiles) {
          const content = await readFile(join(typeDir, file), "utf-8");
          const title = content.split("\n")[0].replace(/^#\s+/, "");

          let id = file.replace(".md", "");
          const numberMatch = file.match(/(\d+)/);
          if (numberMatch) {
            id = numberMatch[1];
          }

          const tasks = this.extractTasksFromContent(content);
          const status = this.calculateStoryStatus(tasks);

          stories.push({
            id,
            title,
            type: type.replace("-", " "),
            status,
            file: `${type}/${file}`,
          });
        }
      } catch {
        // Directory might not exist, continue
      }
    }

    return stories;
  }

  async updateFeatureStatus(featureId: string, status: string) {
    console.log(`[Local] Feature #${featureId} status updated to: ${status}`);
  }

  async updateStoryStatus(storyId: string, status: string) {
    console.log(`[Local] Story #${storyId} status updated to: ${status}`);
  }

  async createPullRequest(
    storyId: string,
    title: string,
    body: string,
  ): Promise<number> {
    // Create a mock PR in the local filesystem
    const pullsDir = join(process.cwd(), ".github", "pulls");
    
    // Ensure directory exists
    const { mkdir } = await import("fs/promises");
    await mkdir(pullsDir, { recursive: true });
    
    // Find the next PR number
    try {
      const files = await readdir(pullsDir);
      const prNumbers = files
        .filter((f) => f.endsWith(".md"))
        .map((f) => parseInt(f.replace(".md", "")))
        .filter((n) => !isNaN(n));
      
      const nextNumber = prNumbers.length > 0 ? Math.max(...prNumbers) + 1 : 1;
      
      // Create PR file
      const prContent = `# Pull Request #${nextNumber}

**Title:** ${title}
**Story:** ${storyId}
**Created:** ${new Date().toISOString()}
**Status:** open

${body}
`;
      
      const { writeFile } = await import("fs/promises");
      await writeFile(join(pullsDir, `${nextNumber}.md`), prContent);
      
      return nextNumber;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        // First PR
        const { writeFile } = await import("fs/promises");
        const prContent = `# Pull Request #1

**Title:** ${title}
**Story:** ${storyId}
**Created:** ${new Date().toISOString()}
**Status:** open

${body}
`;
        await writeFile(join(pullsDir, "1.md"), prContent);
        return 1;
      }
      throw error;
    }
  }
}
