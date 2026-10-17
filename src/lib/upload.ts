// تجهيز الملفات قبل الرفع: صور الجوال (3–8 ميجابايت) تُصغَّر في المتصفح، فيبقى
// الطلب كله دون حدّ الاستضافة المجانية (4.5 ميجابايت للطلب في Vercel). الخادم
// يعيد ترميز الصورة ويحذف بياناتها الوصفية في كل الأحوال.

export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

export const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('ar', { maximumFractionDigits: 1 })} ميجابايت`;

export async function shrinkImage(file: File, maxSide = 2000, quality = 0.85): Promise<File> {
  if (!/^image\/(jpeg|png)$/.test(file.type) || file.size < 900_000 || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
