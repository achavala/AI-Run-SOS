import type { BaseAgent } from "./agent.js";

export class AgentRegistry {
  private static instance: AgentRegistry | null = null;
  private agents = new Map<string, BaseAgent>();

  private constructor() {}

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  static resetInstance(): void {
    AgentRegistry.instance = null;
  }

  register(agent: BaseAgent): void {
    if (this.agents.has(agent.config.id)) {
      throw new Error(
        `Agent with id "${agent.config.id}" is already registered`
      );
    }
    this.agents.set(agent.config.id, agent);
  }

  get(agentId: string): BaseAgent {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent with id "${agentId}" not found in registry`);
    }
    return agent;
  }

  getByRole(role: string): BaseAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.config.role === role
    );
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  unregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  listAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  clear(): void {
    this.agents.clear();
  }
}
