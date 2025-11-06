import { EventEmitter } from "node:events";

export enum AgentEvent {
  CONNECTED = 'agent:connected'
}

export interface AgentEventData {
   ip: string;
   type: string;
   timestamp: number;
   capabilities?: Record<string, any>;
   metadata?: Record<string, any>;
}

export class AgentEventEmitter extends EventEmitter {
   emitAgentConnected(ip: string, type: string, capabilities?: Record<string, any>, metadata?: Record<string, any>) {
      this.emit(AgentEvent.CONNECTED, { ip, type, timestamp: Date.now(), capabilities, metadata });
   }
}