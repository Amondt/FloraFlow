import { TestBed } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PendingDeleteManager } from './pending-delete';

// Flush the microtask queue without relying on setTimeout (which hangs under fake timers).
const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('PendingDeleteManager', () => {
  let manager: PendingDeleteManager;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({}).compileComponents();
    manager = new PendingDeleteManager();
  });

  afterEach(() => {
    manager.cancelAll();
    vi.useRealTimers();
  });

  it('adds the id to pendingIds immediately on schedule()', () => {
    manager.schedule('id-1', 5000, vi.fn());
    expect(manager.pendingIds().has('id-1')).toBe(true);
  });

  it('tracks multiple scheduled ids simultaneously', () => {
    manager.schedule('a', 5000, vi.fn());
    manager.schedule('b', 5000, vi.fn());
    expect(manager.pendingIds().has('a')).toBe(true);
    expect(manager.pendingIds().has('b')).toBe(true);
  });

  it('calls onCommit and removes the id after the delay elapses', async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    manager.schedule('id-1', 5000, commit);

    vi.advanceTimersByTime(5000);
    await flushMicrotasks();

    expect(commit).toHaveBeenCalledOnce();
    expect(manager.pendingIds().has('id-1')).toBe(false);
  });

  it('does not call onCommit before the delay has elapsed', () => {
    const commit = vi.fn();
    manager.schedule('id-1', 5000, commit);

    vi.advanceTimersByTime(4999);

    expect(commit).not.toHaveBeenCalled();
    expect(manager.pendingIds().has('id-1')).toBe(true);
  });

  it('undo() clears the timer and removes the id without calling onCommit', () => {
    const commit = vi.fn();
    manager.schedule('id-1', 5000, commit);
    manager.undo('id-1');

    vi.advanceTimersByTime(10000);

    expect(commit).not.toHaveBeenCalled();
    expect(manager.pendingIds().has('id-1')).toBe(false);
  });

  it('undo() on an unknown id is a no-op', () => {
    expect(() => manager.undo('never-scheduled')).not.toThrow();
  });

  it('cancelAll() clears all timers without calling any onCommit', () => {
    const commit1 = vi.fn();
    const commit2 = vi.fn();
    manager.schedule('a', 5000, commit1);
    manager.schedule('b', 5000, commit2);
    manager.cancelAll();

    vi.advanceTimersByTime(10000);

    expect(commit1).not.toHaveBeenCalled();
    expect(commit2).not.toHaveBeenCalled();
  });

  it('flushAll() immediately calls the provided commit function for every pending id', async () => {
    manager.schedule('a', 5000, vi.fn());
    manager.schedule('b', 5000, vi.fn());

    const flushCommit = vi.fn().mockResolvedValue(undefined);
    manager.flushAll(flushCommit);
    await flushMicrotasks();

    expect(flushCommit).toHaveBeenCalledWith('a');
    expect(flushCommit).toHaveBeenCalledWith('b');
  });

  it('flushAll() does not fire the original onCommit callbacks', () => {
    const originalCommit = vi.fn();
    manager.schedule('a', 5000, originalCommit);

    const flushCommit = vi.fn().mockResolvedValue(undefined);
    manager.flushAll(flushCommit);

    vi.advanceTimersByTime(10000);

    expect(originalCommit).not.toHaveBeenCalled();
  });
});
