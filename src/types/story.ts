export interface FeatureData {
  id: string;
  title: string;
  description: string;
  url?: string;
  labels?: string[];
  assignee?: string;
}

export interface StoryData {
  id: string;
  title: string;
  type: StoryType;
  description: string;
  featureId: string;
  url?: string;
  labels?: string[];
  assignee?: string;
  tasks: Task[];
  status: "todo" | "in-progress" | "review" | "done";
}

export interface Task {
  id: string;
  description: string;
  completed: boolean;
  prNumber?: number;
  assignee?: string;
}

export type StoryType = "user-story" | "task" | "bug";

export interface AIStorySpec {
  id: string;
  title: string;
  type: StoryType;
  sourceFeatureId: string;
  sourceFeatureUrl?: string;
  objective: string;
  context: {
    currentState: string;
    desiredState: string;
    businessReason: string;
  };
  technicalSpec: {
    allowedFiles: string[];
    forbiddenPaths: string[];
    requiredPatterns: string[];
    constraints: string[];
  };
  acceptanceCriteria: AcceptanceCriterion[];
  testCases: TestCase[];
  validationCommands: string[];
  edgeCases: string[];
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AcceptanceCriterion {
  id: string;
  description: string;
  completed: boolean;
}

export interface TestCase {
  id: string;
  given: string;
  when: string;
  then: string;
}
