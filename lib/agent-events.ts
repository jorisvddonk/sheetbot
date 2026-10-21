import { EventEmitter } from "node:events";

export const AgentEvent = {
  CONNECTED: 'agent:connected'
} as const;
export type AgentEvent = (typeof AgentEvent)[keyof typeof AgentEvent];

export interface AgentEventData {
    id: string;
    ip: string;
    type: string;
    timestamp: number;
    capabilities?: Record<string, any>;
    metadata?: Record<string, any>;
}

export class AgentEventEmitter extends EventEmitter {
    emitAgentConnected(id: string, ip: string, type: string, capabilities?: Record<string, any>, metadata?: Record<string, any>) {
       this.emit(AgentEvent.CONNECTED, { id, ip, type, timestamp: Date.now(), capabilities, metadata });
    }
}