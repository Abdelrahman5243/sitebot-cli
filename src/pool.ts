/**
 * Runs tasks with a limited number in flight at once.
 * Waits `delayMs` between starting tasks so we never flood a site.
 */
export async function runPool<T, R>(
  items: T[],
  options: { limit: number; delayMs: number; signal: AbortSignal },
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let next = 0;

  async function worker() {
    while (!options.signal.aborted) {
      const index = next++;
      if (index >= items.length) return;
      if (options.delayMs > 0) await sleep(options.delayMs, options.signal);
      if (options.signal.aborted) return;
      results.push(await work(items[index]));
    }
  }

  const workerCount = Math.min(options.limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    signal.addEventListener("abort", finish, { once: true });
  });
}
