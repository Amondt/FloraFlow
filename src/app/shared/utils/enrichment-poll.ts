import { Signal, computed, signal } from '@angular/core';

/**
 * Manages the enrichment poll lifecycle for components that display unenriched botanical records.
 * Exposes enrichingNames and enrichingCount as read-only signals for template binding.
 *
 * Usage:
 *   this._poll.start(names, async (pending) => { ... return stillPendingSet; });
 *   void libraryService.triggerEnrichment(unenriched, this._poll.controller?.signal);
 */
export class EnrichmentPoll {
  private readonly _MAX_POLL_ATTEMPTS = 15;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _pollAttempts = 0;
  private _controller: AbortController | null = null;
  private _onPoll: ((pending: string[]) => Promise<Set<string>>) | null = null;

  private readonly _enrichingNames = signal<ReadonlySet<string>>(new Set());

  readonly enrichingNames: Signal<ReadonlySet<string>> = this._enrichingNames.asReadonly();
  readonly enrichingCount: Signal<number> = computed(() => this._enrichingNames().size);

  get controller(): AbortController | null {
    return this._controller;
  }

  start(names: string[], onPoll: (pending: string[]) => Promise<Set<string>>): void {
    this.stop();
    if (names.length === 0) return;
    this._onPoll = onPoll;
    this._controller = new AbortController();
    this._enrichingNames.set(new Set(names));
    this._pollTimer = setInterval(() => {
      this._pollAttempts++;
      if (this._pollAttempts >= this._MAX_POLL_ATTEMPTS) {
        this.stop();
        return;
      }
      void this._tick();
    }, 3000);
  }

  stop(): void {
    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this._pollAttempts = 0;
    this._enrichingNames.set(new Set());
    this._controller?.abort();
    this._controller = null;
    this._onPoll = null;
  }

  private async _tick(): Promise<void> {
    const pending = [...this._enrichingNames()];
    if (pending.length === 0 || !this._onPoll) {
      this.stop();
      return;
    }
    const stillPending = await this._onPoll(pending);
    if (this._enrichingNames().size === 0) return;
    this._enrichingNames.set(stillPending);
    if (stillPending.size === 0) {
      this.stop();
    }
  }
}
