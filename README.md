# opencode-chain-prompt

OpenCode plugin for **sequential chain prompting** with per-step agent selection, looping, and conditional branching. Executes chains via the OpenCode SDK — fully automated.

## Installation

```json
// opencode.json
{
  "plugin": ["opencode-chain-prompt"]
}
```

## Usage

### 1. Define a chain

Create `.opencode/chains/<name>.md` (project) or `~/.config/opencode/chains/<name>.md` (global):

```markdown
---
name: generate-component
description: Generate, validate, and commit a React component
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
    prompt: |
      Review the component for best practices,
      accessibility, and TypeScript correctness.
  - id: commit
    agent: build
    condition: on_success
    prompt: |
      Commit changes with a conventional commit message.
---
```

### 2. Define agents (optional)

Agent definitions are read from your existing `.opencode/agents/` or `opencode.json` config. Each step uses its agent's model, system prompt, and permissions.

```json
{
  "agent": {
    "code-reviewer": {
      "mode": "subagent",
      "model": "anthropic/claude-haiku-4-20250514",
      "prompt": "You are a strict code reviewer.",
      "permission": { "edit": "deny", "bash": "deny" }
    }
  }
}
```

### 3. Run the chain

In a conversation with the AI:

```
Generate a button component using the chain
```

The AI will call `chain_start({ name: "generate-component", input: "button" })` automatically.

## Chain Format

| Field           | Required | Description                              |
| --------------- | -------- | ---------------------------------------- |
| `name`          | yes      | Chain identifier                         |
| `description`   | no       | Human-readable description               |
| `default_model` | no       | Fallback model (default: claude-sonnet-4-6) |
| `loop`          | no       | Number of iterations (default: 1)        |
| `steps`         | yes      | Array of step definitions                |

### Step Fields

| Field       | Required | Description                                         |
| ----------- | -------- | --------------------------------------------------- |
| `id`          | yes      | Step identifier, used for {id} template variables     |
| `agent`       | yes      | Agent name (resolved from opencode.json or agent files) |
| `prompt`      | yes      | Prompt template supporting {variables}                |
| `condition`   | no       | Branching: `always`, `on_success`, `on_error`        |

### Template Variables

| Variable     | Description                        |
| ------------ | ---------------------------------- |
| `{input}`      | User input passed to chain           |
| `{iteration}`  | Current loop iteration (1-based)     |
| `{lastResult}` | Result of the previous step          |
| `{step_id}`    | Result of a specific step by its ID  |

### Branching Conditions

| Condition   | Behavior                              |
| ----------- | ------------------------------------- |
| `always`    | Always execute (default)              |
| `on_success`| Only if no errors in previous steps   |
| `on_error`  | Only if previous steps had errors     |

## Tools

| Tool          | Description                              |
| ------------- | ---------------------------------------- |
| `chain_start` | Execute a chain by name with input       |
| `chain_list`  | List all available chain definitions     |

## Agent Resolution

For each step, the plugin resolves the agent config from (in order):

1. `opencode.json` → `agent.<name>`
2. `.opencode/agents/<name>.md`
3. `.opencode/agent/<name>.md`
4. `~/.config/opencode/agents/<name>.md`

Resolved fields: `model`, `system` (from file body), `permission` (edit/bash).
