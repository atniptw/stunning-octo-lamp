# GitHub MCP Server Workflow

The GitHub MCP (Model Context Protocol) server provides a clean interface to GitHub's API, but it works alongside git, not as a replacement.

## Understanding MCP vs Git

**Git handles:**
- Local commits
- Pushing branches to remote
- Managing local repository state

**MCP handles:**
- Creating pull requests
- Managing issues
- Reading/writing files directly on GitHub
- Searching repositories
- Managing PR reviews

## Workflow for Creating PRs with MCP

### 1. Make your changes locally
```bash
# Create a feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "Add my feature"
```

### 2. Push to GitHub (required)
```bash
# Push your branch to GitHub
git push -u origin feature/my-feature
```

### 3. Create PR via MCP
```bash
# Use the MCP-specific command
npm run dev -- create-pr-mcp <storyId>

# Or use the regular command with USE_GITHUB_MCP=true
npm run dev -- create-pr <storyId>
```

## Why can't MCP replace git push?

The MCP server's `push_files` tool creates new commits directly on GitHub, which:
- Bypasses your local git history
- Doesn't preserve commit signatures
- Can't handle complex git operations (merges, rebases)
- Doesn't update your local repository state

## MCP Best Practices

1. **Use MCP for GitHub API operations**
   - Creating/updating PRs
   - Managing issues
   - Adding comments
   - Checking PR status

2. **Use git for version control**
   - Making commits
   - Pushing branches
   - Managing history
   - Rebasing/merging

3. **Combine both for efficiency**
   ```bash
   # Git for version control
   git add . && git commit -m "Fix bug"
   git push
   
   # MCP for GitHub operations
   workflow create-pr-mcp bug-123
   ```

## Available MCP Commands

- `workflow create-pr-mcp <storyId>` - Create PR via MCP (requires pushed branch)
- `workflow list-mcp-tools` - See all available MCP operations

## Advantages of MCP

1. **Cleaner API abstraction** - No need to manage Octokit directly
2. **Consistent interface** - Same protocol for different services
3. **Better error handling** - Structured error responses
4. **Tool discovery** - Can list available operations

## Configuration

Set in your `.env`:
```bash
USE_GITHUB_MCP=true
GITHUB_REPO=owner/repo
```

Note: You still need either GITHUB_TOKEN or GitHub App credentials for the MCP server to authenticate with GitHub.