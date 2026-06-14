import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { provideTranslocoTesting } from '../../../testing/transloco-testing';
import { JournalEntryFormComponent } from './journal-entry-form';
import { JournalService, type JournalEntryWithPlant } from '../journal.service';
import { PlantService } from '../../tasks/plant.service';
import { ZoneService } from '../../dashboard/zone.service';
import { PlantThumbnailService } from '../../../core/services/plant-thumbnail.service';
import { MessageService } from 'primeng/api';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ImageCompressorService } from '../../../core/services/image-compressor.service';

const EDIT_ENTRY: JournalEntryWithPlant = {
  id: 'entry-1',
  user_id: 'user-1',
  plant_id: 'plant-1',
  category: 'Observation',
  notes: 'Leaves healthy',
  logged_at: '2024-06-01T12:00:00Z',
  image_storage_path: null,
  diagnostics: null,
  diagnostics_i18n: null,
  created_at: '2024-06-01T12:00:00Z',
  updated_at: '2024-06-01T12:00:00Z',
  plants: { common_name: 'Monstera', scientific_name: null },
};

describe('JournalEntryFormComponent — onSubmit() branching', () => {
  let fixture: ComponentFixture<JournalEntryFormComponent>;
  let component: JournalEntryFormComponent;
  let mockUpdateEntry: ReturnType<typeof vi.fn>;
  let mockCreateEntry: ReturnType<typeof vi.fn>;
  let mockMessageAdd: ReturnType<typeof vi.fn>;
  let mockGetUser: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockUpdateEntry = vi.fn().mockResolvedValue(undefined);
    mockCreateEntry = vi.fn().mockResolvedValue({ id: 'new-id' });
    mockMessageAdd = vi.fn();
    mockGetUser = vi.fn().mockResolvedValue({ id: 'user-1' });

    await TestBed.configureTestingModule({
      imports: [JournalEntryFormComponent],
      providers: [
        ...provideTranslocoTesting(),
        {
          provide: JournalService,
          useValue: {
            updateEntry: mockUpdateEntry,
            createEntry: mockCreateEntry,
            uploadImage: vi.fn().mockResolvedValue('path/img.jpg'),
            entries: signal([]),
          },
        },
        {
          provide: PlantService,
          useValue: { plants: signal([]), loading: signal(false) },
        },
        { provide: MessageService, useValue: { add: mockMessageAdd } },
        { provide: SupabaseService, useValue: { getUser: mockGetUser } },
        { provide: ImageCompressorService, useValue: { compress: vi.fn() } },
        { provide: ZoneService, useValue: { zones: signal([]), loadZones: vi.fn() } },
        {
          provide: PlantThumbnailService,
          useValue: { getThumbnailUrl: vi.fn().mockReturnValue(null) },
        },
      ],
    })
      .overrideTemplate(JournalEntryFormComponent, '')
      .compileComponents();

    fixture = TestBed.createComponent(JournalEntryFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fillValidForm(): void {
    component.form.setValue({
      plant_id: 'plant-1',
      category: 'Observation',
      notes: 'Test notes',
      logged_at: null,
    });
  }

  describe('edit mode (editEntry input set)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('editEntry', EDIT_ENTRY);
      fixture.detectChanges();
    });

    it('calls updateEntry with the entry id and form values', async () => {
      fillValidForm();
      await component.onSubmit();

      expect(mockUpdateEntry).toHaveBeenCalledWith('entry-1', {
        category: 'Observation',
        notes: 'Test notes',
        logged_at: EDIT_ENTRY.logged_at,
      });
    });

    it('does not call createEntry', async () => {
      fillValidForm();
      await component.onSubmit();

      expect(mockCreateEntry).not.toHaveBeenCalled();
    });

    it('adds a success toast on successful update', async () => {
      fillValidForm();
      await component.onSubmit();

      expect(mockMessageAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'Entry updated' }),
      );
    });

    it('adds an error toast when updateEntry rejects', async () => {
      mockUpdateEntry.mockRejectedValue(new Error('network failure'));
      fillValidForm();
      await component.onSubmit();

      expect(mockMessageAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', summary: 'Failed to update entry' }),
      );
    });
  });

  describe('create mode (no editEntry)', () => {
    it('calls createEntry and does not call updateEntry', async () => {
      fillValidForm();
      await component.onSubmit();

      expect(mockCreateEntry).toHaveBeenCalled();
      expect(mockUpdateEntry).not.toHaveBeenCalled();
    });

    it('adds a success toast on successful create', async () => {
      fillValidForm();
      await component.onSubmit();

      expect(mockMessageAdd).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'Entry logged' }),
      );
    });

    it('does not submit when the form is invalid', async () => {
      // leave form empty — plant_id and category are required
      await component.onSubmit();

      expect(mockCreateEntry).not.toHaveBeenCalled();
      expect(mockUpdateEntry).not.toHaveBeenCalled();
    });
  });
});
