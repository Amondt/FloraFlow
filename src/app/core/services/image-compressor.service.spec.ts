import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImageCompressorService } from './image-compressor.service';

function makeFile(name = 'test.jpg'): File {
  return new File(['placeholder'], name, { type: 'image/jpeg' });
}

function makeBlob(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
}

class MockImage {
  onload: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  naturalWidth = 1000;
  naturalHeight = 800;

  set src(_url: string) {
    Promise.resolve().then(() => this.onload?.());
  }
}

describe('ImageCompressorService [BUGS]', () => {
  let service: ImageCompressorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImageCompressorService);

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });

    vi.stubGlobal('Image', MockImage);

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('Test 1: file already under 300KB — returns blob in a single draw, no quality iteration', async () => {
    let drawCount = 0;

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      drawCount++;
      callback(makeBlob(100_000));
    });

    const result = await service.compress(makeFile());

    expect(result.size).toBe(100_000);
    expect(drawCount).toBe(1);
  });

  it('Test 2: large file — quality steps down until result fits under 300KB', async () => {
    let callCount = 0;

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      callCount++;
      // First two attempts overshoot; third fits
      const size = callCount <= 2 ? 400_000 : 200_000;
      callback(makeBlob(size));
    });

    const result = await service.compress(makeFile());

    expect(result.size).toBeLessThanOrEqual(300_000);
    expect(callCount).toBe(3);
  });

  it('Test 3: extreme file — all qualities fail at full size, dimension halving produces a passing blob', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      // Blobs at full width (1000) are always oversized; halved canvas (500) fits
      const size = this.width > 500 ? 400_000 : 200_000;
      callback(makeBlob(size));
    });

    const result = await service.compress(makeFile());

    expect(result.size).toBeLessThanOrEqual(300_000);
  });

  it('revokeObjectURL is always called — even when compression fails', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
    ) {
      callback(null);
    });

    await service.compress(makeFile()).catch(() => undefined);

    expect((URL.revokeObjectURL as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('blob:mock-url');
  });
});
