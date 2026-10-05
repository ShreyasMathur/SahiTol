/**
 * Reads an image file and downsizes it in the browser before upload, so a
 * 12 MP phone photo becomes a few hundred KB.
 */
export function resizeImage(file, { maxWidth = 1600, maxHeight = 1600, type = 'image/jpeg', quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type)) {
      reject(new Error('Choose a PNG or JPEG image'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (type === 'image/jpeg') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL(type, quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}
