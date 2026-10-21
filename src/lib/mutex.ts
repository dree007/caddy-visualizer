/**
 * Minimal in-process mutex: tasks run strictly one after another, in call
 * order. Enough for a single server process; it does not coordinate processes.
 */
export interface Mutex {
  run<T>(task: () => Promise<T>): Promise<T>;
  /** True while a task is running or waiting. */
  readonly busy: boolean;
}

export function createMutex(): Mutex {
  let tail: Promise<unknown> = Promise.resolve();
  let queued = 0;

  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      queued++;
      const result = tail.then(task).finally(() => {
        queued--;
      });
      // A failed task must not block the ones after it.
      tail = result.catch(() => undefined);
      return result;
    },
    get busy() {
      return queued > 0;
    },
  };
}
