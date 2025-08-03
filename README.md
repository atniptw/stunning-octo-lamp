# AI Workflow Orchestration Tool

[![Quality Checks](https://github.com/atniptw/stunning-octo-lamp/actions/workflows/quality-checks.yml/badge.svg)](https://github.com/atniptw/stunning-octo-lamp/actions/workflows/quality-checks.yml)

A CLI tool that orchestrates AI assistants within structured workflows to automate software development tasks while preventing scope creep and maintaining quality standards.

## Features

- **Tech Lead Workflow**: Transform vague requirements into AI-ready specifications
- **Developer Workflow** (Coming Soon): Execute well-defined tasks using AI within strict boundaries

## Installation

```bash
# Clone the repository
git clone https://github.com/atniptw/stunning-octo-lamp.git
cd stunning-octo-lamp

# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Choose your GitHub authentication method:

   **Option A: Personal Access Token (simplest)**
   ```bash
   GITHUB_TOKEN=your_github_personal_access_token
   GITHUB_REPO=owner/repo
   ```

   **Option B: GitHub App (recommended)**
   - Follow the [GitHub App Setup Guide](docs/GITHUB_APP_SETUP.md)
   - Configure in `.env`:
   ```bash
   GITHUB_APP_ID=123456
   GITHUB_APP_PRIVATE_KEY_PATH=./private-key.pem
   GITHUB_APP_INSTALLATION_ID=12345678
   GITHUB_REPO=owner/repo
   ```

   **Option C: GitHub MCP Server (experimental)**
   ```bash
   USE_GITHUB_MCP=true
   GITHUB_TOKEN=your_token  # Still needed for MCP
   GITHUB_REPO=owner/repo
   ```

## Usage

### Analyze a GitHub Issue

```bash
# Using tsx for development
npm run dev -- analyze 123

# Using built version
npm start -- analyze 123
```

### Generate an AI-Ready Story (Coming Soon)

```bash
npm run dev -- generate-story 123
```

### Validate a Story (Coming Soon)

```bash
npm run dev -- validate-story story.md
```

### Create a Pull Request

```bash
# Create a PR for a completed story
npm run dev -- create-pr <storyId>

# Example: Create PR for story 4-1
npm run dev -- create-pr 4-1
```

**Requirements:**
- Must be on a feature branch (not main)
- Must have commits to push
- For real GitHub PRs: Set GITHUB_TOKEN and GITHUB_REPO in .env
- For mock mode: Leave GITHUB_TOKEN as 'test_token' or unset

### Manage Pull Requests

```bash
# Check PR status, reviews, and comments
npm run dev -- check-pr <prNumber>

# Add a comment to a PR
npm run dev -- comment-pr <prNumber> "<message>"

# Examples
npm run dev -- check-pr 1
npm run dev -- comment-pr 1 "Thanks for the review!"
```

**PR Status Information:**
- ✅ Merge status and conflicts
- 🔍 Status check results (build, tests, linting)
- 👥 Review approvals and change requests  
- 💬 Recent comments and discussions
- 🎯 Clear next-step recommendations

### Developer PR Cycle

```bash
# 1. Get prioritized list of issues to fix
npm run dev -- fix-pr <prNumber>

# 2. Fix issues one by one, commit and push
# Make your changes locally, then:
npm run dev -- push-changes "Fix: description of what was fixed"

# 3. Reply to comments with commit hash
npm run dev -- reply-comment <prNumber> <commentId> <commitHash>

# 4. Check if fixes worked
npm run dev -- check-pr <prNumber>

# 5. Repeat until all issues resolved
```

**Priority System:**
- 🚨 **CRITICAL**: Failed status checks, merge conflicts (blocks merge)
- ⚠️ **HIGH**: Review change requests (blocks approval)  
- 📝 **MEDIUM**: Code review comments (feedback to address)
- ⏳ **LOW**: Pending checks (wait for completion)

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Code formatting
npm run format
npm run format:check
```

## Quality Checks

This project includes automated quality checks via GitHub Actions that run on every pull request:

- **Build**: TypeScript compilation
- **Tests**: Unit test execution with coverage reporting
- **Coverage**: Validates minimum 80% coverage thresholds
- **Formatting**: Prettier code style validation
- **Linting**: ESLint code quality checks

### Running Quality Checks Locally

```bash
# Run all checks (same as CI)
npm run build
npm test
npm run test:coverage
npm run format:check
npm run lint
node scripts/coverage-check.js

# Fix common issues
npm run format      # Fix formatting
npm run lint:fix    # Fix linting issues
```

### Coverage Requirements

- Statements: 80%
- Branches: 80% 
- Functions: 80%
- Lines: 80%

View detailed coverage: `open coverage/lcov-report/index.html`

## Workflows

### Tech Lead Workflow

Transform vague features into clear, implementable stories:

1. **Analyze Feature** - `workflow analyze-feature <featureId>`
2. **Create Stories** - `workflow create-stories <featureId>`
3. **Review & Refine** - Ensure stories have clear scope and acceptance criteria

### Developer Workflow

Implement stories with clear boundaries and tracking:

1. **View Story** - `workflow show-story <storyId>`
2. **Add Tasks** - `workflow add-tasks <storyId>`
3. **Update Progress** - `workflow update-task <storyId> <taskNumber>`
4. **Create PR** - `workflow create-pr <storyId>`
5. **Fix Issues** - `workflow fix-pr <prNumber>` (prioritized action items)
6. **Address Feedback** - Make changes → `workflow push-changes` → `workflow reply-comment <prNumber> <commentId>`
7. **Monitor Status** - `workflow check-pr <prNumber>`
8. **Repeat** until ready to merge

## Documentation

- [Project Brief](docs/PROJECT_BRIEF.md)
- [Design Specification](docs/DESIGN_SPECIFICATION.md)
- [Workflow Diagrams](docs/WORKFLOW_DIAGRAMS.md)
