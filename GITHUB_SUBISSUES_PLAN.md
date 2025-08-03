# GitHub Subissues Plan for Issue #2

**Parent Issue**: #2 "App Can Read Feature Requests and Auto-Generate Stories/Tasks"

## Proposed Subissue Structure

### Story Subissues (3 main implementation areas)

#### Subissue #3: Developer can list GitHub issues
**Labels**: `subissue`, `story`, `user-story`, `enhancement`
**Body**:
```markdown
## 📋 Story: Developer can list GitHub issues

**Type**: user-story
**Feature**: GitHub Issues Integration  
**Parent Issue**: #2

### Description

As a developer, I want to list GitHub issues from the repository so that I can see what work needs to be done and select issues to work on.

### Acceptance Criteria

- [ ] Can run `workflow list-issues` command
- [ ] Shows issue number, title, state, and labels
- [ ] Supports filtering by labels (e.g., `--label feature`)
- [ ] Supports filtering by assignee (e.g., `--assignee @me`)
- [ ] Supports filtering by state (e.g., `--state open`)
- [ ] Works with both GitHub App and personal token authentication
- [ ] Displays issues in a readable format with colors/formatting
- [ ] Shows total count of issues

### Tasks (12)

- [ ] Add `listIssues()` method to GitHubAppService with filtering parameters
- [ ] Add `listIssues()` method to GitHubService with filtering parameters  
- [ ] Add `listIssues()` method to GitHubMCPService with filtering parameters
- [ ] Create TypeScript interfaces for issue list request/response
- [ ] Implement `list-issues` CLI command with filtering options
- [ ] Add command to CLI router in src/cli.ts
- [ ] Handle pagination for repositories with many issues
- [ ] Add colored output formatting for issue display
- [ ] Implement filtering logic (labels, assignee, state)
- [ ] Add error handling for authentication and network issues
- [ ] Write unit tests for issue listing functionality
- [ ] Update documentation with new command usage

### Definition of Done
- [ ] All tasks completed
- [ ] Code reviewed and approved
- [ ] Tests pass
- [ ] No regressions

---
*Created from local story via workflow automation tool*
```

#### Subissue #4: Developer can pull individual GitHub issues
**Labels**: `subissue`, `story`, `user-story`, `enhancement`
**Body**:
```markdown
## 📋 Story: Developer can pull individual GitHub issues

**Type**: user-story
**Feature**: GitHub Issues Integration
**Parent Issue**: #2

### Description

As a developer, I want to pull a specific GitHub issue and convert it to a local story so that I can work with GitHub issues using the existing workflow tools.

### Acceptance Criteria

- [ ] Can run `workflow pull-issue <issueNumber>` command
- [ ] Fetches issue details from GitHub (title, body, labels, assignee, etc.)
- [ ] Converts GitHub issue to StoryData format
- [ ] Creates local story file in appropriate directory (user-stories, tasks, or bugs)
- [ ] Preserves issue metadata (labels, assignee, milestone)
- [ ] Links back to original GitHub issue URL
- [ ] Handles issue comments and converts to story description
- [ ] Works with both open and closed issues

### Definition of Done
- [ ] All acceptance criteria met
- [ ] All tasks completed
- [ ] Code reviewed and approved
- [ ] Tests pass
- [ ] No regressions

---
*Created from local story via workflow automation tool*
```

#### Subissue #5: Developer can sync all GitHub issues
**Labels**: `subissue`, `story`, `user-story`, `enhancement`
**Body**:
```markdown
## 📋 Story: Developer can sync all GitHub issues

**Type**: user-story
**Feature**: GitHub Issues Integration
**Parent Issue**: #2

### Description

As a developer, I want to sync all GitHub issues to local stories so that I can work with the entire backlog using the workflow tools and keep everything in sync.

### Acceptance Criteria

- [ ] Can run `workflow sync-issues` command
- [ ] Fetches all issues from GitHub repository
- [ ] Creates/updates local story files for each issue
- [ ] Handles incremental sync (only updates changed issues)
- [ ] Preserves local changes and task breakdown
- [ ] Provides sync summary (new, updated, unchanged)
- [ ] Supports dry-run mode to preview changes
- [ ] Can sync specific label categories (e.g., only "feature" issues)

### Definition of Done
- [ ] All acceptance criteria met
- [ ] All tasks completed
- [ ] Code reviewed and approved
- [ ] Tests pass
- [ ] No regressions

---
*Created from local story via workflow automation tool*
```

### Supporting Task Subissues (2 foundational tasks)

#### Subissue #6: Add GitHub issue listing methods to services
**Labels**: `subissue`, `task`, `technical`
**Body**:
```markdown
## 🔧 Task: Add GitHub issue listing methods to services

**Parent Issue**: #2
**Feature**: GitHub Issues Integration

### Task Details

Extend the existing GitHub services (GitHubAppService, GitHubService, GitHubMCPService) to include methods for listing GitHub issues with filtering capabilities.

### Acceptance Criteria

- [ ] Add `listIssues()` method to GitHubAppService
- [ ] Add `listIssues()` method to GitHubService  
- [ ] Add `listIssues()` method to GitHubMCPService
- [ ] Support filtering parameters (labels, assignee, state, milestone)
- [ ] Return consistent issue data format across all services
- [ ] Handle pagination for large issue lists
- [ ] Include proper error handling and rate limiting
- [ ] Add TypeScript interfaces for issue list responses

---
*Created from local story task via workflow automation tool*
```

#### Subissue #7: Create issue-to-story conversion logic
**Labels**: `subissue`, `task`, `technical`
**Body**:
```markdown
## 🔧 Task: Create issue-to-story conversion logic

**Parent Issue**: #2
**Feature**: GitHub Issues Integration

### Task Details

Implement the core logic to convert GitHub issue data to the local StoryData format, preserving metadata and determining appropriate story types.

### Acceptance Criteria

- [ ] Create `IssueConverter` utility class
- [ ] Map GitHub issue fields to StoryData interface
- [ ] Determine story type based on issue labels (user-story, task, bug)
- [ ] Preserve issue metadata (labels, assignee, milestone, created_at)
- [ ] Convert issue body to story description format
- [ ] Generate unique story IDs that don't conflict with existing stories
- [ ] Handle issue comments and integrate into story description
- [ ] Create bidirectional mapping to track GitHub issue relationships

---
*Created from local story task via workflow automation tool*
```

## Command to Create These Subissues

When GitHub API access is available, use:

```bash
# Create all subissues for issue #2
workflow create-subissues 2

# Then select "Convert all stories for a feature" 
# And specify feature: "6" (GitHub Issues Integration)
```

This will create 5 GitHub subissues under parent issue #2, making the GitHub Issues Integration feature fully trackable through GitHub's native issue system.

## Workflow Integration

After creating these subissues:

1. **Developers** work on individual GitHub subissues
2. **Progress tracking** happens in GitHub issues  
3. **Local workflow tools** can reference GitHub issue numbers
4. **PR creation** links back to GitHub issues
5. **Story completion** closes GitHub subissues

The local story files are no longer needed - GitHub becomes the single source of truth.