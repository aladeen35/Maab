// أيقونات تطبيق أندرويد وصورة البداية وأيقونة الإشعار من ملفات الشعار نفسها:
// npm run android:icons — النتائج تُحفظ في المستودع (android/app/src/main/res)
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';

const RES = 'android/app/src/main/res';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const GREEN = '#0E3D31';

const out = async (dir, name, img) => {
  mkdirSync(`${RES}/${dir}`, { recursive: true });
  await img.png({ compressionLevel: 9 }).toFile(`${RES}/${dir}/${name}.png`);
};

const circle = (size) => Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`);

/** صورة بيضاء من شفافية القوس (أيقونات الإشعار يجب أن تكون بيضاء على شفاف) */
async function silhouette(size) {
  const pad = Math.round(size * 0.08);
  const inner = size - pad * 2;
  const alpha = await sharp('public/brand/arch.png').resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).extractChannel('alpha').toBuffer();
  const white = await sharp({ create: { width: inner, height: inner, channels: 3, background: '#ffffff' } }).joinChannel(alpha).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: white, top: pad, left: pad }]);
}

for (const [d, k] of Object.entries(DENSITIES)) {
  const legacy = Math.round(48 * k);
  await out(`mipmap-${d}`, 'ic_launcher', sharp('public/icons/icon-512.png').resize(legacy, legacy));
  const round = await sharp('public/icons/icon-512-maskable.png').resize(legacy, legacy).composite([{ input: circle(legacy), blend: 'dest-in' }]).png().toBuffer();
  await out(`mipmap-${d}`, 'ic_launcher_round', sharp(round));
  const fg = Math.round(108 * k);
  await out(`mipmap-${d}`, 'ic_launcher_foreground', sharp('public/icons/icon-512-maskable.png').resize(fg, fg));
  await out(`drawable-${d}`, 'ic_notification_icon', await silhouette(Math.round(24 * k)));
}

await out('drawable-xxxhdpi', 'splash', sharp('public/brand/logo-full.png').resize(576, 576, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }));

mkdirSync(`${RES}/mipmap-anydpi-v26`, { recursive: true });
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/iconBackground" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher.xml`, adaptive);
writeFileSync(`${RES}/mipmap-anydpi-v26/ic_launcher_round.xml`, adaptive);
mkdirSync(`${RES}/values`, { recursive: true });
writeFileSync(`${RES}/values/colors.xml`, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="iconBackground">${GREEN}</color>\n</resources>\n`);

// شارة الإشعار في المتصفح وتطبيق أندرويد
await (await silhouette(96)).toFile('public/icons/badge-96.png');
console.log('✓ أيقونات أندرويد وصورة البداية وأيقونة الإشعار');
