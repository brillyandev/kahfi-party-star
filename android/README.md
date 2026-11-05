# Versi Android (APK)

Pembungkus WebView untuk Kahfi Party Star. Aset web disajikan lewat origin
`https://appassets.androidplatform.net` supaya mikrofon (butuh secure context) dan
penyimpanan login tetap bekerja.

## Membangun APK

Butuh JDK 17, Android SDK build-tools 34, dan platform android-34.

```bash
npm install
npm run build:app                      # hasil di dist-app/ (path relatif)
cp -r dist-app/. android/project/assets/www/
cd android && ./build-apk.sh
```

Hasilnya `android/kahfi-party-star.apk`, sudah ditandatangani dengan `kps.keystore`
(dibuat otomatis saat build pertama).

## Mengatur server di dalam aplikasi

Saat pertama dibuka, di halaman login ada tautan *Server: belum diatur*.
Ketuk, isi alamat server (misal `https://xxxx.app.github.dev`), lalu aplikasi memuat ulang.
Alamat tersimpan di perangkat.
