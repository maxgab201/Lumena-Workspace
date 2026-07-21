/**
 * AnalysisJobEngine - Orchestrates document analysis pipeline
 *
 * Uses plugin system with dependency graph for parallel execution.
 * Tasks are executed in topological order based on dependencies.
 */

import { SupabaseTaskQueue } from './TaskQueue';
import type { AnalysisPlugin, PluginContext } from './AnalysisPlugin';
import { AnalysisCache } from './AnalysisCache';
import { AnalysisEvents } from './AnalysisEvents';
import type { AnalysisTaskType } from './TaskQueue';

export class AnalysisJobEngine {
  private plugins: Map<AnalysisTaskType, AnalysisPlugin> = new Map();
  private queue: SupabaseTaskQueue;
  private cache: AnalysisCache;
  private events: AnalysisEvents;

  constructor() {
    this.queue = new SupabaseTaskQueue();
    this.cache = new AnalysisCache();
    this.events = new AnalysisEvents();
  }

  registerPlugin(plugin: AnalysisPlugin) {
    this.plugins.set(plugin.taskType as AnalysisTaskType, plugin);
  }

  async processDocument(documentId: string) {
    const graph = this.buildDependencyGraph();

    for (const level of graph) {
      await Promise.all(
        level.map(task => this.executeTask(documentId, task))
      );
    }
  }

  async executeTask(documentId: string, taskType: AnalysisTaskType) {
    const plugin = this.plugins.get(taskType);
    if (!plugin) return;

    const canRun = await plugin.canRun(documentId);
    if (!canRun) return;

    const cached = await this.cache.get(documentId, taskType);
    if (cached) return cached;

    await this.queue.enqueue({
      documentId,
      task: taskType,
      dependsOn: plugin.dependencies as AnalysisTaskType[],
      version: 1,
    });

    try {
      this.events.emit({
        type: 'TaskStarted',
        documentId,
        task: taskType,
      });

      const context = await this.buildContext(documentId);
      const result = await plugin.execute(documentId, context);

      await this.cache.set(documentId, taskType, result);

      this.events.emit({
        type: 'TaskCompleted',
        documentId,
        task: taskType,
      });

      return result;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.events.emit({
        type: 'TaskFailed',
        documentId,
        task: taskType,
        error: error.message,
      });
      throw error;
    }
  }

  private buildDependencyGraph(): AnalysisTaskType[][] {
    const inDegree = new Map<AnalysisTaskType, number>();
    const adjList = new Map<AnalysisTaskType, AnalysisTaskType[]>();

    for (const [taskType] of this.plugins) {
      inDegree.set(taskType, 0);
      adjList.set(taskType, []);
    }

    for (const [taskType, plugin] of this.plugins) {
      for (const dep of plugin.dependencies) {
        const depType = dep as AnalysisTaskType;
        adjList.get(depType)?.push(taskType);
        inDegree.set(taskType, (inDegree.get(taskType) || 0) + 1);
      }
    }

    const result: AnalysisTaskType[][] = [];
    const queue: AnalysisTaskType[] = [];

    for (const [task, degree] of inDegree) {
      if (degree === 0) queue.push(task);
    }

    while (queue.length > 0) {
      result.push([...queue]);
      const nextQueue: AnalysisTaskType[] = [];

      for (const task of queue) {
        for (const neighbor of adjList.get(task) || []) {
          const newDegree = (inDegree.get(neighbor) || 1) - 1;
          inDegree.set(neighbor, newDegree);
          if (newDegree === 0) nextQueue.push(neighbor);
        }
      }

      queue.length = 0;
      queue.push(...nextQueue);
    }

    return result;
  }

  private async buildContext(documentId: string): Promise<PluginContext> {
    return {
      documentId,
      documentPages: [],
      chunks: [],
      highlights: [],
      version: 1,
    };
  }
}
