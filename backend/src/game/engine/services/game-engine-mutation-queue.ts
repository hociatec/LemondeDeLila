export function enqueueMutation<T>(params: {
  queue: Map<string, Promise<unknown>>;
  key: string;
  task: () => Promise<T>;
}): Promise<T> {
  const { queue, key, task } = params;
  const previous = queue.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  queue.set(key, next);
  next
    .finally(() => {
      if (queue.get(key) === next) {
        queue.delete(key);
      }
    })
    .catch(() => {});
  return next;
}
