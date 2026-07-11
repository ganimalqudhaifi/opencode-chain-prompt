---
name: refactor-all
description: Refactor file, run tests, commit — all with build agent
default_agent: build
default_model: anthropic/claude-sonnet-4-6
loop: 1
steps:
  - id: refactor
    prompt: |
      Refactor {input} to improve code quality.
      Follow SOLID principles and project conventions.

  - id: test
    prompt: |
      Run the test suite and fix any failures.
      Previous result: {lastResult}

  - id: commit
    condition: on_success
    prompt: |
      Commit the refactored code with a descriptive conventional commit message.
      Mention what was refactored and why.
---
