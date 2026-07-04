/**
 * Client-side utility to resize and compress base64 images before upload.
 * Reduces memory usage and network overhead.
 */

export interface CompressionResult {
  compressedBase64: string;
  originalSizeKB: number;
  compressedSizeKB: number;
  savingsPercent: number;
  width: number;
  height: number;
}

/**
 * Calculates base64 approximate size in Kilobytes.
 */
export function getBase64SizeKB(base64String: string): number {
  if (!base64String) return 0;
  const padding = base64String.endsWith("==") ? 2 : base64String.endsWith("=") ? 1 : 0;
  const base64Content = base64String.split(",")[1] || base64String;
  const bytes = (base64Content.length * 3) / 4 - padding;
  return Math.round((bytes / 1024) * 10) / 10;
}

/**
 * Resizes and compresses an image DataURL (base64).
 */
export function compressAndResizeImage(
  base64Str: string,
  maxWidth: number = 1000,
  maxHeight: number = 1000,
  quality: number = 0.75
): Promise<CompressionResult> {
  return new Promise((resolve) => {
    const originalSizeKB = getBase64SizeKB(base64Str);
    
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Apply constraints
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback
        resolve({
          compressedBase64: base64Str,
          originalSizeKB,
          compressedSizeKB: originalSizeKB,
          savingsPercent: 0,
          width: img.width,
          height: img.height,
        });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      // Export as jpeg with quality factor (0.0 to 1.0)
      const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
      const compressedSizeKB = getBase64SizeKB(compressedBase64);
      
      const savingsPercent = originalSizeKB > 0 
        ? Math.max(0, Math.round(((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100))
        : 0;

      resolve({
        compressedBase64,
        originalSizeKB,
        compressedSizeKB,
        savingsPercent,
        width,
        height,
      });
    };

    img.onerror = () => {
      // Fallback on error
      resolve({
        compressedBase64: base64Str,
        originalSizeKB,
        compressedSizeKB: originalSizeKB,
        savingsPercent: 0,
        width: 0,
        height: 0,
      });
    };
  });
}
