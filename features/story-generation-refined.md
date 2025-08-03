# Implement AI Story Generation Command

## Description

Implement the `workflow generate-story <issueId>` command that transforms analyzed GitHub issues into AI-ready story specifications.

## Context

**Current State**: The Tech Lead workflow has a working `analyze` command that extracts requirements from GitHub issues. The `generate-story` command exists as a placeholder.

**Desired State**: Tech Leads can run `workflow generate-story 123` to automatically generate a complete, AI-ready story specification from issue #123.

**Business Reason**: Manual story creation is time-consuming and often misses critical constraints needed for AI tools to work effectively.

## Functional Requirements

### When a user runs `workflow generate-story 123`, the system should:

1. Fetch issue #123 from GitHub using existing GitHubService
2. Run analysis using existing AnalysisService  
3. Use Claude API to generate an AI-ready story containing:
   - Clear objective statement
   - Current/desired state context
   - Technical specifications with file boundaries
   - Acceptance criteria
   - Test cases
   - Validation commands
4. Display the generated story in the terminal
5. Save to a file if `--output <filename>` option is provided

### The generated story must include:

- **Allowed files**: Specific files the AI can modify
- **Forbidden paths**: Directories/files the AI must not touch
- **Required patterns**: Existing code patterns to follow
- **Edge cases**: Specific scenarios to handle
- **Validation commands**: Commands to verify implementation

## Technical Requirements

- Use the existing `AIStorySpec` interface from `src/types/story.ts`
- Integrate with Anthropic's Claude API for story generation
- Implement codebase scanning to determine file boundaries
- Support markdown output format
- Handle API errors gracefully with retry logic

## Error Handling

- If GitHub issue not found: Display error with correct repo info
- If Claude API fails: Retry up to 3 times with exponential backoff
- If codebase scan fails: Proceed with manual file specification
- If output file cannot be written: Display story in terminal only

## Acceptance Criteria

- [ ] Command successfully generates stories from valid GitHub issues
- [ ] Generated stories follow the AI-optimized template structure
- [ ] File boundaries are automatically determined based on issue content
- [ ] Stories can be saved to files with `--output` option
- [ ] API errors are handled with appropriate retry logic
- [ ] Generated stories pass validation when run through `validate-story`

## Test Cases

1. Given a valid issue ID, when running `generate-story 123`, then display AI-ready story
2. Given `--output story.md` option, when generation succeeds, then save to story.md
3. Given an invalid issue ID, when running command, then display helpful error
4. Given Claude API timeout, when retrying, then succeed within 3 attempts
5. Given a vague issue description, when generating, then include clarifying questions in story

## Dependencies

- Claude API key in environment variable `ANTHROPIC_API_KEY`
- Existing GitHubService and AnalysisService classes
- Network access to GitHub and Anthropic APIs