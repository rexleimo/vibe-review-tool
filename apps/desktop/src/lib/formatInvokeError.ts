export function formatInvokeError(err: unknown): string {
  if (err instanceof Error) {
    const message = err.message || String(err);
    // Some runtimes put useful info in `stack`. Keep it but don’t overwhelm.
    if (err.stack && !err.stack.includes(message)) {
      return `${message}\n\n${err.stack}`;
    }
    return message;
  }

  if (typeof err === "string") return err;
  if (err === null || err === undefined) return String(err);
  if (typeof err === "object") {
    try {
      return JSON.stringify(err, null, 2);
    } catch {
      return String(err);
    }
  }

  return String(err);
}
