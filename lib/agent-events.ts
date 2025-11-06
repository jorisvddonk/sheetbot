import { EventEmitter } from "node:events";

export enum AgentEvent {
  CONNECTED = 'agent:connected'
}

export interface AgentEventData {
  ip: string;
  timestamp: number;
  capabilities?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class AgentEventEmitter extends EventEmitter {
  emitAgentConnected(ip: string, capabilities?: Record<string, any>, metadata?: Record<string, any>) {
    this.emit(AgentEvent.CONNECTED, { ip, timestamp: Date.now(), capabilities, metadata });
  }
}