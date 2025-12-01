import { AgentEventEmitter } from './agent-events.ts';

/**
 * Default function to determine the agent ID for identification purposes.
 * Returns the IP address by default. Users can override this function to implement custom ID generation logic.
 * @param req The HTTP request object
 * @returns The agent ID string
 */
export function defaultDetermineAgentId(req: any): string {
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
}

export function createAgentTrackingMiddleware(eventEmitter: AgentEventEmitter, determineAgentId: (req: any) => string = defaultDetermineAgentId) {
    return {
       onAgentConnected: (req, res, next) => {
          // Middleware to emit agent connection events
          const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
          const id = determineAgentId(req);
          const type = req.body?.type;
          const capabilities = req.body?.capabilities;
          eventEmitter.emitAgentConnected(id, ip, type, capabilities);
          next();
       }
    };
}