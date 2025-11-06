import { AgentEventEmitter } from './agent-events.ts';

export function createAgentTrackingMiddleware(eventEmitter: AgentEventEmitter) {
  return {
    onAgentConnected: (req, res, next) => {
      // Middleware to emit agent connection events
      const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
      eventEmitter.emitAgentConnected(ip);
      next();
    }
  };
}