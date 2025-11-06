import { EventEmitter } from "node:events";

export enum AgentEvent {
  CONNECTED = 'agent:connected'
}

export interface AgentEventData {
  ip: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export class AgentEventEmitter extends EventEmitter {
  emitAgentConnected(ip: string, metadata?: Record<string, any>) {
    this.emit(AgentEvent.CONNECTED, { ip, timestamp: Date.now(), metadata });
  }
}