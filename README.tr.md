# ITACM — IT Asset Control Pro

> Kendi sunucunuzda barındırılabilir BT varlık yönetimi backend'i: donanım
> envanteri, çalışan zimmet işlemleri (yazdırılabilir zimmet tutanağı ile),
> yazılım lisansları, sarf malzemeleri ve arıza/bakım takibi — dahili web
> arayüzü ile. Tamamen kendi sunucunuzda **Docker Compose + PostgreSQL** ile
> çalışır.

**[🇬🇧 English documentation → README.md](README.md)**

---

## Ekran Görüntüleri

| Dashboard | Donanım Envanteri |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Donanım](docs/screenshots/hardware.png) |

| Zimmet İşlemleri | Yazdırılabilir Zimmet Tutanağı |
|---|---|
| ![Zimmet](docs/screenshots/handover.png) | ![Tutanak](docs/screenshots/print-preview.png) |

| Personel Detayı | Raporlar & Özel Rapor Oluşturucu |
|---|---|
| ![Personel](docs/screenshots/employee-detail.png) | ![Raporlar](docs/screenshots/reports.png) |

---

## Özellikler

- 🖥 **Dahili web arayüzü** — backend'in kendisi tarafından sunulur (build adımı yok): Giriş, Dashboard, Donanım Envanteri (toplu işlemler, QR kodlar, global arama), kişi bazlı cihaz geçmişli Personel Rehberi, **yazdırılabilir tutanaklı** zimmet sepeti, yazılım (lisans) zimmeti, Lisanslar, Sarf Malzemeleri, Bakım ve login denetimli BT Kullanıcı yönetimi. Başlattıktan sonra `http://localhost:8000` adresini açın.
- 🚀 **İlk kullanım sihirbazı (onboarding)** — ilk açılışta şirket adı, logo ve Admin hesabını belirleyin; marka tüm arayüze ve yazdırılan zimmet tutanaklarına uygulanır (sonradan Ayarlar'dan değiştirilebilir).
- 🧪 **Demo veri seti** — `npm run seed:demo`, postgres kurulumunu 500 personellik gerçekçi bir şirketle doldurur (773 varlık, tutanaklar, denetim geçmişi, yazılım zimmetleri).
- 🔐 **Rol tabanlı yetkilendirme** — her endpoint'te `Owner`, `Admin`, `Helpdesk`, `Viewer` rolleri
- 💻 **Donanım envanteri** — varlık etiketi (benzersiz, QR kodlu), seri no, MAC adresleri, teknik özellikler, garanti
- 🤝 **Atomik zimmet sepeti** — birden çok varlığı tek "ya hep ya hiç" transaction'ı ile çalışana zimmetleyin; yazdırılabilir **Zimmet Tutanağı** otomatik oluşur
- 🛠 **Bakım yaşam döngüsü** — servise gönder / geri al / hurdaya ayır; onarım öncesi zimmet durumu otomatik geri yüklenir
- 📄 **Yazılım lisansları** — koltuk (seat) havuzları, atomik tahsis/bırakma, 30 gün kala bitiş uyarıları
- 📦 **Sarf malzemeleri** — stok hareketleri ve kritik stok uyarıları
- 📊 **Dashboard özetleri** — duruma göre varlık sayıları, uyarılar, son zimmet hareketleri
- 🧾 **Tam denetim izi (audit log)** — her zimmet/iade/onarım/ilerleme notu kim/ne zaman/neden bilgisiyle kayıtlı; kullanıcı bazlı login geçmişi
- ⏳ **Ürün yaşam döngüsü yönetimi** — kategori başına yaşam süresi (ay) Ayarlar'dan merkezi olarak belirlenir; her varlıkta EOL tarihi, envanterde "EOL soon"/gecikti rozetleri ve lifecycle raporları
- 📈 **Raporlar & Özel Rapor Oluşturucu** — 6 hazır rapor + oluşturucu (7 veri kaynağı × seçilebilir kolon × filtre), Excel uyumlu CSV veya şirket antetli yazdırma
- 🗂 **Ürün kataloğu** — kategori bazlı marka/model listeleri merkezi yönetilir ve varlık formunu besler; asset tag'ler sistem tarafından sıralı atanır
- 📁 **Belge arşivi** — her zimmet tutanağı kişi bazında otomatik dosyalanır; imzalı taramalar yüklenebilir (veritabanında güvenle saklanır)

## Hızlı başlangıç — Docker Compose

Her şey otomatiktir: veritabanı konteyneri oluşturulur, şema uygulanır ve ilk
Admin (Owner) hesabı tohumlanır.

```bash
git clone https://github.com/<siz>/itacm.git
cd itacm

npm install
npm run setup          # güçlü secret'larla .env üretir (veya .env.example'ı kopyalayın)

docker compose up -d
docker compose logs api   # ilk çalıştırmada Owner bilgileri burada yazdırılır
```

Ardından **http://localhost:8000** adresini açın — ilk açılışta onboarding
sihirbazı gelir: şirket adı/logo belirleyip **Owner** hesabını oluşturursunuz.

> `ADMIN_PASSWORD` boş bırakılırsa güçlü rastgele bir şifre üretilir ve
> loglarda **bir kez** gösterilir. İlk girişten sonra değiştirin.

---

## Sunucuya yayına alma

Compose dosyası Docker kurulu her sunucuda aynen çalışır. 8000 portunun önüne
TLS'li bir reverse proxy (Caddy/Nginx/Traefik) koyun ve gerekiyorsa
`CORS_ORIGINS` değerini frontend adresinize ayarlayın.

Yönetilen platformlarda (Railway, Render, Fly.io, Cloud Run…) `Dockerfile`'ı
deploy edin, bir Postgres eklentisi bağlayın ve aynı env değişkenlerini
(`DATABASE_URL`, `PGSSL=true`, `JWT_SECRET`, `ADMIN_*`) girin. Şema açılışta
otomatik uygulanır.

---

## Yapılandırma referansı

| Değişken | Zorunlu | Açıklama |
|---|---|---|
| `PORT` | – | HTTP portu (varsayılan `8000`) |
| `CORS_ORIGINS` | – | Virgülle ayrılmış izinli origin'ler (boş = same-origin) |
| `DATABASE_URL` | ✅ | `postgres://user:pass@host:5432/db` (veya `POSTGRES_URL`) |
| `PGSSL` | – | TLS'li yönetilen Postgres için `true` |
| `JWT_SECRET` | ✅ | En az 32 karakter — `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | – | Token ömrü (varsayılan `12h`) |
| `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | – | İlk Owner (şifre boşsa otomatik üretilir) |

docker compose ile `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` hem
veritabanı konteynerini hem de API'nin `DATABASE_URL`'ini besler.

## API referansı

Tüm yanıtlar `{ success, data }` veya `{ success: false, error, details? }`
biçimindedir. `login`/`health` dışındaki tüm endpoint'ler
`Authorization: Bearer <TOKEN>` ister.

| Metot | Endpoint | Roller | Açıklama |
|---|---|---|---|
| POST | `/api/auth/login` | herkese açık | E-posta/şifre → JWT |
| POST | `/api/auth/verify-token` | tümü | Token doğrula, profil + izinleri döndür |
| GET/POST | `/api/auth/users` | Admin | BT kullanıcılarını listele / oluştur |
| PUT | `/api/auth/users/:uid/role` | Admin | Kullanıcı rolünü değiştir |
| GET | `/api/dashboard/stats` | tümü | Sayımlar, stok & lisans uyarıları, son hareketler |
| GET | `/api/assets` | tümü | Envanter listesi — `?status=&category=&search=` |
| GET | `/api/assets/:id` | tümü | Varlık detayı + denetim geçmişi |
| POST / PUT | `/api/assets`, `/api/assets/:id` | Admin, Helpdesk | Donanım oluştur / güncelle |
| POST | `/api/assets/:id/return` | Admin, Helpdesk | Zimmetli varlığı stoğa iade et |
| POST | `/api/handovers` | Admin, Helpdesk | **Atomik zimmet sepeti** (aşağıda) |
| GET | `/api/handovers`, `/:id` | tümü | Tutanaklar (yazdırma ekranını besler) |
| GET/POST | `/api/maintenance` | Admin, Helpdesk | Onarım kayıtları / servise gönder |
| PUT | `/api/maintenance/:id/close` | Admin, Helpdesk | Onarımı kapat (hurda için `{scrap:true}`) |
| GET | `/api/employees` | tümü | Personel rehberi + zimmet personel seçici |
| POST / PUT | `/api/employees` | Admin, Helpdesk | Oluştur / güncelle (üzerinde zimmet varken pasife alınamaz) |
| GET | `/api/licenses`, `/api/consumables` | tümü | Uyarı işaretli listeler |
| POST | `/api/licenses`, `/:id/seats` | Admin, Helpdesk | Oluştur / atomik koltuk tahsis-bırakma |
| POST | `/api/consumables`, `/:id/stock` | Admin, Helpdesk | Oluştur / atomik stok hareketi |

### Atomik zimmet sepeti

```http
POST /api/handovers
{
  "employeeId": "…",
  "documentType": "single",
  "items": [
    { "assetId": "…", "conditionNote": "Yeni, kutulu" },
    { "assetId": "…", "conditionNote": "İkinci el, temiz" }
  ]
}
```

**Tek transaction** içinde (Postgres `BEGIN … FOR UPDATE` satır kilitleri): her varlığın `In Stock` olduğu doğrulanır → tutanak
belgesi oluşturulur → her varlık çalışana bağlı `Assigned` durumuna geçer →
çalışanın `activeAssetCount` sayacı artar → her varlık için bir denetim satırı
yazılır. Sepetteki **tek bir** varlık bile kilitliyse API, varlık bazında
çakışma listesiyle `409` döner ve **hiçbir şey yazılmaz**. Satır kilitleri /
transaction yeniden denemeleri sayesinde iki operatörün aynı laptopu aynı anda
zimmetlemesi imkânsızdır.

## Güvenlik notları

- **Gizli bilgiler asla repoda yaşamaz.** `.env` git tarafından yok sayılır;
  kurulum sihirbazı `.env` dosyasını `0600` izniyle yazar ve güçlü bir
  `JWT_SECRET` + DB şifresi üretir.
- **Kimlik doğrulama:** şifreler bcrypt ile hash'lenir (cost 12); JWT'ler ≥32
  karakterlik gizli anahtarla HS256 imzalanır; girişte bilinmeyen e-posta ile
  yanlış şifre aynı hatayı döndürür (hesap taraması engellenir); her istekte
  kullanıcı satırı tekrar okunur, böylece rol değişikliği/silme anında etki eder.
- **Sıkılaştırma:** katı Content-Security-Policy (inline script yok), HSTS,
  nosniff/frame-deny başlıkları, login rate-limit (15 dk'da 20 deneme/IP), genel
  API rate-limit (5 dk'da 1000 istek/IP), varsayılan same-origin CORS, 1MB body
  limiti, tek seferlik onboarding endpoint'i.
- **İletişim:** API'nin önüne HTTPS koyun (VPS'te Caddy/Nginx/Traefik).
  `CORS_ORIGINS` değerini frontend'inizin tam adresine ayarlayın.

## Proje yapısı

```
├── server.js                  Node/Docker girişi (açılışta otomatik migrasyon)
├── public/                    Dahili web arayüzü (vanilla JS SPA, build adımı yok)
├── src/
│   ├── app.js                 Express uygulaması + route bağlama
│   ├── config/                Env okuma
│   ├── middleware/            Bearer auth + rol kapısı, hata yönetimi
│   ├── routes/                İnce controller'lar
│   ├── utils/                 PDF üretimi, varsayılanlar, izinler
│   └── providers/postgres/    JWT auth + PostgreSQL (schema.sql, otomatik migrasyon, servisler)
├── scripts/setup.js           .env üreticisi (npm run setup)
├── scripts/seed-demo.js       500 personellik demo veri (npm run seed:demo)
├── docker-compose.yml         Kendi sunucunda tam yığın (API + Postgres)
├── Dockerfile
└── .env.example               Eksiksiz belgelenmiş yapılandırma şablonu
```

## Geliştirme

```bash
npm install
npm run setup      # veya .env'i elle yazın
npm run dev        # otomatik yeniden başlayan yerel sunucu
npm run lint       # söz dizimi denetimi
npm run migrate    # Postgres şemasını elle uygula (opsiyonel)
```

## Lisans

[MIT](LICENSE)
