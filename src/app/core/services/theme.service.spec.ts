import { TestBed } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from './theme.service';

function mockMatchMedia(matches: boolean): void {
  window.matchMedia = vi.fn().mockReturnValue({
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
}

async function createService(): Promise<{ service: ThemeService; appRef: ApplicationRef }> {
  await TestBed.configureTestingModule({ providers: [ThemeService] }).compileComponents();
  const service = TestBed.inject(ThemeService);
  const appRef = TestBed.inject(ApplicationRef);
  appRef.tick();
  return { service, appRef };
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    mockMatchMedia(false);
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  // ── preference initialization ─────────────────────────────────────────────

  describe('preference initialization', () => {
    it('defaults to system when localStorage is empty', async () => {
      const { service } = await createService();
      expect(service.preference()).toBe('system');
    });

    it('reads "dark" when stored in localStorage', async () => {
      localStorage.setItem('flora-theme', 'dark');
      const { service } = await createService();
      expect(service.preference()).toBe('dark');
    });

    it('reads "light" when stored in localStorage', async () => {
      localStorage.setItem('flora-theme', 'light');
      const { service } = await createService();
      expect(service.preference()).toBe('light');
    });

    it('falls back to system for an unrecognised stored value', async () => {
      localStorage.setItem('flora-theme', 'invalid-value');
      const { service } = await createService();
      expect(service.preference()).toBe('system');
    });
  });

  // ── resolvedTheme computed ────────────────────────────────────────────────

  describe('resolvedTheme', () => {
    it('resolves to light when preference is explicitly light', async () => {
      const { service } = await createService();
      service.setPreference('light');
      expect(service.resolvedTheme()).toBe('light');
    });

    it('resolves to dark when preference is explicitly dark', async () => {
      const { service } = await createService();
      service.setPreference('dark');
      expect(service.resolvedTheme()).toBe('dark');
    });

    it('resolves to dark when preference is system and OS prefers dark', async () => {
      mockMatchMedia(true);
      const { service } = await createService();
      expect(service.resolvedTheme()).toBe('dark');
    });

    it('resolves to light when preference is system and OS prefers light', async () => {
      // mockMatchMedia(false) already set in beforeEach
      const { service } = await createService();
      expect(service.resolvedTheme()).toBe('light');
    });
  });

  // ── toggle() ─────────────────────────────────────────────────────────────

  describe('toggle()', () => {
    it('switches light → dark', async () => {
      const { service } = await createService();
      service.setPreference('light');
      service.toggle();
      expect(service.preference()).toBe('dark');
    });

    it('switches dark → light', async () => {
      const { service } = await createService();
      service.setPreference('dark');
      service.toggle();
      expect(service.preference()).toBe('light');
    });

    it('switches system-resolved-light → dark', async () => {
      // system + OS light (mocked false) → resolvedTheme = 'light'
      const { service } = await createService();
      service.setPreference('system');
      service.toggle();
      expect(service.preference()).toBe('dark');
    });

    it('switches system-resolved-dark → light', async () => {
      mockMatchMedia(true);
      const { service } = await createService();
      service.setPreference('system');
      service.toggle();
      expect(service.preference()).toBe('light');
    });
  });

  // ── effect: DOM class ─────────────────────────────────────────────────────

  describe('effect — .dark class on <html>', () => {
    it('adds .dark when resolved theme is dark', async () => {
      const { service, appRef } = await createService();
      service.setPreference('dark');
      appRef.tick();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes .dark when resolved theme is light', async () => {
      document.documentElement.classList.add('dark');
      const { service, appRef } = await createService();
      service.setPreference('light');
      appRef.tick();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('does not add .dark when system resolves to light', async () => {
      // OS = light (mocked false), preference = system
      await createService();
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('adds .dark when system resolves to dark', async () => {
      mockMatchMedia(true);
      await createService();
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  // ── effect: localStorage persistence ─────────────────────────────────────

  describe('effect — localStorage persistence', () => {
    it('writes "dark" to localStorage when preference is dark', async () => {
      const { service, appRef } = await createService();
      service.setPreference('dark');
      appRef.tick();
      expect(localStorage.getItem('flora-theme')).toBe('dark');
    });

    it('writes "light" to localStorage when preference is light', async () => {
      const { service, appRef } = await createService();
      service.setPreference('light');
      appRef.tick();
      expect(localStorage.getItem('flora-theme')).toBe('light');
    });

    it('removes flora-theme key when preference is system', async () => {
      const { service, appRef } = await createService();
      service.setPreference('dark');
      appRef.tick();
      service.setPreference('system');
      appRef.tick();
      expect(localStorage.getItem('flora-theme')).toBeNull();
    });

    it('does not store anything when preference stays system', async () => {
      await createService();
      expect(localStorage.getItem('flora-theme')).toBeNull();
    });
  });
});
