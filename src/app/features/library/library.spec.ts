import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { LibraryComponent } from './library';
import { LibraryService, PAGE_SIZE } from './library.service';
import { PlantService } from '../scheduler/plant.service';

describe('LibraryComponent – pageItems', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LibraryComponent],
      providers: [
        provideRouter([]),
        {
          provide: LibraryService,
          useValue: {
            browse: vi.fn().mockResolvedValue({ data: [], count: 0 }),
            search: vi.fn().mockResolvedValue({ data: [], count: 0 }),
            refetchByScientificNames: vi.fn().mockResolvedValue([]),
            triggerEnrichment: vi.fn().mockResolvedValue(undefined),
            fetchByScientificName: vi.fn().mockResolvedValue(null),
          },
        },
        {
          provide: PlantService,
          useValue: {
            plants: signal([]),
            createPlant: vi.fn().mockResolvedValue(null),
            error: signal<string | null>(null),
            loadPlants: vi.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideTemplate(LibraryComponent, '')
      .compileComponents();
  });

  function create() {
    const fixture = TestBed.createComponent(LibraryComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('returns a single item for 1 page', () => {
    const c = create();
    c.totalCount.set(PAGE_SIZE);
    c.currentPage.set(0);
    expect(c.pageItems()).toEqual([0]);
  });

  it('shows all page indices when total ≤ 7', () => {
    const c = create();
    c.totalCount.set(3 * PAGE_SIZE);
    c.currentPage.set(0);
    expect(c.pageItems()).toEqual([0, 1, 2]);
  });

  it('inserts ellipsis after window and keeps first + last page (page 0 of 10)', () => {
    const c = create();
    c.totalCount.set(10 * PAGE_SIZE);
    c.currentPage.set(0);
    const items = c.pageItems();
    expect(items[0]).toBe(0);
    expect(items).toContain(1);
    expect(items).toContain(2);
    expect(items).toContain('ellipsis');
    expect(items[items.length - 1]).toBe(9);
  });

  it('inserts ellipsis on both sides on a middle page (page 4 of 10)', () => {
    const c = create();
    c.totalCount.set(10 * PAGE_SIZE);
    c.currentPage.set(4);
    const items = c.pageItems();
    expect(items[0]).toBe(0);
    expect(items[1]).toBe('ellipsis');
    expect(items).toContain(2);
    expect(items).toContain(4);
    expect(items).toContain(6);
    expect(items[items.length - 2]).toBe('ellipsis');
    expect(items[items.length - 1]).toBe(9);
  });

  it('inserts ellipsis before window on last page (page 9 of 10)', () => {
    const c = create();
    c.totalCount.set(10 * PAGE_SIZE);
    c.currentPage.set(9);
    const items = c.pageItems();
    expect(items[0]).toBe(0);
    expect(items[1]).toBe('ellipsis');
    expect(items[items.length - 3]).toBe(7);
    expect(items[items.length - 2]).toBe(8);
    expect(items[items.length - 1]).toBe(9);
  });

  it('always includes page 0 and last page for every current page', () => {
    const c = create();
    c.totalCount.set(15 * PAGE_SIZE);
    for (let p = 0; p < 15; p++) {
      c.currentPage.set(p);
      const items = c.pageItems();
      expect(items[0], `page ${p}: first item should be 0`).toBe(0);
      expect(items[items.length - 1], `page ${p}: last item should be 14`).toBe(14);
    }
  });

  it('never places two ellipses consecutively for any page', () => {
    const c = create();
    c.totalCount.set(20 * PAGE_SIZE);
    for (let p = 0; p < 20; p++) {
      c.currentPage.set(p);
      const items = c.pageItems();
      for (let i = 0; i < items.length - 1; i++) {
        expect(
          items[i] === 'ellipsis' && items[i + 1] === 'ellipsis',
          `page ${p}: consecutive ellipses at index ${i}`,
        ).toBe(false);
      }
    }
  });

  it('current page is always present in the items list', () => {
    const c = create();
    c.totalCount.set(10 * PAGE_SIZE);
    for (let p = 0; p < 10; p++) {
      c.currentPage.set(p);
      expect(c.pageItems()).toContain(p);
    }
  });
});
