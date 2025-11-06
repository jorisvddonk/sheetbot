import { AgentEventEmitter, AgentEvent, AgentEventData } from './agent-events.ts';

export class AgentTracker {
    private agents: Map<string, number> = new Map(); // IP -> last seen timestamp

    constructor(eventEmitter: AgentEventEmitter) {
        eventEmitter.on(AgentEvent.CONNECTED, (data: AgentEventData) => {
            this.agents.set(data.ip, data.timestamp);
        });

        // Clean up old agents every hour to keep data up to 1 day
        setInterval(() => this.cleanup(1440), 3600000);
    }

    getStats(minutes: number) {
        const now = Date.now();
        const windowMs = minutes * 60 * 1000;
        const cutoff = now - windowMs;

        const activeAgents = Array.from(this.agents.entries())
            .filter(([ip, timestamp]) => timestamp > cutoff)
            .map(([ip, timestamp]) => ({ ip, lastSeen: timestamp }));

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
        for (const [ip, timestamp] of this.agents.entries()) {
            if (timestamp < cutoff) {
                this.agents.delete(ip);
            }
        }
    }
}