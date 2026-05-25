import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NetworkStatusService } from './network-status.service';

describe('NetworkStatusService', () => {
  let service: NetworkStatusService;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [NetworkStatusService],
    }).compileComponents();

    service = TestBed.inject(NetworkStatusService);
    appRef = TestBed.inject(ApplicationRef);
    appRef.tick();
  });

  afterEach(() => {
    window.dispatchEvent(new Event('online'));
  });

  it('initialises isOnline from navigator.onLine', () => {
    expect(service.isOnline()).toBe(navigator.onLine);
  });

  it('sets isOnline to false when the window fires an offline event', () => {
    window.dispatchEvent(new Event('offline'));

    expect(service.isOnline()).toBe(false);
  });

  it('sets isOnline back to true when the window fires an online event after offline', () => {
    window.dispatchEvent(new Event('offline'));
    expect(service.isOnline()).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(service.isOnline()).toBe(true);
  });
});
