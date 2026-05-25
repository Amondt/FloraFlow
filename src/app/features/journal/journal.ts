import { Component, computed, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { FloraButtonPT, FloraToastPT } from '../../shared/ui/pt/index';
import { PlantService } from '../scheduler/plant.service';
import { JournalEntryFormComponent } from './journal-entry-form/journal-entry-form';

@Component({
  selector: 'app-journal',
  standalone: true,
  imports: [ButtonModule, ToastModule, JournalEntryFormComponent],
  providers: [MessageService],
  templateUrl: './journal.html',
})
export class JournalComponent {
  private readonly plantService = inject(PlantService);
  private readonly messageService = inject(MessageService);

  protected readonly FloraButtonPT = FloraButtonPT;
  protected readonly FloraToastPT = FloraToastPT;

  readonly dialogVisible = signal(false);
  readonly hasPlants = computed(() => this.plantService.plants().length > 0);
  readonly loading = computed(() => this.plantService.loading());

  constructor() {
    if (this.plantService.plants().length === 0) {
      void this.plantService.loadPlants();
    }
  }

  openDialog(): void {
    this.dialogVisible.set(true);
  }
}
