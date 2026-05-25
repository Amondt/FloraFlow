import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ImageCompressorService {
  compress(file: File, maxBytes = 300_000): Promise<Blob> {
    const objectUrl = URL.createObjectURL(file);

    return new Promise<Blob>((resolve, reject) => {
      const img = new Image();

      img.onerror = () => reject(new Error('Failed to load image'));

      img.onload = () => {
        this.reduceToTarget(img, img.naturalWidth, img.naturalHeight, maxBytes)
          .then(resolve)
          .catch(reject);
      };

      img.src = objectUrl;
    }).finally(() => {
      URL.revokeObjectURL(objectUrl);
    });
  }

  private reduceToTarget(
    img: HTMLImageElement,
    width: number,
    height: number,
    maxBytes: number,
  ): Promise<Blob> {
    return this.tryQualities(img, width, height, 0.85, maxBytes).then((result) => {
      if (result !== null) return result;

      const halfWidth = Math.max(1, Math.floor(width / 2));
      const halfHeight = Math.max(1, Math.floor(height / 2));

      if (halfWidth === width && halfHeight === height) {
        return this.drawToBlob(img, width, height, 0.1).then((b) => b!);
      }

      return this.reduceToTarget(img, halfWidth, halfHeight, maxBytes);
    });
  }

  private tryQualities(
    img: HTMLImageElement,
    width: number,
    height: number,
    quality: number,
    maxBytes: number,
  ): Promise<Blob | null> {
    if (quality < 0.1) return Promise.resolve(null);

    return this.drawToBlob(img, width, height, quality).then((blob) => {
      if (blob === null) return null;
      if (blob.size <= maxBytes) return blob;
      return this.tryQualities(img, width, height, quality - 0.1, maxBytes);
    });
  }

  private drawToBlob(
    img: HTMLImageElement,
    width: number,
    height: number,
    quality: number,
  ): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.resolve(null);

    ctx.drawImage(img, 0, 0, width, height);

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
  }
}
