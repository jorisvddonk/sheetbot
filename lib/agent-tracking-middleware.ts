import { AgentEventEmitter } from './agent-events.ts';

/**
 * Determines the agent ID using IP address.
 * @param req The HTTP request object
 * @returns The agent ID string or null if not available
 */
export function ipBasedDetermineAgentId(req: any): string | null {
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress || null;
}

/**
 * Determines the agent ID using hostname from capabilities JSON.
 * @param req The HTTP request object
 * @returns The agent ID string or null if not available
 */
export function hostnameBasedDetermineAgentId(req: any): string | null {
    const capabilities = req.body?.capabilities;
    return capabilities?.hostname || null;
}

/**
 * Determines the agent ID using 'sheetbot_agent.id' from capabilities JSON.
 * @param req The HTTP request object
 * @returns The agent ID string or null if not available
 */
export function sheetbotAgentIdDetermineAgentId(req: any): string | null {
    const capabilities = req.body?.capabilities;
    return capabilities?.sheetbot_agent?.id || null;
}

/**
 * Creates a composite ID determination function that tries multiple strategies in order.
 * @param strategies Array of ID determination functions to try
 * @param fallback A fallback function to use if all strategies fail (should return string | null)
 * @returns A composite ID determination function
 */
export function chainDetermineAgentId(
    strategies: ((req: any) => string | null)[],
    fallback: (req: any) => string | null = ipBasedDetermineAgentId
): (req: any) => string {
    return (req: any): string => {
        for (const strategy of strategies) {
            const id = strategy(req);
            if (id !== null) {
                return id;
            }
        }
        // If all strategies fail, use fallback
        return fallback(req) || 'unknown';
    };
}

export function createAgentTrackingMiddleware(eventEmitter: AgentEventEmitter, determineAgentId: (req: any) => string = chainDetermineAgentId([sheetbotAgentIdDetermineAgentId, hostnameBasedDetermineAgentId])) {
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