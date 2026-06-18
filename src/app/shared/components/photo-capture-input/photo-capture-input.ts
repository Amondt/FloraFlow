import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { FLORA_FOCUS, FLORA_DISABLED } from '../../ui/pt/index';

@Component({
  selector: 'app-photo-capture-input',
  standalone: true,
  imports: [TranslocoPipe],
  templateUrl: './photo-capture-input.html',
})
export class PhotoCaptureInputComponent {
  readonly triggerLabel = input<string>('');
  readonly triggerAriaLabel = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly loading = input<boolean>(false);
  readonly fileSelected = output<File>();

  protected readonly FLORA_FOCUS = FLORA_FOCUS;
  protected readonly FLORA_DISABLED = FLORA_DISABLED;

  protected readonly cameraInputRef = viewChild<ElementRef<HTMLInputElement>>('cameraInputRef');
  protected readonly libraryInputRef = viewChild<ElementRef<HTMLInputElement>>('libraryInputRef');
  protected readonly desktopInputRef = viewChild<ElementRef<HTMLInputElement>>('desktopInputRef');

  protected triggerCameraInput(): void {
    this.cameraInputRef()?.nativeElement.click();
  }

  protected triggerLibraryInput(): void {
    this.libraryInputRef()?.nativeElement.click();
  }

  protected triggerDesktopInput(): void {
    this.desktopInputRef()?.nativeElement.click();
  }

  protected onInputChange(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    target.value = '';
    this.fileSelected.emit(file);
  }
}
