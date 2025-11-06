import { TaskEventEmitter } from './task-events.ts';

export function createTaskTrackingMiddleware(eventEmitter: TaskEventEmitter) {
  return {
    onTaskCreated: (req, res, next) => {
      // Middleware to emit task creation events
      res.on('finish', () => {
        if (res.statusCode === 200 && req.method === 'POST' && req.path === '/tasks') {
          const taskId = res.locals.taskId; // Set by route handler
          if (taskId) {
            eventEmitter.emitTaskCreated(taskId);
          }
        }
      });
      next();
    },

    onTaskCompleted: (req, res, next) => {
      // Middleware to emit task completion events
      res.on('finish', () => {
        if (res.statusCode === 200 && req.method === 'POST' && req.path.endsWith('/complete')) {
          const taskId = req.params.id;
          if (taskId) {
            eventEmitter.emitTaskCompleted(taskId);
          }
        }
      });
      next();
    },

    onTaskFailed: (req, res, next) => {
      // Middleware to emit task failure events
      res.on('finish', () => {
        if (res.statusCode === 200 && req.method === 'POST' && req.path.endsWith('/failed')) {
          const taskId = req.params.id;
          if (taskId) {
            eventEmitter.emitTaskFailed(taskId);
          }
        }
      });
      next();
    }
  };
}