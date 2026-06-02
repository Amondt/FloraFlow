import { signal } from '@angular/core';

export class PendingDeleteManager {
  readonly pendingIds = signal(new Set<string>());
  private readonly _timers = new Map<string, ReturnType<typeof setTimeout>>();

  schedule(id: string, delayMs: number, onCommit: () => Promise<void>): void {
    this.pendingIds.update((ids) => new Set([...ids, id]));
    const timer = setTimeout(async () => {
      this._timers.delete(id);
      this.pendingIds.update((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
      await onCommit();
    }, delayMs);
    this._timers.set(id, timer);
  }

  undo(id: string): void {
    const timer = this._timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this._timers.delete(id);
    }
    this.pendingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(id);
      return next;
    });
  }

  cancelAll(): void {
    this._timers.forEach(clearTimeout);
    this._timers.clear();
  }

  flushAll(onCommit: (id: string) => Promise<void>): void {
    this._timers.forEach((timer, id) => {
      clearTimeout(timer);
      void onCommit(id);
    });
    this._timers.clear();
  }
}
