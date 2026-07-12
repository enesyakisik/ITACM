<div align="center">

# 🖥️ ITACM — IT Asset Control Pro

### Kendi sunucunuzda çalışan, her şeyi dahil BT varlık yönetimi.

Donanım envanteri · yazdırılabilir PDF tutanaklı çalışan zimmet işlemleri · yazılım lisansları · sarf malzemeleri · arıza/bakım takibi — hepsi dahili bir web arayüzünün ardında, tamamen kendi altyapınızda.

<br />

[![Lisans: MIT](https://img.shields.io/badge/Lisans-MIT-22c55e.svg?style=flat-square)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A520-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Self-hosted](https://img.shields.io/badge/Self--hosted-%25100-0ea5e9?style=flat-square)](#-hızlı-başlangıç--docker-compose)
[![Build adımı yok](https://img.shields.io/badge/Frontend-Build%20adımı%20yok-f59e0b?style=flat-square)](#-proje-yapısı)

<br />

[🇬🇧 English →](README.md) · **🇹🇷 Türkçe**

</div>

---

## 📑 İçindekiler

- [Neden ITACM?](#-neden-itacm)
- [Ekran görüntüleri](#-ekran-görüntüleri)
- [Öne çıkan özellikler](#-öne-çıkan-özellikler)
- [Teknoloji yığını](#-teknoloji-yığını)
- [Hızlı başlangıç — Docker Compose](#-hızlı-başlangıç--docker-compose)
- [Sunucuya yayına alma](#-sunucuya-yayına-alma)
- [Yedekleme & kurtarma](#-yedekleme--kurtarma)
- [Yapılandırma referansı](#-yapılandırma-referansı)
- [API referansı](#-api-referansı)
- [Güvenlik notları](#-güvenlik-notları)
- [Proje yapısı](#-proje-yapısı)
- [Geliştirme](#-geliştirme)
- [Lisans](#-lisans)

---

## 💡 Neden ITACM?

Çoğu varlık takip aracı ya çürüyen bir Excel tablosu ya da kendi sunucunuza kuramadığınız ağır bir SaaS'tır. ITACM ikisinin arasında durur:

- **Tek komutla çalışır.** `docker compose up -d` size veritabanını, şemayı, ilk admini ve tam bir web arayüzünü verir — build adımı yok, ayrı deploy edilecek bir frontend yok.
- **Güvenilir zimmet.** Her varlık ataması, şirket markanızla yazdırılabilir bir **Zimmet Tutanağı** üreten, satır kilitli atomik bir transaction'dır.
- **Her şey tek yedekte.** Cihazlar, çalışanlar, tutanaklar, denetim geçmişi ve yüklenen belgeler PostgreSQL içinde yaşar; tek bir yedek tüm sistemi kapsar.
- **Tamamen sizin.** Telemetri yok, vendor lock-in yok, MIT lisanslı.

---

## 📸 Ekran görüntüleri

<div align="center">

|  |  |
|:--:|:--:|
| **Dashboard** — sayımlar, uyarılar & son hareketler | **Raporlar & özel rapor oluşturucu** |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Raporlar](docs/screenshots/reports.png) |

</div>

> Daha fazla ekran görüntüsü (donanım envanteri, zimmet sepeti, yazdırılabilir tutanak, personel detayı) [`docs/screenshots/`](docs/screenshots) klasöründedir.

---

## ✨ Öne çıkan özellikler

<table>
<tr>
<td width="50%" valign="top">

### 🖥 Dahili web arayüzü
Backend'in kendisi tarafından sunulur — build adımı yok. Giriş, Dashboard, Donanım Envanteri (toplu işlemler, QR kodlar, global arama), Personel Rehberi, Zimmet sepeti, Lisanslar, Sarf Malzemeleri, Bakım ve BT Kullanıcı yönetimi. Sadece `http://localhost:8000` adresini açın.

### 🤝 Atomik zimmet sepeti
Birden çok varlığı tek "ya hep ya hiç" transaction'ı ile çalışana zimmetleyin; yazdırılabilir Zimmet Tutanağı otomatik oluşur. Satır kilitleri çift atamayı imkânsız kılar.

### 🎨 Özelleştirilebilir zimmet tasarımları
Canlı önizlemeli editör ile tutanakta hangi bölüm, kolon, başlık ve etiketlerin görüneceğini seçin; ayrıca birden çok görsel tema (`terminal`, `classic`, `corporate`, `slate`).

### 🛠 Bakım yaşam döngüsü
Servise gönder / geri al / hurdaya ayır; onarım öncesi zimmet durumu otomatik geri yüklenir. Fatura, servis raporu ve fotoğrafları cihaza bağlı tutun.

### 📄 Yazılım lisansları
Koltuk havuzları, atomik tahsis/bırakma, 30 gün kala uyarılar ve lisansın kimlerde olduğunun CSV export'u.

</td>
<td width="50%" valign="top">

### 🔐 Rol tabanlı yetkilendirme
`Owner`, `Admin`, `Helpdesk`, `Viewer` rolleri **her** endpoint'te uygulanır; her istekte tekrar kontrol edilir, böylece değişiklikler anında etki eder.

### 🧾 Tam denetim izi
Her zimmet / iade / onarım / yazılım-zimmeti kim, ne zaman, neden bilgisiyle kişi bazlı aktivite zaman çizgisinde; kullanıcı bazlı login geçmişi.

### ⏳ Ürün yaşam döngüsü (EOL)
Kategori başına yaşam süresi + cihaza özel override (ör. MacBook 5 yıl). Her varlıkta EOL tarihi ve "EOL soon" / gecikti rozetleri.

### 📈 Raporlar & oluşturucu
19 gruplu hazır rapor + oluşturucu (7 veri kaynağı × seçilebilir kolon × filtre), Excel uyumlu CSV veya antetli yazdırma.

### 📁 Belge arşivi & 📦 sarf malzemeleri
İmzalı zimmet taramaları ve onarım evrakları yükleyin (DB'de saklanır, yedeklere dahil). Sarf malzeme stok hareketlerini kritik stok uyarılarıyla takip edin.

</td>
</tr>
</table>

> 🚀 **İlk kullanım sihirbazı** şirket adı, logo ve Owner hesabını belirler; marka arayüze ve her yazdırılan tutanağa uygulanır.
> 🧪 **Demo veri seti** — `npm run seed:demo` Postgres'i gerçekçi bir şirketle doldurur; `SEED_EMPLOYEES=2000 npm run seed:demo -- --reset` ile ölçekler.

---

## 🧰 Teknoloji yığını

| Katman | Teknoloji |
|---|---|
| **Çalışma ortamı** | Node.js ≥ 20, Express 4 |
| **Veritabanı** | PostgreSQL 16 (açılışta otomatik migrasyon) |
| **Kimlik doğrulama** | JWT (HS256) + bcrypt (cost 12), rol tabanlı middleware |
| **Frontend** | Backend'in sunduğu vanilla JS SPA — **build adımı yok** |
| **PDF / etiket** | PDFKit + QR kodlar, özel zimmet şablonları |
| **Paketleme** | Docker + Docker Compose |

---

## 🚀 Hızlı başlangıç — Docker Compose

Her şey otomatiktir: veritabanı konteyneri oluşturulur, şema uygulanır ve ilk Admin (Owner) hesabı tohumlanır.

```bash
git clone https://github.com/<siz>/itacm.git
cd itacm

npm install
npm run setup          # güçlü secret'larla .env üretir (veya .env.example'ı kopyalayın)

docker compose up -d
docker compose logs api   # ilk çalıştırmada Owner bilgileri burada yazdırılır
```

Ardından **http://localhost:8000** adresini açın — ilk açılışta onboarding sihirbazı gelir: şirket adı/logo belirleyip **Owner** hesabını oluşturursunuz.

> [!TIP]
> `ADMIN_PASSWORD` boş bırakılırsa güçlü rastgele bir şifre üretilir ve loglarda **bir kez** gösterilir. İlk girişten sonra değiştirin.

Elle yapılandırmayı mı tercih edersiniz? `.env.example`'ı `.env`'e kopyalayın, en azından `JWT_SECRET` (`openssl rand -hex 32`) ayarlayın, sonra `docker compose up -d`.

---

## 🌍 Sunucuya yayına alma

Compose dosyası Docker kurulu her sunucuda aynen çalışır. 8000 portunun önüne TLS'li bir reverse proxy (Caddy / Nginx / Traefik) koyun ve gerekiyorsa `CORS_ORIGINS` değerini frontend adresinize ayarlayın.

Yönetilen platformlarda (Railway, Render, Fly.io, Cloud Run…) `Dockerfile`'ı deploy edin, bir Postgres eklentisi bağlayın ve aynı env değişkenlerini (`DATABASE_URL`, `PGSSL=true`, `JWT_SECRET`, `ADMIN_*`) girin. Şema açılışta otomatik uygulanır.

---

## 💾 Yedekleme & kurtarma

Tüm sisteminiz — cihazlar, çalışanlar, zimmet tutanakları, denetim geçmişi ve belge arşivi (taranmış/üretilmiş PDF'ler) — PostgreSQL içinde tutulur. Düzenli olarak yedek alın.

```bash
npm run backup                 # → backups/itacm-YYYYMMDD-HHMMSS.sql.gz
npm run restore backups/itacm-20260707-120000.sql.gz   # mevcut veriyi değiştirir (onay ister)
```

Tek bir yedek her şeyi kapsar (belge arşivi de veritabanının içindedir). `backups/` klasörünü güvenli bir yere kopyalayın veya komutu cron ile zamanlayın; ör. her gün 02:00'de:

```cron
0 2 * * *  cd /path/to/ITACM && npm run backup
```

### Veritabanı şifresini değiştirme

`POSTGRES_PASSWORD`, veritabanı volume'ü ilk oluşturulduğunda sabitlenir. **`.env` içinde değiştirip yeniden başlatmak işe yaramaz** — API kimlik doğrulayamaz. Veri kaybı olmadan güvenli şekilde değiştirmek için:

```bash
npm run change-db-password
```

> [!WARNING]
> **Asla `docker compose down -v` çalıştırmayın.** `-v` bayrağı veritabanı volume'ünü siler ve tüm verinizi kalıcı olarak yok eder. API bir gün `password authentication failed` hatası verirse `npm run change-db-password` çalıştırın (ya da `.env` içindeki eski şifreyi geri koyun) — volume'ü silmeyin.

---

## ⚙️ Yapılandırma referansı

| Değişken | Zorunlu | Açıklama |
|---|:---:|---|
| `PORT` | – | HTTP portu (varsayılan `8000`) |
| `CORS_ORIGINS` | – | Virgülle ayrılmış izinli origin'ler (boş = same-origin) |
| `DATABASE_URL` | ✅ | `postgres://user:pass@host:5432/db` (veya `POSTGRES_URL`) |
| `PGSSL` | – | TLS'li yönetilen Postgres için `true` |
| `JWT_SECRET` | ✅ | En az 32 karakter — `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | – | Token ömrü (varsayılan `12h`) |
| `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | – | İlk Owner (şifre boşsa otomatik üretilir) |

docker compose ile `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` hem veritabanı konteynerini hem de API'nin `DATABASE_URL`'ini besler.

---

## 🔌 API referansı

Tüm yanıtlar `{ success, data }` veya `{ success: false, error, details? }` biçimindedir. `login` / `health` dışındaki tüm endpoint'ler `Authorization: Bearer <TOKEN>` ister.

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

<details>
<summary><b>Atomik zimmet sepeti — nasıl çalışır</b></summary>

<br />

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

**Tek transaction** içinde (Postgres `BEGIN … FOR UPDATE` satır kilitleri): her varlığın `In Stock` olduğu doğrulanır → tutanak belgesi oluşturulur → her varlık çalışana bağlı `Assigned` durumuna geçer → çalışanın `activeAssetCount` sayacı artar → her varlık için bir denetim satırı yazılır.

Sepetteki **tek bir** varlık bile kilitliyse API, varlık bazında çakışma listesiyle `409` döner ve **hiçbir şey yazılmaz**. Satır kilitleri / transaction yeniden denemeleri sayesinde iki operatörün aynı laptopu aynı anda zimmetlemesi imkânsızdır.

</details>

---

## 🔒 Güvenlik notları

- **Gizli bilgiler asla repoda yaşamaz.** `.env` git tarafından yok sayılır; kurulum sihirbazı `.env` dosyasını `0600` izniyle yazar ve güçlü bir `JWT_SECRET` + DB şifresi üretir.
- **Kimlik doğrulama:** şifreler bcrypt ile hash'lenir (cost 12); JWT'ler ≥32 karakterlik gizli anahtarla HS256 imzalanır; girişte bilinmeyen e-posta ile yanlış şifre aynı hatayı döndürür (hesap taraması engellenir); her istekte kullanıcı satırı tekrar okunur, böylece rol değişikliği/silme anında etki eder.
- **Sıkılaştırma:** katı Content-Security-Policy (inline script yok), HSTS, nosniff / frame-deny / referrer / permissions-policy başlıkları, login rate-limit (15 dk'da 20 deneme/IP), genel API rate-limit (5 dk'da 1000 istek/IP), varsayılan same-origin CORS, 1 MB body limiti, `x-powered-by` kapalı, tek seferlik onboarding endpoint'i, `npm audit`-temiz bağımlılık ağacı.
- **İletişim:** API'nin önüne HTTPS koyun (VPS'te Caddy / Nginx / Traefik). `CORS_ORIGINS` değerini frontend'inizin tam adresine ayarlayın.

---

## 🗂 Proje yapısı

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

---

## 🧑‍💻 Geliştirme

```bash
npm install
npm run setup      # veya .env'i elle yazın
npm run dev        # otomatik yeniden başlayan yerel sunucu
npm run lint       # söz dizimi denetimi
npm run migrate    # Postgres şemasını elle uygula (opsiyonel)
```

---

## 📜 Lisans

[MIT](LICENSE) lisansı ile yayınlanmıştır.

<div align="center">
<br />
<sub><a href="https://github.com/enesyakisik">Enes Yakışık</a> tarafından ❤️ ile geliştirildi · ITACM işinize yaradıysa bir ⭐ bırakmayı düşünün</sub>
</div>
