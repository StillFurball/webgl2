# Tugas 2 - Halte Robotika dan iCAR

**Mata Kuliah:** Grafika Komputer
**Topik:** Animasi, objek 3D, hierarchical modelling, lighting, dan texture dengan WebGL

| Nama | NRP | Tugas |
| --- | --- | --- |
| Rafi Attar Maulana | 5025241141 | Membuat program WebGL, menyusun objek dan hierarki 3D, serta mengatur animasi iCAR, kamera, pencahayaan, dan tekstur. |
| Ananda Aryasatya Zhafran Aqila | 5025241142 | Mencari objek referensi, memfoto halte sebagai acuan, dan membantu menentukan tampilan serta susunan objek pada scene. Melakukan penyesuaian akhir sebelum p[engumpulan] |

## Deskripsi aplikasi

Scene sederhana berisi satu jalan paving lurus, penghalang kuning-hitam, rumput di bawah pohon tepi jalan, halte referensi, dan iCAR. Tekan `W` atau `S` untuk menggerakkan iCAR maju atau mundur.

Kode memakai **WebGL2 murni** tanpa library: tidak ada Three.js, dan matrix ditulis sendiri seperti `math3d.js` praktikum.

## Cara menjalankan

Klik dua kali `index.html`. Tidak perlu server, karena script dimuat dengan `<script>` biasa (seperti praktikum 07, bukan ES Module) dan semua texture digambar dengan kode. Pembuatan texture memerlukan beberapa detik saat halaman dibuka.

Jika ingin memakai server: `python -m http.server 8080`, lalu buka `http://localhost:8080`.

Dibutuhkan browser dengan WebGL2 (Chrome, Edge, atau Firefox versi baru).


## Kontrol

Klik canvas dulu agar keyboard aktif. Saat canvas tidak fokus, tombol panah, spasi, dan scroll mouse kembali menggulir halaman.

| Tombol | Fungsi | Materi |
|---|---|---|
| `W` / `S` | iCAR maju / mundur | P03 |
| `A` / `D` | Kamera kiri / kanan | P04 |
| `Q` / `E` | Kamera turun / naik | P04 |
| Panah | Memutar arah pandang | P04 |
| Drag mouse | Orbit mengelilingi target | P04 |
| Scroll (setelah canvas diklik) | Maju-mundur menuju target | P04 |
| `C` | Preset kamera berikutnya | P04 |
| `P` | Perspective / Orthographic | P04 |
| `Z` | Depth test ON / OFF | P04 |
| `F` | Flat / Smooth shading | P06 |
| `T` | Filtering: mipmap, LINEAR, NEAREST | P06 |
| `G` | Wrapping: REPEAT, CLAMP_TO_EDGE, MIRRORED_REPEAT | P06 |
| `[` / `]` | UV Scale turun / naik | P06 |
| `-` / `+` | Shininess turun / naik | P06 |
| `1` / `2` / `3` | Ambient / Diffuse / Specular ON-OFF | P06 Challenge F |
| `Y` | Texture ON / OFF | P06 |
| `X` | Wireframe (`gl.LINE_STRIP`) | P02 |
| `B` | Bayangan ON / OFF | di luar materi |
| `L` | Lampu: otomatis, nyala, mati | P06 |
| `N` | Siang / malam | P06 |
| `Spasi` | Jeda / lanjut animasi | P03 |
| `R` | Reset ke keadaan awal | P03 |

Panel di bawah canvas menyediakan kontrol yang sama, ditambah jam, slider sendi iCAR (seperti slider `figure.js`), dan kecepatan animasi.

## Nilai default

| Parameter | Nilai | Tempat mengubah |
|---|---|---|
| Shading | Smooth | `renderState.flatShading` |
| Filtering | `LINEAR_MIPMAP_LINEAR` | `renderState.filterMode` |
| Wrapping | `REPEAT` | `renderState.wrapIndex` |
| UV Scale | 1,00 | `renderState.uvScale` |
| Shininess | Per material (bawaan 32), pengali 1 | `createMaterial`, `renderState.shininessScale` |
| Ambient | Kekuatan global × warna langit-tanah | `u.ambientStrength` di `renderMainPass`, warna di `DAY_KEYS` |
| Jam | Pagi, sekitar 09.36 | `daylight.hour` |
| Proyeksi | Perspective | `camera.projection` |
| Kamera awal | Preset `foto1` | `CAMERA_PRESETS`, `initScene` |

## Alur satu frame

Urutannya ada di fungsi `render` (`main.js`):

1. `updateAnimation(dt)`: mengubah posisi iCAR dan gerakan pohon. Sendi yang berubah memanggil `initNodes`.
2. `traverse(rootId)` dengan `renderPass = "update"`: hanya menghitung world matrix semua node, belum menggambar.
3. `updateCamera`, `computeLighting`, `computeLightSpace`: kamera dan lampu membaca world matrix dari langkah 2. Inilah sebabnya kamera dan lampu depan bisa ikut iCAR.
4. `renderShadowPass`: `traverse` lagi, menggambar scene dari arah matahari ke shadow map.
5. `renderMainPass`: `drawSky`, lalu `traverse` sekali lagi ke layar.
6. `updateHUD` dan `requestAnimationFrame(render)`.

Jadi `traverse` yang sama dipakai tiga kali. `drawPart` melihat nilai `renderPass` untuk menentukan apa yang dikerjakan.

## Hierarki

Struktur sama dengan `figure.js` praktikum 07: left-child right-sibling. Perbedaannya hanya pada `addNode`, yang mengisi `child` dan `sibling` secara otomatis karena jumlah node ratusan, sehingga tidak ditulis manual di `switch`.

```text
Dunia
├── Jalan → Jalan Paving, Penghalang Kuning-Hitam, Tepi Jalan
├── Halte iCAR 1 → Tiang Biru → Panel Depan, Panel Belakang
├── Pepohonan → Pohon n → Batang → Cabang → Ranting
├── iCAR
│   ├── Sasis → Badan, Interior, Muka Depan, lampu, Tiang Sensor, Kolom Setir, Pengemudi
│   └── Hub roda → Roda
```

Diagram lengkap di halaman utama dibuat langsung dari array `figure`, jadi selalu sama dengan kode. Klik satu node untuk menyorot seluruh cabangnya di canvas.

## Cara badan iCAR dibuat

Badan iCAR bukan tumpukan kotak, melainkan satu permukaan yang dihitung dengan rumus (`icar.js`, fungsi `buildBodyShell`). Gambaran sederhananya seperti melilitkan selembar kain mengelilingi mobil:

1. **Denah dari atas** berupa persegi panjang bersudut bulat (`outlineAt`). Koordinat `s` adalah jarak menyusuri keliling badan, dihitung dari tengah depan.
2. **Profil dari samping** ada di `BODY_PROFILE`: daftar pasangan tinggi dan seberapa masuk badan dari denah, dari bawah sampai puncak atap. `profileAt` menghaluskannya dengan interpolasi Catmull-Rom.
3. **Titik permukaan** `bodyPoint(s, w)` menggabungkan keduanya, ditambah spakbor yang menggembung dan atap yang melengkung.
4. **Kolom demi kolom.** Di sepanjang keliling dibuat ratusan kolom tegak. Tiap kolom bertanya: di posisi ini ada lubang jendela? (`windowSpan`) dan ada lengkung roda? (`archTop`). Kolom lalu dibagi menjadi strip bawah dan strip atas, dari lengkung roda sampai bawah jendela, dan dari atas jendela sampai atap. Kolom dirapatkan di sudut lubang, sehingga tepi jendela mulus.
5. **Tebal badan.** Permukaan yang sama dibuat lagi sedikit lebih ke dalam (parameter `inner`), lalu tepinya dihubungkan, sehingga bingkai jendela terlihat tebal.
6. **Normal** dihitung oleh `bodyNormal` dari dua arah garis singgung: `cross(ds, dw)`, pendekatan beda hingga.
7. **Texture.** UV-nya adalah (keliling, tinggi), sehingga garis hitam di samping badan cukup digambar sebagai kurva di Canvas 2D (`icarBodyTexture`).

Grille dan dua bar putih dibuat dengan `bodyPadData`, yaitu bantalan yang menempel mengikuti permukaan badan. Lampu ditempatkan dengan `placeOnBody`, yang mengarahkan +Z lokal ke normal badan.

## Animasi

Semua ada di `animation.js`.

- **Mengemudi iCAR** (`updateIcarDrive`): klik canvas, tahan `W` untuk maju atau `S` untuk mundur. Mobil tetap menghadap arah yang sama dan berhenti di ujung jalan.
- **Gerakan mobil:** tombol menentukan kecepatan. Kecepatan dikali waktu untuk mengubah posisi mobil. `distanceMoved` juga memutar roda.
- **Batas jalan** (`ROUTE.zSouth`, `ROUTE.zNorth`): posisi mobil dibatasi supaya tidak melewati ujung jalan.
- **Angin** (`updateWind`): menggerakkan cabang pohon.

## Batasan yang perlu diketahui

- **Teks kecil di peta rute** pada papan halte dibaca dari foto yang buram, jadi sebagian bisa keliru, terutama nama halte 3 ("Dassa B"). QR code hanya pola acak dan tidak bisa dipindai.
- **Isi papan kawasan dan papan laboratorium** terbaca sebagian dari foto kedua. Baris yang tidak terbaca diperkirakan.
- **Ilustrasi iCAR pada papan halte** digambar ulang, bukan foto aslinya.
- **Ukuran iCAR dan posisi halte serta pohon** diperkirakan dari foto, bukan dari data resmi.
- **Foto iCAR diambil di dekat Rektorat**, sedangkan scene berada di Halte Robotika, sehingga latar preset iCAR berbeda dari fotonya.
