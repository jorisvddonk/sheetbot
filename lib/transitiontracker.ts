export interface TransitionEvaluationData {
    taskId: string;
    transitionIndex: number;
    evaluationTimeMs: number;
    successful: boolean;
    transitionTo: string;
    timestamp: number;
}

export class TransitionTracker {
    private evaluations: TransitionEvaluationData[] = [];

    recordEvaluation(data: Omit<TransitionEvaluationData, 'timestamp'>) {
        const evaluationData: TransitionEvaluationData = {
            ...data,
            timestamp: Date.now()
        };
        this.evaluations.push(evaluationData);
    }

    getStats(minutes: number) {
        const now = Date.now();
        const windowMs = minutes * 60 * 1000;
        const cutoff = now - windowMs;

        const windowEvaluations = this.evaluations.filter(e => e.timestamp > cutoff);

        const totalEvaluations = windowEvaluations.length;
        const totalEvaluationTimeMs = windowEvaluations.reduce((sum, e) => sum + e.evaluationTimeMs, 0);
        const successfulTransitions = windowEvaluations.filter(e => e.successful).length;

        // Group by transition type
        const transitionsByType: Record<string, { count: number; totalTime: number }> = {};
        for (const evaluation of windowEvaluations) {
            if (!transitionsByType[evaluation.transitionTo]) {
                transitionsByType[evaluation.transitionTo] = { count: 0, totalTime: 0 };
            }
            transitionsByType[evaluation.transitionTo].count++;
            transitionsByType[evaluation.transitionTo].totalTime += evaluation.evaluationTimeMs;
        }

        return {
            totalEvaluations,
            totalEvaluationTimeMs,
            successfulTransitions,
            transitionsByType,
            windowMinutes: minutes
        };
    }

    private cleanup(maxMinutes: number) {
        const now = Date.now();
        const cutoff = now - (maxMinutes * 60 * 1000);

        // Remove entries older than maxMinutes (currently 1440 minutes = 1 day)
        this.evaluations = this.evaluations.filter(e => e.timestamp > cutoff);
    }

    // Clean up old entries every hour to keep data up to 1 day
    startCleanup() {
        setInterval(() => this.cleanup(1440), 3600000);
    }
}