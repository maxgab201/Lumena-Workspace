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

export class AnalysisJobEngine {
  private plugins: Map<string, AnalysisPlugin> = new Map();
  private queue: SupabaseTaskQueue;
  private cache: AnalysisCache;
  private events: AnalysisEvents;

  constructor() {
    this.queue = new SupabaseTaskQueue();
    this.cache = new AnalysisCache();
    this.events = new AnalysisEvents();
  }

  registerPlugin(plugin: AnalysisPlugin) {
    this.plugins.set(plugin.taskType, plugin);
  }

  async processDocument(documentId: string) {
    const graph = this.buildDependencyGraph();

    // Execute each level in parallel
    for (const level of graph) {
      await Promise.all(
        level.map(task => this.executeTask(documentId, task))
      );
    }
  }

  async executeTask(documentId: string, taskType: string) {
    const plugin = this.plugins.get(taskType);
    if (!plugin) return;

    // Check if can run
    const canRun = await plugin.canRun(documentId);
    if (!canRun) return;

    // Check cache
    const cached = await this.cache.get(documentId, taskType);
    if (cached) return cached;

    // Create task record
    await this.queue.enqueue({
      documentId,
      task: taskType,
      dependsOn: plugin.dependencies,
      version: 1,
    });

    // Execute
    try {
      this.events.emit({
        type: 'TaskStarted',
        documentId,
        task: taskType,
      });

      const context = await this.buildContext(documentId);
      const result = await plugin.execute(documentId, context);

      // Store in cache
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

  private buildDependencyGraph(): string[][] {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // Initialize
    for (const [taskType] of this.plugins) {
      inDegree.set(taskType, 0);
      adjList.set(taskType, []);
    }

    // Build graph
    for (const [taskType, plugin] of this.plugins) {
      for (const dep of plugin.dependencies) {
        adjList.get(dep)?.push(taskType);
        inDegree.set(taskType, (inDegree.get(taskType) || 0) + 1);
      }
    }

    // Topological sort
    const result: string[][] = [];
    const queue: string[] = [];

    for (const [task, degree] of inDegree) {
      if (degree === 0) queue.push(task);
    }

    while (queue.length > 0) {
      result.push([...queue]);
      const nextQueue: string[] = [];

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
    // This will be implemented to fetch document pages, chunks, etc.
    return {
      documentId,
      documentPages: [],
      chunks: [],
      highlights: [],
      version: 1,
    };
  }
}
