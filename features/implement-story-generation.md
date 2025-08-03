# Implement Story Generation Feature

## Description

We need to implement the `workflow generate-story` command that takes an analyzed GitHub issue and transforms it into an AI-ready story specification. This feature is critical for the Tech Lead workflow.

The command should:
- Take the analysis from `workflow analyze` 
- Generate a structured story following our AI-optimized template
- Include specific file boundaries and constraints
- Generate test cases and acceptance criteria
- Output the story in markdown format

## Current State

- The `analyze` command fetches issues and performs basic analysis
- The `generate-story` command exists but is just a placeholder
- We have the `AIStorySpec` type defined but not used yet

## Acceptance Criteria

- [ ] Command generates a complete AI-ready story from a GitHub issue
- [ ] Story includes all required sections from our template
- [ ] File boundaries are automatically determined from codebase analysis
- [ ] Generated stories can be saved to a file with `--output` option
- [ ] Stories include generated test cases based on the requirements
- [ ] Command integrates with AI (Claude) for intelligent story generation

## Technical Notes

- Should use the existing `AIStorySpec` interface
- Need to add Claude API integration
- Should scan codebase to suggest allowed/forbidden files
- Consider using the analysis results as input