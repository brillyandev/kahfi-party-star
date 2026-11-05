# Kahfi Party Star 🎙️👑

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/brillyandev/kahfi-party-star)

Aplikasi **voice room** sosial dengan sistem koin, gift, CP, ranking, VIP/SVIP, dan toko aset
yang dikelola langsung oleh Developer. Tampilan hijau-emas, dioptimalkan untuk ponsel.

## Fitur

- **Voice room real-time** (WebRTC mesh + signaling Socket.IO), 8 kursi bicara per room
- **Gift di dalam room** dengan animasi PNG, WEBP, SVG, dan **SVGA** (benar-benar diputar lewat `svgaplayerweb`)
- **Toko aset**: bingkai avatar, efek, lencana, efek masuk room, dan gift
- **CP (pasangan)**: ajukan, terima, keintiman naik saat saling kirim gift, papan top CP
- **Ranking**: top penerima gift, top pengirim, pesona, kekayaan, keaktifan (harian/mingguan/bulanan)
- **VIP & SVIP** 3 tingkat, bonus klaim harian lebih besar
- **Klaim harian 500.000 koin** dengan streak
- **Bonus pendaftaran 10.000.000 koin** untuk setiap user baru
- **Dompet**: koin, diamond, dan riwayat transaksi
- **Pesan langsung** antar pengguna + pencarian UID/username/room
- **Pusat staf** sesuai peran

## Peran & izin

| Peran | Kemampuan |
| --- | --- |
| `user` | Ikut room, kirim gift, beli item, klaim harian |
| `coin_seller` | Semua user + menjual koin **dari saldonya sendiri** |
| `admin` | Moderasi: blokir pengguna, lihat statistik, tutup room |
| `super_admin` | Admin + mengubah peran (user, coin_seller, admin), memberi VIP/SVIP, banner, audit |
| `developer` | Penuh: unggah aset toko, cetak/kurangi koin, semua akses super admin |

Aturan hierarki: seseorang tidak dapat mengubah pengguna dengan peran setara atau lebih tinggi,
dan hanya Developer yang dapat membuat Developer.

## Versi website statis (tanpa Render)

Frontend bisa di-build jadi situs statis murni dan ditaruh di hosting apa pun
(GitHub Pages, Netlify, Cloudflare Pages, atau dibungkus jadi APK).

```bash
npm run build          # hasil ada di dist/
```

Hasil `dist/` hanya HTML, JS, ikon, dan `config.js`. Alamat server API bisa diubah
tanpa build ulang, cukup edit `config.js` di hasil build:

```js
window.__KPS_API__ = "https://alamat-server-kamu.com";
```

Kosongkan `""` kalau website dan server satu domain.

Catatan penting: tampilan, login, koin, gift, dan suara tetap butuh server Node yang
hidup. Situs statis sendirian hanya menampilkan halamannya.

## Jalan tanpa Render

1. **GitHub Codespaces** (tanpa kartu, kuota gratis). Dari halaman repo klik *Code* →
   *Codespaces* → *Create codespace*. Repo ini sudah punya `.devcontainer` yang otomatis
   menjalankan `npm install` dan `npm run dev`. Port 5173 dibuka publik, jadi alamat
   `https://xxxx-5173.app.github.dev` bisa langsung dibuka di HP dan dipasang sebagai PWA.
   Catatan: Codespace berhenti sendiri saat tidak dipakai, jadi cocok untuk uji coba.
2. **VPS atau panel sendiri** (Vultr, Contabo, Hostinger, dsb). Pakai Docker:

```bash
docker build -t kahfi-party-star .
docker run -d -p 3001:3001 -e DEV_PASSWORD=Dermawan123 \
  -v kahfi-data:/app/data -v kahfi-up:/app/uploads kahfi-party-star
```

   Lalu pasang reverse proxy (Nginx/Caddy) untuk HTTPS. Ini pilihan paling stabil
   karena WebSocket dan SQLite jalan permanen.
3. **Hosting Node lain** seperti Railway, Koyeb, atau Fly.io. Caranya sama seperti
   Render: build `npm install && npm run build`, start `npm start`, dan pasang disk
   permanen di `/app/data`.

## Versi Android (APK)

Sudah tersedia pembungkus WebView di folder `android/`. Rilis APK siap pasang ada di
halaman Releases repo ini. Cara membangun ulang: lihat `android/README.md`.

## Pasang di HP (PWA)

Aplikasi ini sudah berupa **PWA**, jadi bisa dipasang ke layar utama tanpa lewat Play Store.

1. Buka alamat aplikasi di Chrome (Android) atau Safari (iPhone). Harus HTTPS, jadi pakai hasil deploy.
2. Android: akan muncul tombol **Pasang** di dalam aplikasi, atau menu ⋮ → *Pasang aplikasi*.
3. iPhone: tombol Bagikan → *Tambah ke Layar Utama*.
4. Ikon mahkota muncul di layar utama dan aplikasi terbuka layar penuh tanpa address bar.

Butuh APK untuk dibagikan ke orang lain? Buka https://www.pwabuilder.com, masukkan alamat aplikasi,
lalu unduh paket Android (APK/AAB).

## Menjalankan lokal

```bash
npm install
npm run dev        # server :3001 + vite :5173
```

Buka http://localhost:5173. Untuk mode produksi:

```bash
npm run build
npm start          # http://localhost:3001
```

### Akun developer pertama

Dibuat otomatis saat server pertama kali dijalankan.

- Default username: `developer`
- Password: dari env `DEV_PASSWORD`, atau **dibuat acak dan dicetak sekali di log** bila tidak diisi.

## Variabel lingkungan

| Nama | Keterangan |
| --- | --- |
| `PORT` | Port server (default 3001) |
| `JWT_SECRET` | Rahasia token. Bila kosong, dibuat acak dan disimpan di `data/.jwt-secret` |
| `DATA_DIR` | Lokasi database SQLite (default `./data`) |
| `UPLOAD_DIR` | Lokasi aset unggahan (default `./server/uploads`) |
| `DEV_USERNAME` / `DEV_PASSWORD` | Akun developer pertama |
| `TURN_URL` / `TURN_USERNAME` / `TURN_CREDENTIAL` | Server TURN, untuk koneksi di balik NAT ketat |
| `MAX_UPLOAD_MB` | Batas ukuran unggahan aset (default 15) |
| `CORS_ORIGIN` | Origin yang diizinkan untuk Socket.IO |

## Deploy

### Render (disarankan: butuh WebSocket + disk permanen)

Klik tombol **Deploy to Render** di atas, atau buka langsung:
https://render.com/deploy?repo=https://github.com/brillyandev/kahfi-party-star

1. Push repo ini ke GitHub, lalu **New → Web Service** di Render.
2. Render mendeteksi `render.yaml` / `Dockerfile` secara otomatis.
3. Isi `DEV_PASSWORD` dan `JWT_SECRET`.
4. Tambahkan **Disk** yang dipasang di `/app/data` agar database dan aset tidak hilang saat redeploy.
5. Deploy, lalu buka `https://<nama>.onrender.com`.

### Vercel

Vercel cocok untuk aset statis, **tetapi function-nya serverless**: WebSocket persisten dan
SQLite tidak bisa berjalan seperti di Render. Bila tetap ingin Vercel, jalankan server ini
di Render/Railway/Fly.io dan arahkan frontend ke URL tersebut. Konfigurasi `vercel.json` disertakan
hanya untuk menyajikan UI statis.

## Struktur

```
server/            Express + Socket.IO + SQLite (better-sqlite3)
  routes/          auth, user, shop, social, rooms, staff
  auth.js          JWT, hierarki peran, penjaga izin
  upload.js        unggahan aset + pembersihan SVG + CSP
  index.js         API, static, dan signaling voice room
src/               React + Vite
  lib/useVoice.ts  WebRTC mesh, mute, deteksi bicara, event room
  pages/           Party, Temukan, Pesan, Saya, Room, Toko, VIP, Ranking, CP, Staf
```

## Keamanan

- Password di-hash `bcrypt`.
- Token JWT 30 hari; semua endpoint mengecek ulang peran dari database (bukan dari token).
- Upload hanya menerima PNG, WEBP, SVG, SVGA. SVG dibersihkan dari `<script>`, event handler,
  dan `javascript:` URL, lalu disajikan dengan header CSP `sandbox`.
- Semua transaksi koin berjalan dalam satu transaksi database (atomik).
- Endpoint login/daftar dibatasi percobaan per IP.

## Status

Terverifikasi lewat uji otomatis: pendaftaran + bonus 10M, klaim harian, hierarki peran,
jual koin coin seller, gift + pesona, ranking, VIP, CP, pesan, unggahan aset, penolakan file berbahaya,
serta panggilan dua browser (audio dua arah tersambung, chat dan gift real-time).

Diketahui belum beres: mikrofon peserta kadang tidak aktif setelah duduk di kursi, sehingga
indikator cincin bicara tidak menyala. Transport audionya sudah tersambung; yang perlu diperbaiki
adalah pengaktifan track mikrofon saat kursi diambil.
