# Tugas 2 - Halte Robotika dan iCAR

**Mata Kuliah:** Grafika Komputer
**Topik:** Animasi, objek 3D, hierarchical modelling, lighting, dan texture dengan WebGL

| Name           | NRP        | 
| ---            | ---        | 
| . | . | 
| . | . | 

## Deskripsi aplikasi

Scene Halte iCAR 1 "Robotika" di ITS beserta jalan paving, curb kuning-hitam, median daun gugur, dan pepohonannya. iCAR melaju mengelilingi median, melambat, berhenti di samping halte, lalu berangkat lagi. Dua motor ikut melintas, cabang pohon bergoyang, dan daun berjatuhan.

Kode memakai **WebGL2 murni** tanpa library: tidak ada Three.js, dan matrix ditulis sendiri seperti `math3d.js` praktikum.

## Cara menjalankan

Klik dua kali `index.html`. Tidak perlu server, karena script dimuat dengan `<script>` biasa (seperti praktikum 07, bukan ES Module) dan semua texture digambar dengan kode. Pembuatan texture memerlukan beberapa detik saat halaman dibuka.

Jika ingin memakai server: `python -m http.server 8080`, lalu buka `http://localhost:8080`.

Dibutuhkan browser dengan WebGL2 (Chrome, Edge, atau Firefox versi baru).

## Mengisi data kelompok dan video

Semua ada di konstanta `DATA_KELOMPOK`, bagian atas `js/ui.js`:

- `nama`, `anggota`: nama kelompok, nama, dan NRP.
- `pembagian`: pembagian tugas. Isinya baru usulan berdasarkan file; setelah disesuaikan, ubah `pembagianMasihUsulan` menjadi `false`.
- `youtubeId`: kode setelah `v=` pada alamat video YouTube iCAR. Atau kosongkan dan letakkan file di `gallery/video/icar.mp4` (sesuai `videoLokal`).

Daftar foto ada di konstanta `FOTO` pada file yang sama. Foto tampil di bagian "Foto objek asli" di bawah canvas. Setiap foto terhubung ke satu preset kamera, sehingga tombol pada foto memindahkan kamera ke sudut yang sama.

## Kontrol

Klik canvas dulu agar keyboard aktif. Saat canvas tidak fokus, tombol panah, spasi, dan scroll mouse kembali menggulir halaman.

| Tombol | Fungsi | Materi |
|---|---|---|
| `W` `A` `S` `D` | Kamera maju, kiri, mundur, kanan | P04 |
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

## Peta materi ke kode

| Praktikum | Konsep | File dan fungsi |
|---|---|---|
| 01 | Canvas 2D (path, gradient, teks) | `textures.js`: semua fungsi `...Texture()`, contohnya `signFaceTexture` |
| 02 | Buffer, attribute | `renderer.js`: `createArrayBuffer`, `setupAttribute` |
| 02 | Shader dan program | `renderer.js`: `createShader`, `createProgram` |
| 02 | Primitive | `gl.TRIANGLES` di `drawPart`, `gl.LINES` untuk kabel (`ENV_MESH.wires`, `createStreetFurniture`), `gl.LINE_STRIP` untuk wireframe |
| 02 | Rendering loop | `main.js`: `render` dengan `requestAnimationFrame` |
| 03 | Translasi, rotasi, skala, urutan T × R × S | `math3d.js`: `Mat4.translation`, `Mat4.rotationX/Y/Z`, `Mat4.scaling`, `Mat4.chain` |
| 03 | Pivot | Node `Hub` pada roda iCAR: belok di hub, berputar di roda |
| 03 | Keyboard state-based dan event-based | `camera.js`: `keys`; `main.js`: `KEY_ACTIONS` |
| 03 | Delta time | `render` menghitung `dt`, diteruskan ke `updateAnimation(dt)` |
| 03 | Parent dan child | `hierarchy.js`: `traverse`, ChildWorld = ParentWorld × ChildLocal |
| 03 | HUD, clamp, reset | `updateHUD`, `clamp`, `sceneActions.reset` |
| 04 | Matrix 4×4, `lookAt` | `math3d.js`: `Mat4.lookAt`; `camera.js`: `createViewMatrix` |
| 04 | Perspective, orthographic, FOV, near/far | `camera.js`: `createProjectionMatrix` |
| 04 | Depth test | `renderState.depthTest`, tombol `Z` |
| 04 | VAO | `renderer.js`: `uploadMesh` |
| 04 | Kontrol kamera | `camera.js`: `updateFreeCamera`, `updateCamera`, `setCameraPreset` |
| 06 | Ambient, diffuse, specular per-fragment | `renderer.js`: fungsi GLSL `phong` di `fragmentShaderSource` |
| 06 | Normal Matrix | `math3d.js`: `normalMatrixFromMat4`, `u.normalMatrix` di `drawPart` |
| 06 | Flat dan smooth shading | `renderer.js`: `computeFlatNormals`, `vaoFlat`, `vaoSmooth` |
| 06 | UV dan texture sampling | `geometry.js` (UV), `createTexture`, `useMaterial` |
| 06 | Filtering, mipmap, wrapping | `renderer.js`: `applyTextureState` |
| 06 | UV Scale, shininess | `renderState.uvScale`, `renderState.shininessScale` |
| 07 | Node dan pohon | `hierarchy.js`: `createNode`, `addNode`, `figure` |
| 07 | Hitung ulang transform | `hierarchy.js`: `initNodes`, sudut di `theta` |
| 07 | Traversal dengan stack | `hierarchy.js`: `traverse`, `stack`, `modelMatrix` |
| 07 | Instance matrix | Argumen ketiga `drawPart(mesh, material, instanceMatrix)` |
| 07 | Figur manusia | `icar.js`: `createDriver`; `motor.js`: pengendara di `createMotor` |

## Alur satu frame

Urutannya ada di fungsi `render` (`main.js`):

1. `updateAnimation(dt)`: mengubah `theta`, posisi iCAR, motor, angin. Sendi yang berubah memanggil `initNodes`.
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
├── Lingkungan → jalan, curb, median, dinding beton, tanah
├── Halte iCAR 1 → Tiang Biru → Panel Depan, Panel Belakang
├── Pepohonan → Pohon n → Batang → Cabang → Ranting
├── Perabot Jalan → Tiang Lampu → Bola Lampu, rambu, papan
├── Gedung
├── Daun Gugur
├── iCAR
│   ├── Sasis → Badan, Interior, Muka Depan, lampu, Tiang Sensor, Kolom Setir, Pengemudi
│   └── Hub roda → Roda
└── Lalu Lintas → Motor → Stang → Roda Depan, Roda Belakang, Pengendara
```

Diagram lengkap di halaman utama dibuat langsung dari array `figure`, jadi selalu sama dengan kode. Klik satu node untuk menyorot seluruh cabangnya di canvas.

Poin yang sering ditanyakan:

- **Mengapa roda bukan child dari Sasis?** Sasis mengayun di atas suspensi saat rem dan menikung. Kalau roda menjadi child sasis, roda ikut terangkat dari tanah. Karena itu roda adalah child node `iCAR`, sibling dari `Sasis`.
- **Mengapa ada Hub dan Roda?** Urutan rotasi. Hub berbelok di sumbu Y, roda berputar di sumbu X lokalnya. Kalau keduanya satu node, urutannya perlu dipikirkan ulang setiap frame; dengan dua node, hierarki yang mengerjakannya.
- **Apa bedanya `transform` dan `instanceMatrix`?** `transform` diwariskan ke child, `instanceMatrix` tidak. Skala bagian tubuh memakai `instanceMatrix` agar child tidak ikut gepeng, sama seperti `torso()` pada `figure.js`.
- **Bagaimana kamera pengemudi bekerja?** `updateCamera` membaca `figure[icar.head].world`, sehingga kamera mengikuti kepala, sasis, dan mobil sekaligus.

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

- **Rute** (`ROUTE`, `route`): dua ruas lurus dan dua setengah lingkaran. `route.pointAt(jarak)` memberi posisi, `route.headingAt` memberi arah.
- **Status iCAR** (`updateIcarDrive`): Melaju → Mendekati halte → Berhenti di halte → Berangkat → Melaju.
- **Berhenti tepat di titik:** perlambatan konstan memakai `v² = 2·a·s`, jadi kecepatan sasaran adalah `Math.sqrt(2 * a * jarak)`.
- **Roda:** sudut putar = jarak tempuh ÷ jari-jari. Sudut belok diturunkan dari kelengkungan rute: `atan(wheelBase × kelengkungan)`.
- **Sasis:** menunduk saat rem, miring ke luar saat menikung, bergetar halus di atas paving.
- **Lampu:** sein kiri saat mendekati halte, keduanya saat berhenti, sein kanan saat berangkat, lampu rem saat melambat.
- **Angin** (`updateWind`): setiap sendi punya fase sendiri. Ranting menumpang gerakan cabang induknya karena hierarki, sehingga gerakannya terlihat berjenjang.

## Fitur di luar materi praktikum

Fitur berikut **tidak diajarkan** di praktikum 01–07. Semuanya berada di atas Phong dari praktikum 06, jadi bisa dijelaskan sebagai tambahan.

| Fitur | Letak | Penjelasan singkat |
|---|---|---|
| Shadow mapping + PCF | `renderShadowPass`, `computeLightSpace`, `sunVisibility` | Scene digambar sekali dari arah matahari, hanya kedalamannya yang disimpan. Saat menggambar ke layar, setiap fragment dibandingkan: jika ada yang lebih dekat ke matahari, fragment itu terkena bayangan. PCF merata-ratakan 9 sampel agar tepinya halus. Tombol `B`. |
| Hemisphere ambient | `mix(u_groundAmbient, u_skyAmbient, ...)` di fragment shader | Ambient praktikum 06 satu warna. Di sini permukaan menghadap atas mendapat warna langit, yang menghadap bawah mendapat warna tanah. Tetap bukan global illumination. |
| Fog | `u_fogDensity` di fragment shader | Warna dicampur warna kabut sesuai jarak ke kamera, dengan rumus eksponensial kuadrat. |
| Lampu sorot, banyak lampu | `setPointLights`, loop `u_pointLightCount` | Rumus Phong yang sama diulang per lampu, dengan redaman jarak. Lampu sorot menambahkan syarat sudut terhadap arah lampu. |
| Macro noise | `u_macro`, `valueNoise` | Warna tanah digeser sedikit berdasarkan posisi dunia, agar pola texture berulang tidak terlihat. |
| Alpha cutout | `u_alphaCut`, `discard`, `bleedTransparentPixels` | Piksel texture daun yang transparan dibuang. Shadow pass melakukan hal yang sama, sehingga bayangan daun berlubang-lubang. |
| Translucency daun | `u_translucency` | Sisi belakang daun tetap menerima sebagian cahaya, seperti daun yang tembus cahaya matahari. |
| Anisotropic filtering | `anisotropyExtension` di `applyTextureState` | Paving tetap tajam saat dilihat dari sudut rendah. |
| Permukaan parametrik | `buildBodyShell`, `profileAt`, `tubeData`, `latheData` | Mesh dihitung dengan rumus, bukan ditulis tangan. |

## Panduan modifikasi untuk challenge

Nomor baris bisa bergeser, jadi gunakan nama fungsi sebagai patokan.

### Memindah objek

Ubah matrix lokal node-nya. Contoh: halte ada di `createHalte`, pada `addNode("Halte iCAR 1", ...)`. Tiang dan panel ikut karena merupakan child. Daftar posisi pohon ada di `nearTrees` (`createTrees`), lampu di `lampSpots` (`createStreetFurniture`).

### Menambah objek sebagai node baru

Tambahkan di `createIcar` (atau fungsi lingkungan yang sesuai). Parent menentukan objek itu ikut siapa:

```js
addNode("Antena", icar.chassis, Mat4.translation(0, 1.85, -0.9), () => {
  drawPart(CAR_MESH.cylinder, CAR_MAT.matteBlack, Mat4.scaling(0.01, 0.5, 0.01));
}, { note: "Antena di atap" });
```

Node langsung muncul di canvas dan di diagram tree. Mesh siap pakai: `CAR_MESH.box`, `CAR_MESH.roundBox`, `CAR_MESH.softBox`, `CAR_MESH.sphere`, `CAR_MESH.cylinder`. Mesh baru dibuat dengan generator di `geometry.js` lalu `uploadMesh`.

### Menambah sendi

Langkahnya sama dengan menambah sudut di `figure.js`:

```js
theta.antena = 0;

const antena = addNode("Antena", icar.chassis, () => Mat4.chain(
  Mat4.translation(0, 1.85, -0.9),
  Mat4.rotationX(degToRad(theta.antena))
), () => {
  drawPart(CAR_MESH.cylinder, CAR_MAT.matteBlack, Mat4.scaling(0.01, 0.5, 0.01));
}, { note: "Antena bergoyang" });

icar.joints.push(antena);  // agar initNodes dipanggil setiap frame
```

Lalu gerakkan di `updateIcarDrive`: `setJoint("antena", 15 * Math.sin(animation.time * 3));`. Untuk slider, tambahkan satu baris di `SLIDER_SENDI` (`ui.js`).

### Mengubah warna dan material

Warna ada di `createMaterial`: `CAR_MAT` di `loadIcarAssets`, `BIKE_MAT` di `loadMotorAssets`, `ENV_MAT` di `loadEnvironmentAssets`. Warna badan dan garis hitam iCAR ada di `icarBodyTexture`. Kilap dikendalikan oleh `specular` dan `shininess`.

### Mengubah atau menambah texture

Tulis fungsi yang menggambar di canvas (contoh: `wheelRimTexture`), daftarkan di `loadTextures` dengan `createTexture`, lalu pakai di material: `createMaterial({ texture: TEX.namaBaru })`. Tambahkan opsi `{ tile: true }` jika texture perlu berulang.

### Mengubah kecepatan dan rute

- `CRUISE_SPEED`: kecepatan iCAR (m/s). `STOP_DURATION`: lama berhenti (detik). Keduanya di `animation.js`.
- `animation.speedScale`: pengali kecepatan, juga ada slidernya di halaman.
- Kecepatan motor: argumen `speed` pada `createMotor` di `initScene`.
- `ROUTE`: empat angka lajur dan titik memutar. Jika `xMain` diubah, posisi berhenti tetap dihitung otomatis dari `HALTE_STOP`.

### Menambah lampu

- Lampu jalan: tambahkan posisi di `lampSpots`. Bola lampu dan cahayanya otomatis mengikuti `lampPositions`.
- Lampu lain: tambahkan pemanggilan `add(posisi, warna, arah, cutoff, jangkauan)` di `setPointLights`. `cutoff` −1 berarti lampu titik biasa. Jumlah maksimal ada di `MAX_POINT_LIGHTS`.
- Warna matahari dan langit per jam ada di `DAY_KEYS`.

### Menambah preset kamera

Tambahkan di `CAMERA_PRESETS`. Pilih `position` dan `target` untuk kamera tetap, atau `follow: true` dengan `offset` dan `look` untuk kamera yang ikut iCAR.

### Pemeriksaan setelah mengubah

Muat ulang halaman, lalu buka console (F12). Error shader tampil lengkap dengan nomor barisnya.

## Catatan debugging

- **Canvas kosong:** lihat console. Pastikan browser mendukung WebGL2 dan urutan `<script>` di `index.html` tidak berubah, karena file saling memakai variabel global.
- **Objek gelap total:** periksa arah normal dan jam (`daylight.hour`). Coba tombol `1`, `2`, `3` untuk melihat komponen cahaya satu per satu.
- **Texture hitam:** pastikan `createTexture` dipanggil sebelum material dibuat, dan `TEX.nama` benar.
- **Texture tampak putih polos:** tombol `Y` mungkin sedang mematikan texture.
- **Wrapping tidak berubah:** hanya texture berulang (`tile: true`) yang mengikuti tombol `G`. Naikkan UV Scale dengan `]` agar lebih terlihat, misalnya pada paving.
- **Flat dan smooth tidak berbeda:** pada bidang datar seperti jalan memang sama. Bandingkan pada badan iCAR atau bola lampu.
- **Node baru tidak bergerak:** matrix lokal hanya dihitung ulang oleh `initNodes`. Pastikan id-nya masuk `icar.joints` atau dipanggil setiap frame.
- **Keyboard tidak merespons:** klik canvas dulu.
- **FPS rendah:** matikan bayangan dengan `B`. Pass bayangan menggambar seluruh scene sekali lagi.

## Batasan yang perlu diketahui

- **Teks kecil di peta rute** pada papan halte dibaca dari foto yang buram, jadi sebagian bisa keliru, terutama nama halte 3 ("Dassa B"). QR code hanya pola acak dan tidak bisa dipindai.
- **Isi papan kawasan dan papan laboratorium** terbaca sebagian dari foto kedua. Baris yang tidak terbaca diperkirakan.
- **Ilustrasi iCAR pada papan halte** digambar ulang, bukan foto aslinya.
- **Ukuran iCAR, posisi pohon, dan posisi gedung** diperkirakan dari foto, bukan dari data resmi.
- **Foto iCAR diambil di dekat Rektorat**, sedangkan scene berada di Halte Robotika, sehingga latar preset iCAR berbeda dari fotonya.
- **Penanganan benturan tidak ada:** motor dan iCAR memakai lajur berbeda pada rute yang sama, sehingga tidak saling menembus.

## Challenge yang dikerjakan

Dari modul praktikum 06: Challenge E (cahaya bergerak, lewat jam matahari), Challenge F (komponen cahaya ON/OFF), Challenge G (mipmap filtering). Dari modul praktikum 03: parent dan child.
