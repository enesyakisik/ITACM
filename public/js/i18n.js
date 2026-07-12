/*
 * Lightweight i18n for the app chrome (navigation, login, topbar, common
 * buttons). 12 languages; every key falls back to English, so untranslated
 * screens simply stay in English until their keys are added here.
 *
 * Language resolution: per-browser choice (localStorage) → instance default
 * (app_settings.language via /api/config) → English.
 */
(function () {
  const LANGS = {
    en: 'English', tr: 'Türkçe', de: 'Deutsch', fr: 'Français', es: 'Español',
    it: 'Italiano', pt: 'Português', nl: 'Nederlands', pl: 'Polski',
    ru: 'Русский', ar: 'العربية', ja: '日本語',
  };

  // key → per-language strings (en is the required fallback)
  const D = {
    'nav.dashboard': { en: 'Dashboard', tr: 'Panel', de: 'Übersicht', fr: 'Tableau de bord', es: 'Panel', it: 'Pannello', pt: 'Painel', nl: 'Dashboard', pl: 'Pulpit', ru: 'Панель', ar: 'لوحة التحكم', ja: 'ダッシュボード' },
    'nav.hardware': { en: 'Hardware', tr: 'Donanım', de: 'Hardware', fr: 'Matériel', es: 'Hardware', it: 'Hardware', pt: 'Hardware', nl: 'Hardware', pl: 'Sprzęt', ru: 'Оборудование', ar: 'الأجهزة', ja: 'ハードウェア' },
    'nav.catalog': { en: 'Product Catalog', tr: 'Ürün Kataloğu', de: 'Produktkatalog', fr: 'Catalogue produits', es: 'Catálogo', it: 'Catalogo', pt: 'Catálogo', nl: 'Productcatalogus', pl: 'Katalog produktów', ru: 'Каталог', ar: 'كتالوج المنتجات', ja: '製品カタログ' },
    'nav.software': { en: 'Software & Licenses', tr: 'Yazılım ve Lisanslar', de: 'Software & Lizenzen', fr: 'Logiciels et licences', es: 'Software y licencias', it: 'Software e licenze', pt: 'Software e licenças', nl: 'Software & licenties', pl: 'Oprogramowanie i licencje', ru: 'ПО и лицензии', ar: 'البرامج والتراخيص', ja: 'ソフトウェアとライセンス' },
    'nav.consumables': { en: 'Consumables', tr: 'Sarf Malzemeleri', de: 'Verbrauchsmaterial', fr: 'Consommables', es: 'Consumibles', it: 'Consumabili', pt: 'Consumíveis', nl: 'Verbruiksartikelen', pl: 'Materiały eksploatacyjne', ru: 'Расходники', ar: 'المستهلكات', ja: '消耗品' },
    'nav.lines': { en: 'Mobile Lines', tr: 'Mobil Hatlar', de: 'Mobilfunknummern', fr: 'Lignes mobiles', es: 'Líneas móviles', it: 'Linee mobili', pt: 'Linhas móveis', nl: 'Mobiele lijnen', pl: 'Linie komórkowe', ru: 'Мобильные линии', ar: 'خطوط الجوال', ja: 'モバイル回線' },
    'nav.employees': { en: 'Employees', tr: 'Çalışanlar', de: 'Mitarbeiter', fr: 'Employés', es: 'Empleados', it: 'Dipendenti', pt: 'Funcionários', nl: 'Medewerkers', pl: 'Pracownicy', ru: 'Сотрудники', ar: 'الموظفون', ja: '従業員' },
    'nav.handover': { en: 'Handover Ops', tr: 'Zimmet İşlemleri', de: 'Übergaben', fr: 'Remises', es: 'Entregas', it: 'Consegne', pt: 'Entregas', nl: 'Overdrachten', pl: 'Przekazania', ru: 'Передачи', ar: 'عمليات التسليم', ja: '引き渡し' },
    'nav.maintenance': { en: 'Maintenance & Repair', tr: 'Bakım ve Onarım', de: 'Wartung & Reparatur', fr: 'Maintenance', es: 'Mantenimiento', it: 'Manutenzione', pt: 'Manutenção', nl: 'Onderhoud', pl: 'Konserwacja i naprawa', ru: 'Обслуживание', ar: 'الصيانة والإصلاح', ja: '保守・修理' },
    'nav.stockcount': { en: 'Stock Count', tr: 'Stok Sayımı', de: 'Inventur', fr: 'Inventaire', es: 'Recuento', it: 'Inventario', pt: 'Contagem', nl: 'Voorraadtelling', pl: 'Inwentaryzacja', ru: 'Инвентаризация', ar: 'جرد المخزون', ja: '棚卸し' },
    'nav.reports': { en: 'Reports', tr: 'Raporlar', de: 'Berichte', fr: 'Rapports', es: 'Informes', it: 'Report', pt: 'Relatórios', nl: 'Rapporten', pl: 'Raporty', ru: 'Отчёты', ar: 'التقارير', ja: 'レポート' },
    'nav.users': { en: 'IT Users', tr: 'BT Kullanıcıları', de: 'IT-Benutzer', fr: 'Utilisateurs IT', es: 'Usuarios TI', it: 'Utenti IT', pt: 'Usuários de TI', nl: 'IT-gebruikers', pl: 'Użytkownicy IT', ru: 'ИТ-пользователи', ar: 'مستخدمو تقنية المعلومات', ja: 'IT ユーザー' },
    'common.save': { en: 'Save', tr: 'Kaydet', de: 'Speichern', fr: 'Enregistrer', es: 'Guardar', it: 'Salva', pt: 'Salvar', nl: 'Opslaan', pl: 'Zapisz', ru: 'Сохранить', ar: 'حفظ', ja: '保存' },
    'common.cancel': { en: 'Cancel', tr: 'İptal', de: 'Abbrechen', fr: 'Annuler', es: 'Cancelar', it: 'Annulla', pt: 'Cancelar', nl: 'Annuleren', pl: 'Anuluj', ru: 'Отмена', ar: 'إلغاء', ja: 'キャンセル' },
    'common.close': { en: 'Close', tr: 'Kapat', de: 'Schließen', fr: 'Fermer', es: 'Cerrar', it: 'Chiudi', pt: 'Fechar', nl: 'Sluiten', pl: 'Zamknij', ru: 'Закрыть', ar: 'إغلاق', ja: '閉じる' },
    'common.search': { en: 'Search', tr: 'Ara', de: 'Suchen', fr: 'Rechercher', es: 'Buscar', it: 'Cerca', pt: 'Pesquisar', nl: 'Zoeken', pl: 'Szukaj', ru: 'Поиск', ar: 'بحث', ja: '検索' },
    'common.signout': { en: 'Sign out', tr: 'Çıkış yap', de: 'Abmelden', fr: 'Se déconnecter', es: 'Cerrar sesión', it: 'Esci', pt: 'Sair', nl: 'Uitloggen', pl: 'Wyloguj', ru: 'Выйти', ar: 'تسجيل الخروج', ja: 'サインアウト' },
    'common.settings': { en: 'Settings', tr: 'Ayarlar', de: 'Einstellungen', fr: 'Paramètres', es: 'Ajustes', it: 'Impostazioni', pt: 'Configurações', nl: 'Instellingen', pl: 'Ustawienia', ru: 'Настройки', ar: 'الإعدادات', ja: '設定' },
    'common.language': { en: 'Language', tr: 'Dil', de: 'Sprache', fr: 'Langue', es: 'Idioma', it: 'Lingua', pt: 'Idioma', nl: 'Taal', pl: 'Język', ru: 'Язык', ar: 'اللغة', ja: '言語' },
    'common.newAsset': { en: 'New Asset', tr: 'Yeni Cihaz', de: 'Neues Gerät', fr: 'Nouvel actif', es: 'Nuevo activo', it: 'Nuovo asset', pt: 'Novo ativo', nl: 'Nieuw item', pl: 'Nowy zasób', ru: 'Новое устройство', ar: 'أصل جديد', ja: '新規資産' },
    'login.email': { en: 'Email', tr: 'E-posta', de: 'E-Mail', fr: 'E-mail', es: 'Correo', it: 'Email', pt: 'E-mail', nl: 'E-mail', pl: 'E-mail', ru: 'Эл. почта', ar: 'البريد الإلكتروني', ja: 'メール' },
    'login.password': { en: 'Password', tr: 'Şifre', de: 'Passwort', fr: 'Mot de passe', es: 'Contraseña', it: 'Password', pt: 'Senha', nl: 'Wachtwoord', pl: 'Hasło', ru: 'Пароль', ar: 'كلمة المرور', ja: 'パスワード' },
    'login.signin': { en: 'Sign in', tr: 'Giriş yap', de: 'Anmelden', fr: 'Se connecter', es: 'Iniciar sesión', it: 'Accedi', pt: 'Entrar', nl: 'Inloggen', pl: 'Zaloguj się', ru: 'Войти', ar: 'تسجيل الدخول', ja: 'サインイン' },
    'topbar.search': { en: 'Search assets, employees, or tags (Cmd+K)', tr: 'Cihaz, çalışan veya etiket ara (Cmd+K)', de: 'Geräte, Mitarbeiter oder Tags suchen (Cmd+K)', fr: 'Rechercher actifs, employés ou tags (Cmd+K)', es: 'Buscar activos, empleados o etiquetas (Cmd+K)', it: 'Cerca asset, dipendenti o tag (Cmd+K)', pt: 'Pesquisar ativos, funcionários ou tags (Cmd+K)', nl: 'Zoek items, medewerkers of tags (Cmd+K)', pl: 'Szukaj zasobów, pracowników lub tagów (Cmd+K)', ru: 'Поиск устройств, сотрудников, тегов (Cmd+K)', ar: 'ابحث عن الأصول أو الموظفين أو الوسوم (Cmd+K)', ja: '資産・従業員・タグを検索 (Cmd+K)' },
  };

  let current = null;
  function lang() {
    if (current) return current;
    const stored = localStorage.getItem('itacm:lang');
    if (stored && LANGS[stored]) return (current = stored);
    const inst = (typeof AppConfig !== 'undefined' && AppConfig.language) || '';
    return (current = LANGS[inst] ? inst : 'en');
  }

  function t(key) {
    const row = D[key];
    if (!row) return key;
    return row[lang()] || row.en || key;
  }

  /** Change the per-browser language and re-render (full reload keeps it simple). */
  function setLang(code, { reload = true } = {}) {
    if (!LANGS[code]) return;
    localStorage.setItem('itacm:lang', code);
    current = code;
    document.documentElement.lang = code;
    if (reload) location.reload();
  }

  /** Translate static index.html elements marked with data-i18n / data-i18n-ph. */
  function applyStaticI18n() {
    document.documentElement.lang = lang();
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  }

  window.I18N_LANGS = LANGS;
  window.t = t;
  window.i18nLang = lang;
  window.setLang = setLang;
  window.applyStaticI18n = applyStaticI18n;
})();
