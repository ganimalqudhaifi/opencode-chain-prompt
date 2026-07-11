export type Condition = "always" | "on_success" | "on_error";

export interface ChainStep {
  id: string;
  agent?: string;
  prompt: string;
  condition?: Condition;
}

export interface ChainDefinition {
  name: string;
  description?: string;
  default_agent?: string;
  default_model: string;
  loop: number;
  steps: ChainStep[];
}

export interface ChainContext {
  input: string;
  iteration: number;
  results: Record<string, string>;
  lastResult: string;
  errors: string[];
}

export interface ChainResult {
  success: boolean;
  context: ChainContext;
  error?: string;
}

export interface AgentConfig {
  model?: string;
  system?: string;
  permission?: {
    edit?: "allow" | "deny" | "ask";
    bash?: "allow" | "deny" | "ask";
  };
}

export interface ChainVariable {
  name: string;
  value: string;
}
