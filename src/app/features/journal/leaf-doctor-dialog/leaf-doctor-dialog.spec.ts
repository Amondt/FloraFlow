import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { LeafDoctorDialogComponent } from './leaf-doctor-dialog';
import { PlantService } from '../../tasks/plant.service';
import { ZoneService } from '../../dashboard/zone.service';
import { JournalService } from '../journal.service';
import { LibraryService } from '../../library/library.service';
import { ImageCompressorService } from '../../../core/services/image-compressor.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { MessageService } from 'primeng/api';

describe('LeafDoctorDialogComponent — photo signals and computed gates', () => {
  let fixture: ComponentFixture<LeafDoctorDialogComponent>;
  let component: LeafDoctorDialogComponent;

  beforeEach(async () => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn().mockReturnValue('blob:mock'),
      revokeObjectURL: vi.fn(),
    });

    await TestBed.configureTestingModule({
      imports: [LeafDoctorDialogComponent],
      providers: [
        { provide: PlantService, useValue: { plants: signal([]) } },
        { provide: ZoneService, useValue: { zones: signal([]) } },
        {
          provide: JournalService,
          useValue: {
            uploadImage: vi.fn().mockResolvedValue('path/img.jpg'),
            createEntry: vi.fn().mockResolvedValue({}),
          },
        },
        {
          provide: LibraryService,
          useValue: { refetchByScientificNames: vi.fn().mockResolvedValue([]) },
        },
        { provide: ImageCompressorService, useValue: { compress: vi.fn() } },
        {
          provide: SupabaseService,
          useValue: {
            client: { functions: { invoke: vi.fn() }, auth: { getUser: vi.fn() } },
            getUser: vi.fn(),
          },
        },
        { provide: MessageService, useValue: { add: vi.fn() } },
      ],
    })
      .overrideTemplate(LeafDoctorDialogComponent, '')
      .compileComponents();

    fixture = TestBed.createComponent(LeafDoctorDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── hasPhotos ────────────────────────────────────────────────────────────────

  describe('hasPhotos', () => {
    it('is false when no blobs are loaded', () => {
      expect(component['hasPhotos']()).toBe(false);
    });

    it('is true when at least one blob is loaded', () => {
      component.compressedBlobs.set([new Blob()]);
      fixture.detectChanges();
      expect(component['hasPhotos']()).toBe(true);
    });
  });

  // ── canAddPhoto ──────────────────────────────────────────────────────────────

  describe('canAddPhoto', () => {
    it('is true when fewer than 3 blobs are loaded', () => {
      component.compressedBlobs.set([new Blob(), new Blob()]);
      fixture.detectChanges();
      expect(component['canAddPhoto']()).toBe(true);
    });

    it('is false when exactly 3 blobs are loaded', () => {
      component.compressedBlobs.set([new Blob(), new Blob(), new Blob()]);
      fixture.detectChanges();
      expect(component['canAddPhoto']()).toBe(false);
    });
  });

  // ── primaryActionDisabled ────────────────────────────────────────────────────

  describe('primaryActionDisabled', () => {
    it('is true while compression is in progress, regardless of photo count', () => {
      component.compressedBlobs.set([new Blob()]);
      component.isCompressing.set(true);
      fixture.detectChanges();
      expect(component['primaryActionDisabled']()).toBe(true);
    });

    it('is true when diagnosisState is loading', () => {
      component.compressedBlobs.set([new Blob()]);
      component.diagnosisState.set('loading');
      fixture.detectChanges();
      expect(component['primaryActionDisabled']()).toBe(true);
    });

    it('is true in success state when no plant is selected (canSave is false)', () => {
      component.compressedBlobs.set([new Blob()]);
      component.diagnosisState.set('success');
      component.selectedPlantId.set(null);
      fixture.detectChanges();
      expect(component['primaryActionDisabled']()).toBe(true);
    });

    it('is false in success state when a plant is selected and photos are loaded', () => {
      component.compressedBlobs.set([new Blob()]);
      component.diagnosisState.set('success');
      component.selectedPlantId.set('plant-1');
      fixture.detectChanges();
      expect(component['primaryActionDisabled']()).toBe(false);
    });

    it('is true in idle state with no photos loaded', () => {
      component.diagnosisState.set('idle');
      component.compressedBlobs.set([]);
      fixture.detectChanges();
      expect(component['primaryActionDisabled']()).toBe(true);
    });

    it('is false in idle state once a photo is loaded and a plant is selected', () => {
      component.diagnosisState.set('idle');
      component.compressedBlobs.set([new Blob()]);
      component.selectedPlantId.set('plant-1');
      fixture.detectChanges();
      expect(component['primaryActionDisabled']()).toBe(false);
    });
  });

  // ── canSave ──────────────────────────────────────────────────────────────────

  describe('canSave', () => {
    it('requires a plant, success state, and at least one photo', () => {
      component.selectedPlantId.set('plant-1');
      component.diagnosisState.set('success');
      component.compressedBlobs.set([new Blob()]);
      fixture.detectChanges();
      expect(component['canSave']()).toBe(true);
    });

    it('is false when no plant is selected', () => {
      component.selectedPlantId.set(null);
      component.diagnosisState.set('success');
      component.compressedBlobs.set([new Blob()]);
      fixture.detectChanges();
      expect(component['canSave']()).toBe(false);
    });

    it('is false when diagnosisState is not success', () => {
      component.selectedPlantId.set('plant-1');
      component.diagnosisState.set('idle');
      component.compressedBlobs.set([new Blob()]);
      fixture.detectChanges();
      expect(component['canSave']()).toBe(false);
    });
  });

  // ── removePhoto ──────────────────────────────────────────────────────────────

  describe('removePhoto(index)', () => {
    beforeEach(() => {
      const blobA = new Blob(['a']);
      const blobB = new Blob(['b']);
      component.compressedBlobs.set([blobA, blobB]);
      component.previewObjectUrls.set(['blob:url-a', 'blob:url-b']);
      component.compressedLabels.set(['1 KB', '2 KB']);
      component.diagnosisState.set('success');
      fixture.detectChanges();
    });

    it('removes the item at the given index from all three arrays', () => {
      component['removePhoto'](0);
      fixture.detectChanges();

      expect(component.compressedBlobs().length).toBe(1);
      expect(component.previewObjectUrls()).toEqual(['blob:url-b']);
      expect(component.compressedLabels()).toEqual(['2 KB']);
    });

    it('revokes the object URL for the removed photo', () => {
      component['removePhoto'](0);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-a');
    });

    it('resets diagnosisState to idle after removal', () => {
      component['removePhoto'](0);
      expect(component.diagnosisState()).toBe('idle');
    });

    it('clears diagnosisResult after removal', () => {
      component.diagnosisResult.set({
        primary_condition: 'Root Rot',
        confidence_score: 0.9,
        immediate_remedial_actions: [],
        systemic_risk_assessment: 'Isolated',
      });
      component['removePhoto'](0);
      expect(component.diagnosisResult()).toBeNull();
    });

    it('is a no-op for an out-of-bounds index', () => {
      component['removePhoto'](99);
      fixture.detectChanges();
      // arrays untouched — no crash
      expect(component.compressedBlobs().length).toBe(2);
    });
  });
});
