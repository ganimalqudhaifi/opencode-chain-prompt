---
name: chain-generator
description: |
  Use when the user wants to create, edit, or understand chain definition files for the opencode-chain-prompt plugin.
  Trigger on keywords: "chain", "chain prompt", "chain definition", "chain file", "buat chain", "generate chain", "chain workflow".
  Knows the complete chain file format (Markdown frontmatter with YAML steps) and generates valid .md files.
---

# Chain Generator Skill

You help users create and manage chain definition files for the `opencode-chain-prompt` plugin. Chain files are Markdown files with YAML frontmatter placed in `.opencode/chains/`.

## Chain File Format

```markdown
---
name: <chain-name>
description: <short description>
default_model: anthropic/claude-sonnet-4-6
loop: <number of iterations (default: 1)>
steps:
  - id: <step-id>
    agent: <agent-name>
    prompt: |
      <prompt template text>
    condition: <always | on_success | on_error> # optional, default: always
  - id: <step-id-2>
    agent: <agent-name-2>
    prompt: |
      <prompt template text>
---
```

## Fields

### Top-level

| Field           | Required | Description                              |
| --------------- | -------- | ---------------------------------------- |
| `name`          | yes      | Chain identifier, lowercase hyphen-separated |
| `description`   | no       | Human-readable description               |
| `default_model` | no       | Fallback model (format: provider/model)   |
| `loop`          | no       | Number of iterations (default: 1)         |
| `steps`         | yes      | Array of 2+ step definitions             |

### Step Fields

| Field       | Required | Description                                     |
| ----------- | -------- | ----------------------------------------------- |
| `id`          | yes      | Unique step identifier, lowercase hyphen-separated |
| `agent`       | yes      | Agent name (resolved from opencode.json or agent files) |
| `prompt`      | yes      | Prompt template, supports variables below       |
| `condition`   | no       | Branching: `always`, `on_success`, `on_error`   |

## Template Variables

| Variable       | Description                                  |
| -------------- | -------------------------------------------- |
| `{input}`        | User input passed to chain                     |
| `{iteration}`    | Current loop iteration (1-based)               |
| `{lastResult}`   | Result of the previous step                    |
| `{<step-id>}`    | Result of a specific step (e.g. `{generate}`)    |

## Branching

| Condition   | Behavior                              |
| ----------- | ------------------------------------- |
| `always`    | Always execute (default)              |
| `on_success`| Only if no errors in previous steps   |
| `on_error`  | Only if previous steps had errors     |

## Agent Resolution

The plugin resolves each `agent` name from (in order):
1. `opencode.json` → `agent.<name>.model` and `agent.<name>.prompt`
2. `.opencode/agents/<name>.md` (frontmatter + body = system prompt)
3. `~/.config/opencode/agents/<name>.md`

## Common Chain Patterns

### 1. Generate → Validate → Commit

```markdown
---
name: generate-component
description: Generate a React component, validate it, then commit
default_model: anthropic/claude-sonnet-4-6
loop: 1
steps:
  - id: generate
    agent: build
    prompt: |
      Generate a React {input} component with Tailwind CSS.
      Use TypeScript. Create file in src/components/.
  - id: validate
    agent: code-reviewer
    condition: on_success
    prompt: |
      Review the generated component for best practices,
      accessibility, performance, and TypeScript correctness.
      Fix any issues found.
  - id: commit
    agent: build
    condition: on_success
    prompt: |
      Stage and commit the changes with a conventional commit message.
---
```

### 2. Bulk Generation with Loop

```markdown
---
name: bulk-generate
description: Generate multiple React components in sequence
default_model: anthropic/claude-sonnet-4-6
loop: 22
steps:
  - id: generate
    agent: build
    prompt: |
      Generate a React {input} component with Tailwind CSS.
      Iteration {iteration}. Create file in src/components/.
  - id: validate
    agent: code-reviewer
    condition: on_success
    prompt: |
      Review the component. Fix any issues.
      Previous result: {lastResult}
  - id: commit
    agent: build
    condition: on_success
    prompt: |
      Commit changes with conventional commit message.
---
```

### 3. Error Recovery Pattern

```markdown
---
name: fix-and-commit
description: Attempt a task, fix errors, then commit
default_model: anthropic/claude-sonnet-4-6
loop: 1
steps:
  - id: implement
    agent: build
    prompt: |
      Implement {input} in the codebase.
  - id: fix
    agent: build
    condition: on_error
    prompt: |
      The previous step had errors. Fix them.
      Error context: {lastResult}
  - id: commit
    agent: build
    condition: on_success
    prompt: |
      Commit the changes.
---
```

## How to Help Users

1. Ask what they want the chain to do (generate code? validate? deploy?)
2. Identify what agents they have available (build, plan, code-reviewer, etc.)
3. Structure steps in logical order with appropriate conditions
4. Generate the chain file and suggest saving it
5. If they have multiple things to process (e.g. 22 components), use `loop`
6. Use the `chain_list` tool to suggest existing chains they can reference

When generating a chain, always include at least 2 steps. A single-step chain defeats the purpose.
