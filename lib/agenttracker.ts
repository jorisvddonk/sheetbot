import { AgentEventEmitter, AgentEvent, AgentEventData } from './agent-events.ts';

export class AgentTracker {
    private agents: Map<string, { timestamp: number, capabilities?: Record<string, any> }> = new Map();

    constructor(eventEmitter: AgentEventEmitter) {
        eventEmitter.on(AgentEvent.CONNECTED, (data: AgentEventData) => {
            this.agents.set(data.ip, { timestamp: data.timestamp, capabilities: data.capabilities });
        });

        // Clean up old agents every hour to keep data up to 1 day
        setInterval(() => this.cleanup(1440), 3600000);
    }

    getStats(minutes: number) {
        const now = Date.now();
        const windowMs = minutes * 60 * 1000;
        const cutoff = now - windowMs;

        const activeAgents = Array.from(this.agents.entries())
            .filter(([ip, data]) => data.timestamp > cutoff)
            .map(([ip, data]) => ({ ip, lastSeen: data.timestamp, capabilities: data.capabilities }));

        return {
            totalUniqueAgents: this.agents.size,
            activeAgents: activeAgents.length,
            agents: activeAgents,
            windowMinutes: minutes
        };
    }

    private cleanup(maxMinutes: number) {
        const now = Date.now();
        const cutoff = now - (maxMinutes * 60 * 1000);

        // Remove agents not seen in the last maxMinutes (currently 1440 minutes = 1 day)
        for (const [ip, data] of this.agents.entries()) {
            if (data.timestamp < cutoff) {
                this.agents.delete(ip);
            }
        }
    }
}