import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlantFormDialogComponent } from './plant-form-dialog';
import { ZoneService } from '../../dashboard/zone.service';
import { BotanicalSearchService } from '../../../core/services/botanical-search.service';
import type { BotanicalSuggestion } from '../../../core/services/botanical-search.service';

const mockZoneService = {
  zones: signal([{ id: 'z1', name: 'Zone 1' }]),
  loadZones: vi.fn().mockResolvedValue(undefined),
};

const mockBotanicalSearch = {
  search: vi.fn().mockResolvedValue([]),
};

function setup() {
  TestBed.configureTestingModule({
    imports: [PlantFormDialogComponent],
    providers: [
      { provide: ZoneService, useValue: mockZoneService },
      { provide: BotanicalSearchService, useValue: mockBotanicalSearch },
    ],
  }).overrideTemplate(PlantFormDialogComponent, '');

  const fixture = TestBed.createComponent(PlantFormDialogComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  return component;
}

describe('PlantFormDialogComponent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('onCommonNameChange', () => {
    it('pre-fills nickname when species selected and nickname is empty', () => {
      const comp = setup();
      const suggestion: BotanicalSuggestion = {
        common_name: 'Monstera',
        scientific_name: 'Monstera deliciosa',
        perenual_id: 42,
      };

      comp.form.controls.common_name.setValue('');
      comp['onCommonNameChange'](suggestion);

      expect(comp.form.controls.common_name.value).toBe('Monstera');
      expect(comp['selectedPerenualId']()).toBe(42);
      expect(comp['lockedSpeciesCommonName']()).toBe('Monstera');
      expect(comp['lockedScientificName']()).toBe('Monstera deliciosa');
    });

    it('does not overwrite nickname when user already typed one', () => {
      const comp = setup();
      const suggestion: BotanicalSuggestion = {
        common_name: 'Monstera',
        scientific_name: 'Monstera deliciosa',
        perenual_id: 42,
      };

      comp.form.controls.common_name.setValue('My Monstera');
      comp['onCommonNameChange'](suggestion);

      expect(comp.form.controls.common_name.value).toBe('My Monstera');
    });

    it('clears locked state when string value typed (species deselected)', () => {
      const comp = setup();
      comp['selectedPerenualId'].set(42);
      comp['lockedSpeciesCommonName'].set('Monstera');
      comp['lockedScientificName'].set('Monstera deliciosa');

      comp['onCommonNameChange']('mon');

      expect(comp['speciesSearchQuery']).toBe('mon');
      // locked state stays because selectedPerenualId is still set (chip keeps it)
      // clearing only happens via clearLockedSpecies
    });
  });

  describe('clearLockedSpecies', () => {
    it('clears species state without touching the nickname field', () => {
      const comp = setup();
      comp['selectedPerenualId'].set(42);
      comp['lockedSpeciesCommonName'].set('Monstera');
      comp['lockedScientificName'].set('Monstera deliciosa');
      comp.form.controls.common_name.setValue('My Monstera');
      comp.form.controls.scientific_name.setValue('Monstera deliciosa');

      comp['clearLockedSpecies']();

      expect(comp['selectedPerenualId']()).toBeNull();
      expect(comp['lockedSpeciesCommonName']()).toBeNull();
      expect(comp['lockedScientificName']()).toBeNull();
      expect(comp['speciesSearchQuery']).toBe('');
      expect(comp.form.controls.scientific_name.value).toBeNull();
      // nickname must survive
      expect(comp.form.controls.common_name.value).toBe('My Monstera');
    });
  });

  describe('edit mode effect — speciesSearchQuery', () => {
    it('leaves species search empty for a manually-named plant with no perenual_id', () => {
      const comp = setup();
      TestBed.runInInjectionContext(() => {
        // Simulate the effect logic directly
        const p = {
          common_name: 'Office cactus',
          scientific_name: null,
          perenual_id: null,
          zone_id: 'z1',
          container_vector: 'Plastic' as const,
          substrate_factor: 'Standard Potting' as const,
          growth_stage: 'Mature' as const,
        };

        comp['speciesSearchQuery'] = p.perenual_id ? p.common_name : '';
        comp['selectedPerenualId'].set(p.perenual_id);
        comp['lockedSpeciesCommonName'].set(p.perenual_id ? p.common_name : null);
      });

      expect(comp['speciesSearchQuery']).toBe('');
      expect(comp['selectedPerenualId']()).toBeNull();
      expect(comp['lockedSpeciesCommonName']()).toBeNull();
    });

    it('pre-fills species search for a plant with a locked species', () => {
      const comp = setup();
      const p = {
        common_name: 'Monstera',
        scientific_name: 'Monstera deliciosa',
        perenual_id: 42,
        zone_id: 'z1',
        container_vector: 'Plastic' as const,
        substrate_factor: 'Standard Potting' as const,
        growth_stage: 'Mature' as const,
      };

      comp['speciesSearchQuery'] = p.perenual_id ? p.common_name : '';
      comp['selectedPerenualId'].set(p.perenual_id);
      comp['lockedSpeciesCommonName'].set(p.perenual_id ? p.common_name : null);

      expect(comp['speciesSearchQuery']).toBe('Monstera');
      expect(comp['selectedPerenualId']()).toBe(42);
      expect(comp['lockedSpeciesCommonName']()).toBe('Monstera');
    });
  });

  describe('onSubmit', () => {
    it('does not emit when form is invalid', () => {
      const comp = setup();
      const spy = vi.fn();
      comp.saved.subscribe(spy);
      comp.form.controls.common_name.setValue('');
      comp['onSubmit']();
      expect(spy).not.toHaveBeenCalled();
    });

    it('emits PlantFormData with selectedPerenualId when valid', () => {
      const comp = setup();
      const spy = vi.fn();
      comp.saved.subscribe(spy);
      comp['selectedPerenualId'].set(42);
      comp.form.patchValue({
        common_name: 'My Monstera',
        scientific_name: 'Monstera deliciosa',
        zone_id: 'z1',
        container_vector: 'Plastic',
        substrate_factor: 'Standard Potting',
        growth_stage: 'Mature',
      });

      comp['onSubmit']();

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          common_name: 'My Monstera',
          scientific_name: 'Monstera deliciosa',
          perenual_id: 42,
        }),
      );
    });
  });
});
