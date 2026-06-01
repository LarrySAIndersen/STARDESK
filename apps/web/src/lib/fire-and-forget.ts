/** Run an async side effect without awaiting; swallow rejections (Sonar S3735). */
export function fireAndForget(promise: Promise<unknown>): void {
  promise.catch(() => undefined);
}
