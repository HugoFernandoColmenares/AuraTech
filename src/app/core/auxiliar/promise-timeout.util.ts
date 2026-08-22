/** Race a promise against a timeout — resolves with fallback or rejects. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  fallback?: T
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (fallback !== undefined) {
        resolve(fallback);
      } else {
        reject(new Error(`${label} timed out after ${ms}ms`));
      }
    }, ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}
