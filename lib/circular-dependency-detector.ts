/**
 * Circular Dependency Detector
 * 
 * Detects cycles in commitment dependencies:
 * - Task A depends on Task B
 * - Task B depends on Task C
 * - Task C depends on Task A (cycle!)
 * 
 * Uses depth-first search (DFS) to detect cycles and identify blocker chains.
 */

import type { Task } from './types';

interface BlockerNode {
  taskId: string;
  description: string;
  blocker?: string;
  depthFromStart: number;
  path: string[]; // For cycle path tracking
}

interface CircularDependency {
  isCircular: boolean;
  cycleLength: number;
  cyclePath: string[]; // Task IDs in the cycle
  blockingChain: Array<{
    taskId: string;
    description: string;
    blocking: string | null;
  }>;
}

/**
 * Parse blocker string to extract task description or ID
 * Blocker format: "Task description" or "task_id"
 */
function parseBlocker(blockerString: string): string {
  return blockerString.trim().toLowerCase();
}

/**
 * Find if there's a cycle in task dependencies
 * Returns cycle information if found
 */
export function detectCircularDependencies(
  tasks: Task[],
): Map<string, CircularDependency> {
  const results = new Map<string, CircularDependency>();
  const visited = new Set<string>();
  const recStack = new Set<string>(); // Recursion stack for DFS
  const taskMap = new Map<string, Task>();

  // Build task map for quick lookup
  for (const task of tasks) {
    taskMap.set(task.id, task);
    // Also index by description for fuzzy matching
    taskMap.set(parseBlocker(task.description), task);
  }

  /**
   * DFS helper to detect cycles
   * Returns the cycle path if found, null otherwise
   */
  function dfs(
    taskId: string,
    path: string[],
    visitPath: Map<string, number>, // Task ID -> position in path
  ): string[] | null {
    const task = taskMap.get(taskId);
    if (!task) return null;

    // Check if we've revisited a task in current path (cycle detected!)
    if (visitPath.has(taskId)) {
      const cycleStart = visitPath.get(taskId) || 0;
      return path.slice(cycleStart);
    }

    // If already processed in previous DFS call, skip
    if (visited.has(taskId)) {
      return null;
    }

    // Mark current position in path
    visitPath.set(taskId, path.length);
    path.push(taskId);

    // Check for blockers (dependencies)
    if (task.blocker) {
      // Try to find the blocking task
      const blockerTaskId = findBlockingTaskId(task.blocker, taskMap);
      
      if (blockerTaskId) {
        const cyclePath = dfs(blockerTaskId, [...path], new Map(visitPath));
        if (cyclePath) {
          return cyclePath;
        }
      }
    }

    // Check for dependency field (if using explicit dependency tracking)
    if (task.dependency) {
      const depTaskId = findBlockingTaskId(task.dependency, taskMap);
      if (depTaskId) {
        const cyclePath = dfs(depTaskId, [...path], new Map(visitPath));
        if (cyclePath) {
          return cyclePath;
        }
      }
    }

    visited.add(taskId);
    return null;
  }

  /**
   * Find the task ID that matches a blocker description
   * Uses fuzzy matching on task descriptions
   */
  function findBlockingTaskId(blockerString: string, map: Map<string, Task>): string | null {
    const normalized = parseBlocker(blockerString);

    // Direct lookup by ID
    if (map.has(normalized)) {
      const task = map.get(normalized);
      return task?.id || null;
    }

    // Fuzzy matching on description (first match wins)
    for (const task of tasks) {
      if (normalized.includes(task.id) || task.description.toLowerCase().includes(normalized)) {
        return task.id;
      }
    }

    return null;
  }

  /**
   * Build blocking chain starting from a task
   */
  function buildBlockingChain(taskId: string, maxDepth: number = 10): Array<{
    taskId: string;
    description: string;
    blocking: string | null;
  }> {
    const chain: Array<{
      taskId: string;
      description: string;
      blocking: string | null;
    }> = [];

    let currentTaskId: string | null = taskId;
    let depth = 0;

    while (currentTaskId && depth < maxDepth) {
      const task = taskMap.get(currentTaskId);
      if (!task) break;

      chain.push({
        taskId: task.id,
        description: task.description,
        blocking: task.blocker || null,
      });

      // Move to next blocker in chain
      if (task.blocker) {
        const nextTaskId = findBlockingTaskId(task.blocker, taskMap);
        currentTaskId = nextTaskId;
      } else if (task.dependency) {
        const nextTaskId = findBlockingTaskId(task.dependency, taskMap);
        currentTaskId = nextTaskId;
      } else {
        break;
      }

      depth++;
    }

    return chain;
  }

  // Check each task for cycles
  for (const task of tasks) {
    if (!visited.has(task.id) && (task.blocker || task.dependency)) {
      const cyclePath = dfs(task.id, [], new Map());

      if (cyclePath && cyclePath.length > 0) {
        // Cycle found!
        const blockingChain = buildBlockingChain(task.id);

        results.set(task.id, {
          isCircular: true,
          cycleLength: cyclePath.length,
          cyclePath,
          blockingChain,
        });

        // Mark all tasks in cycle as visited to avoid redundant checks
        for (const cycleTaskId of cyclePath) {
          visited.add(cycleTaskId);
        }
      }
    }

    if (!visited.has(task.id)) {
      visited.add(task.id);
    }
  }

  return results;
}

/**
 * Get all tasks that are part of any circular dependency
 */
export function getCircularTasks(
  tasks: Task[],
): Set<string> {
  const cycles = detectCircularDependencies(tasks);
  const circularTaskIds = new Set<string>();

  cycles.forEach((cycleInfo) => {
    for (const taskId of cycleInfo.cyclePath) {
      circularTaskIds.add(taskId);
    }
  });

  return circularTaskIds;
}

/**
 * Get dependency chain for a task (all blockers it depends on)
 */
export function getDependencyChain(
  taskId: string,
  tasks: Task[],
  maxDepth: number = 10,
): Array<{
  taskId: string;
  description: string;
  blocking: string | null;
}> {
  const taskMap = new Map<string, Task>();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const task = taskMap.get(taskId);
  if (!task || (!task.blocker && !task.dependency)) {
    return [];
  }

  const chain: Array<{
    taskId: string;
    description: string;
    blocking: string | null;
  }> = [
    {
      taskId: task.id,
      description: task.description,
      blocking: task.blocker || null,
    },
  ];

  let currentBlocker = task.blocker || task.dependency;
  let depth = 0;

  while (currentBlocker && depth < maxDepth) {
    // Find the task matching this blocker
    let foundTask: Task | null = null;

    // Direct lookup by ID
    if (taskMap.has(currentBlocker)) {
      foundTask = taskMap.get(currentBlocker) || null;
    } else {
      // Fuzzy matching
      const normalized = parseBlocker(currentBlocker);
      for (const t of tasks) {
        if (normalized.includes(t.id) || t.description.toLowerCase().includes(normalized)) {
          foundTask = t;
          break;
        }
      }
    }

    if (!foundTask) break;

    chain.push({
      taskId: foundTask.id,
      description: foundTask.description,
      blocking: foundTask.blocker || null,
    });

    currentBlocker = foundTask.blocker || foundTask.dependency || null;
    depth++;
  }

  return chain;
}
