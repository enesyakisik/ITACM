/*
 * Lightweight i18n for the app chrome (navigation, login, topbar, common
 * buttons, page headers, and key module screens). 12 languages; every key
 * falls back to English, so untranslated screens simply stay in English
 * until their keys are added here.
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

  /** Compact per-language row builder: en, tr, de, fr, es, it, pt, nl, pl, ru, ar, ja */
  const L = (en, tr, de, fr, es, it, pt, nl, pl, ru, ar, ja) =>
    ({ en, tr, de, fr, es, it, pt, nl, pl, ru, ar, ja });

  // key → per-language strings (en is the required fallback)
  const D = {
    /* ---------------------------- nav.* ---------------------------- */
    'nav.dashboard': L('Dashboard', 'Panel', 'Übersicht', 'Tableau de bord', 'Panel', 'Pannello', 'Painel', 'Dashboard', 'Pulpit', 'Панель', 'لوحة التحكم', 'ダッシュボード'),
    'nav.hardware': L('Hardware', 'Donanım', 'Hardware', 'Matériel', 'Hardware', 'Hardware', 'Hardware', 'Hardware', 'Sprzęt', 'Оборудование', 'الأجهزة', 'ハードウェア'),
    'nav.catalog': L('Product Catalog', 'Ürün Kataloğu', 'Produktkatalog', 'Catalogue produits', 'Catálogo', 'Catalogo', 'Catálogo', 'Productcatalogus', 'Katalog produktów', 'Каталог', 'كتالوج المنتجات', '製品カタログ'),
    'nav.software': L('Software & Licenses', 'Yazılım ve Lisanslar', 'Software & Lizenzen', 'Logiciels et licences', 'Software y licencias', 'Software e licenze', 'Software e licenças', 'Software & licenties', 'Oprogramowanie i licencje', 'ПО и лицензии', 'البرامج والتراخيص', 'ソフトウェアとライセンス'),
    'nav.consumables': L('Consumables', 'Sarf Malzemeleri', 'Verbrauchsmaterial', 'Consommables', 'Consumibles', 'Consumabili', 'Consumíveis', 'Verbruiksartikelen', 'Materiały eksploatacyjne', 'Расходники', 'المستهلكات', '消耗品'),
    'nav.lines': L('Mobile Lines', 'Mobil Hatlar', 'Mobilfunknummern', 'Lignes mobiles', 'Líneas móviles', 'Linee mobili', 'Linhas móveis', 'Mobiele lijnen', 'Linie komórkowe', 'Мобильные линии', 'خطوط الجوال', 'モバイル回線'),
    'nav.employees': L('Employees', 'Çalışanlar', 'Mitarbeiter', 'Employés', 'Empleados', 'Dipendenti', 'Funcionários', 'Medewerkers', 'Pracownicy', 'Сотрудники', 'الموظفون', '従業員'),
    'nav.handover': L('Handover Ops', 'Zimmet İşlemleri', 'Übergaben', 'Remises', 'Entregas', 'Consegne', 'Entregas', 'Overdrachten', 'Przekazania', 'Передачи', 'عمليات التسليم', '引き渡し'),
    'nav.maintenance': L('Maintenance & Repair', 'Bakım ve Onarım', 'Wartung & Reparatur', 'Maintenance', 'Mantenimiento', 'Manutenzione', 'Manutenção', 'Onderhoud', 'Konserwacja i naprawa', 'Обслуживание', 'الصيانة والإصلاح', '保守・修理'),
    'nav.stockcount': L('Stock Count', 'Stok Sayımı', 'Inventur', 'Inventaire', 'Recuento', 'Inventario', 'Contagem', 'Voorraadtelling', 'Inwentaryzacja', 'Инвентаризация', 'جرد المخزون', '棚卸し'),
    'nav.reports': L('Reports', 'Raporlar', 'Berichte', 'Rapports', 'Informes', 'Report', 'Relatórios', 'Rapporten', 'Raporty', 'Отчёты', 'التقارير', 'レポート'),
    'nav.users': L('IT Users', 'BT Kullanıcıları', 'IT-Benutzer', 'Utilisateurs IT', 'Usuarios TI', 'Utenti IT', 'Usuários de TI', 'IT-gebruikers', 'Użytkownicy IT', 'ИТ-пользователи', 'مستخدمو تقنية المعلومات', 'IT ユーザー'),

    /* -------------------------- page.*.title / page.*.sub -------------------------- */
    'page.dashboard.title': L('Dashboard Overview', 'Panel Genel Bakış', 'Übersicht Dashboard', 'Vue d\u2019ensemble', 'Resumen del panel', 'Panoramica dashboard', 'Visão geral do painel', 'Dashboardoverzicht', 'Przegląd panelu', 'Обзор панели', 'نظرة عامة على لوحة التحكم', 'ダッシュボード概要'),
    'page.dashboard.sub': L('System status, hardware distribution, and operational metrics.', 'Sistem durumu, donanım dağılımı ve operasyonel metrikler.', 'Systemstatus, Hardwareverteilung und Betriebskennzahlen.', 'État du système, répartition du matériel et indicateurs opérationnels.', 'Estado del sistema, distribución de hardware y métricas operativas.', 'Stato del sistema, distribuzione hardware e metriche operative.', 'Status do sistema, distribuição de hardware e métricas operacionais.', 'Systeemstatus, hardwareverdeling en operationele statistieken.', 'Stan systemu, rozmieszczenie sprzętu i wskaźniki operacyjne.', 'Состояние системы, распределение оборудования и операционные показатели.', 'حالة النظام وتوزيع الأجهزة والمقاييس التشغيلية.', 'システム状況、ハードウェア分布、運用指標。'),
    'page.assets.title': L('Hardware Inventory', 'Donanım Envanteri', 'Hardware-Inventar', 'Inventaire matériel', 'Inventario de hardware', 'Inventario hardware', 'Inventário de hardware', 'Hardware-inventaris', 'Inwentarz sprzętu', 'Инвентарь оборудования', 'مخزون الأجهزة', 'ハードウェア資産'),
    'page.assets.sub': L('Manage physical devices, laptops, and networking gear.', 'Fiziksel cihazları, dizüstü bilgisayarları ve ağ ekipmanlarını yönetin.', 'Verwalten Sie physische Geräte, Laptops und Netzwerkausrüstung.', 'Gérez les appareils physiques, ordinateurs portables et équipements réseau.', 'Gestione dispositivos físicos, portátiles y equipos de red.', 'Gestisci dispositivi fisici, laptop e apparecchiature di rete.', 'Gerencie dispositivos físicos, laptops e equipamentos de rede.', 'Beheer fysieke apparaten, laptops en netwerkapparatuur.', 'Zarządzaj urządzeniami fizycznymi, laptopami i sprzętem sieciowym.', 'Управляйте физическими устройствами, ноутбуками и сетевым оборудованием.', 'إدارة الأجهزة الفعلية وأجهزة الكمبيوتر المحمولة ومعدات الشبكة.', '物理デバイス、ノートPC、ネットワーク機器を管理します。'),
    'page.catalog.title': L('Product Catalog', 'Ürün Kataloğu', 'Produktkatalog', 'Catalogue produits', 'Catálogo de productos', 'Catalogo prodotti', 'Catálogo de produtos', 'Productcatalogus', 'Katalog produktów', 'Каталог продукции', 'كتالوج المنتجات', '製品カタログ'),
    'page.catalog.sub': L('Brand & model lists that power the asset form dropdowns.', 'Cihaz formu açılır listelerini besleyen marka ve model listeleri.', 'Marken- und Modelllisten für die Auswahlfelder im Gerätformular.', 'Listes de marques et modèles alimentant les menus du formulaire d\u2019actif.', 'Listas de marcas y modelos que alimentan los menús del formulario de activos.', 'Elenchi di marchi e modelli che alimentano i menu del modulo asset.', 'Listas de marcas e modelos que alimentam os menus do formulário de ativos.', 'Merk- en modellijsten voor de dropdowns van het activaformulier.', 'Listy marek i modeli zasilające listy rozwijane formularza zasobu.', 'Списки брендов и моделей для выпадающих списков формы актива.', 'قوائم العلامات التجارية والموديلات التي تشغّل القوائم المنسدلة لنموذج الأصل.', '資産フォームのドロップダウンを構成するブランド・モデル一覧。'),
    'page.licenses.title': L('Software & Licenses', 'Yazılım ve Lisanslar', 'Software & Lizenzen', 'Logiciels et licences', 'Software y licencias', 'Software e licenze', 'Software e licenças', 'Software & licenties', 'Oprogramowanie i licencje', 'ПО и лицензии', 'البرامج والتراخيص', 'ソフトウェアとライセンス'),
    'page.licenses.sub': L('Track license pools, seat usage, and renewal dates.', 'Lisans havuzlarını, koltuk kullanımını ve yenileme tarihlerini takip edin.', 'Verfolgen Sie Lizenzpools, Sitzplatznutzung und Verlängerungstermine.', 'Suivez les pools de licences, l\u2019utilisation des sièges et les dates de renouvellement.', 'Controle los pools de licencias, el uso de puestos y las fechas de renovación.', 'Monitora i pool di licenze, l\u2019utilizzo dei posti e le date di rinnovo.', 'Acompanhe pools de licenças, uso de assentos e datas de renovação.', 'Volg licentiepools, zetelgebruik en verlengingsdata.', 'Śledź pule licencji, wykorzystanie miejsc i daty odnowienia.', 'Отслеживайте пулы лицензий, использование мест и даты продления.', 'تتبّع مجمعات الترخيص واستخدام المقاعد وتواريخ التجديد.', 'ライセンスプール、席数の使用状況、更新日を追跡します。'),
    'page.lines.title': L('Mobile Lines', 'Mobil Hatlar', 'Mobilfunknummern', 'Lignes mobiles', 'Líneas móviles', 'Linee mobili', 'Linhas móveis', 'Mobiele lijnen', 'Linie komórkowe', 'Мобильные линии', 'خطوط الجوال', 'モバイル回線'),
    'page.lines.sub': L('Company SIM cards & phone numbers — who holds which line.', 'Şirket SIM kartları ve telefon numaraları — hangi hattı kim kullanıyor.', 'Firmen-SIM-Karten & Telefonnummern – wer welche Leitung nutzt.', 'Cartes SIM et numéros de téléphone de l\u2019entreprise — qui détient quelle ligne.', 'Tarjetas SIM y números de teléfono de la empresa: quién tiene cada línea.', 'SIM aziendali e numeri di telefono — chi ha quale linea.', 'Cartões SIM e números de telefone da empresa — quem tem cada linha.', 'Bedrijfs-simkaarten en telefoonnummers — wie welke lijn heeft.', 'Karty SIM firmy i numery telefonów — kto ma którą linię.', 'Корпоративные SIM-карты и номера телефонов — кто держит какую линию.', 'شرائح SIM وأرقام هواتف الشركة — من يحمل أي خط.', '会社のSIMカードと電話番号 — 誰がどの回線を保有しているか。'),
    'page.consumables.title': L('Consumables', 'Sarf Malzemeleri', 'Verbrauchsmaterial', 'Consommables', 'Consumibles', 'Consumabili', 'Consumíveis', 'Verbruiksartikelen', 'Materiały eksploatacyjne', 'Расходники', 'المستهلكات', '消耗品'),
    'page.consumables.sub': L('Track stock levels for toner, cables, and accessories.', 'Toner, kablo ve aksesuar stok seviyelerini takip edin.', 'Verfolgen Sie Lagerbestände für Toner, Kabel und Zubehör.', 'Suivez les niveaux de stock de toner, câbles et accessoires.', 'Controle los niveles de stock de tóner, cables y accesorios.', 'Monitora i livelli di stock di toner, cavi e accessori.', 'Acompanhe os níveis de estoque de toner, cabos e acessórios.', 'Volg voorraadniveaus voor toner, kabels en accessoires.', 'Śledź poziomy zapasów tonerów, kabli i akcesoriów.', 'Отслеживайте уровень запасов тонера, кабелей и аксессуаров.', 'تتبّع مستويات المخزون للحبر والكابلات والملحقات.', 'トナー、ケーブル、アクセサリーの在庫レベルを追跡します。'),
    'page.employees.title': L('Employee Directory', 'Çalışan Dizini', 'Mitarbeiterverzeichnis', 'Répertoire des employés', 'Directorio de empleados', 'Elenco dipendenti', 'Diretório de funcionários', 'Medewerkersoverzicht', 'Katalog pracowników', 'Справочник сотрудников', 'دليل الموظفين', '従業員ディレクトリ'),
    'page.employees.sub': L('Manage personnel and their assigned IT assets.', 'Personeli ve kendilerine zimmetli BT cihazlarını yönetin.', 'Verwalten Sie Personal und die zugewiesenen IT-Geräte.', 'Gérez le personnel et les actifs informatiques assignés.', 'Gestione al personal y sus activos de TI asignados.', 'Gestisci il personale e gli asset IT assegnati.', 'Gerencie funcionários e seus ativos de TI atribuídos.', 'Beheer personeel en hun toegewezen IT-middelen.', 'Zarządzaj personelem i przypisanymi zasobami IT.', 'Управляйте персоналом и назначенными ИТ-активами.', 'إدارة الموظفين وأصول تقنية المعلومات المخصصة لهم.', '従業員とその割り当てられたIT資産を管理します。'),
    'page.handover.title': L('Handover Operations', 'Zimmet İşlemleri', 'Übergabevorgänge', 'Opérations de remise', 'Operaciones de entrega', 'Operazioni di consegna', 'Operações de entrega', 'Overdrachtprocessen', 'Operacje przekazania', 'Операции передачи', 'عمليات التسليم', '引き渡し業務'),
    'page.handover.sub': L('Assign hardware to employees and generate handover protocols.', 'Çalışanlara donanım zimmetleyin ve zimmet tutanakları oluşturun.', 'Weisen Sie Mitarbeitern Hardware zu und erstellen Sie Übergabeprotokolle.', 'Attribuez du matériel aux employés et générez des protocoles de remise.', 'Asigne hardware a los empleados y genere protocolos de entrega.', 'Assegna hardware ai dipendenti e genera protocolli di consegna.', 'Atribua hardware aos funcionários e gere protocolos de entrega.', 'Wijs hardware toe aan medewerkers en genereer overdrachtsprotocollen.', 'Przypisuj sprzęt pracownikom i generuj protokoły przekazania.', 'Назначайте оборудование сотрудникам и создавайте протоколы передачи.', 'تخصيص الأجهزة للموظفين وإنشاء نماذج التسليم.', '従業員に機器を割り当て、引き渡し記録を作成します。'),
    'page.maintenance.title': L('Maintenance & Repair', 'Bakım ve Onarım', 'Wartung & Reparatur', 'Maintenance et réparation', 'Mantenimiento y reparación', 'Manutenzione e riparazione', 'Manutenção e reparo', 'Onderhoud & reparatie', 'Konserwacja i naprawa', 'Обслуживание и ремонт', 'الصيانة والإصلاح', '保守・修理'),
    'page.maintenance.sub': L('Track devices in service and repair costs.', 'Serviste olan cihazları ve onarım maliyetlerini takip edin.', 'Verfolgen Sie Geräte im Service und Reparaturkosten.', 'Suivez les appareils en service et les coûts de réparation.', 'Controle los dispositivos en servicio y los costos de reparación.', 'Monitora i dispositivi in assistenza e i costi di riparazione.', 'Acompanhe dispositivos em manutenção e custos de reparo.', 'Volg apparaten in onderhoud en reparatiekosten.', 'Śledź urządzenia w serwisie i koszty naprawy.', 'Отслеживайте устройства в обслуживании и стоимость ремонта.', 'تتبّع الأجهزة قيد الصيانة وتكاليف الإصلاح.', '修理中の機器と修理コストを追跡します。'),
    'page.stockcount.title': L('Stock Count', 'Stok Sayımı', 'Inventur', 'Inventaire', 'Recuento de stock', 'Inventario', 'Contagem de estoque', 'Voorraadtelling', 'Inwentaryzacja', 'Инвентаризация', 'جرد المخزون', '棚卸し'),
    'page.stockcount.sub': L('Physical inventory: scan devices and reconcile against the system.', 'Fiziksel envanter: cihazları tarayın ve sistemle karşılaştırın.', 'Physische Inventur: Geräte scannen und mit dem System abgleichen.', 'Inventaire physique : scannez les appareils et rapprochez-les du système.', 'Inventario físico: escanee dispositivos y compárelos con el sistema.', 'Inventario fisico: scansiona i dispositivi e riconcilia con il sistema.', 'Inventário físico: escaneie dispositivos e reconcilie com o sistema.', 'Fysieke inventarisatie: scan apparaten en vergelijk met het systeem.', 'Inwentaryzacja fizyczna: skanuj urządzenia i porównuj z systemem.', 'Физическая инвентаризация: сканируйте устройства и сверяйте с системой.', 'الجرد الفعلي: مسح الأجهزة والتحقق منها مقابل النظام.', '実地棚卸し：機器をスキャンしてシステムと照合します。'),
    'page.reports.title': L('Reports & Analytics', 'Raporlar ve Analizler', 'Berichte & Analysen', 'Rapports et analyses', 'Informes y análisis', 'Report e analisi', 'Relatórios e análises', 'Rapporten & analyses', 'Raporty i analizy', 'Отчёты и аналитика', 'التقارير والتحليلات', 'レポートと分析'),
    'page.reports.sub': L('Comprehensive view of your IT asset landscape.', 'BT varlık ortamınızın kapsamlı görünümü.', 'Umfassender Überblick über Ihre IT-Asset-Landschaft.', 'Vue complète de votre paysage d\u2019actifs informatiques.', 'Vista completa de su panorama de activos de TI.', 'Panoramica completa del panorama degli asset IT.', 'Visão abrangente do seu cenário de ativos de TI.', 'Volledig overzicht van uw IT-middelenlandschap.', 'Pełny obraz krajobrazu zasobów IT.', 'Полный обзор ландшафта ИТ-активов.', 'نظرة شاملة على مشهد أصول تقنية المعلومات لديك.', 'IT資産全体の包括的なビュー。'),
    'page.users.title': L('IT Users', 'BT Kullanıcıları', 'IT-Benutzer', 'Utilisateurs IT', 'Usuarios de TI', 'Utenti IT', 'Usuários de TI', 'IT-gebruikers', 'Użytkownicy IT', 'ИТ-пользователи', 'مستخدمو تقنية المعلومات', 'IT ユーザー'),
    'page.users.sub': L('Manage system operators and their roles.', 'Sistem operatörlerini ve rollerini yönetin.', 'Verwalten Sie Systemoperatoren und ihre Rollen.', 'Gérez les opérateurs système et leurs rôles.', 'Gestione los operadores del sistema y sus roles.', 'Gestisci gli operatori di sistema e i loro ruoli.', 'Gerencie os operadores do sistema e suas funções.', 'Beheer systeembeheerders en hun rollen.', 'Zarządzaj operatorami systemu i ich rolami.', 'Управляйте операторами системы и их ролями.', 'إدارة مشغّلي النظام وأدوارهم.', 'システム操作者とその役割を管理します。'),

    /* ---------------------------- common.* ---------------------------- */
    'common.save': L('Save', 'Kaydet', 'Speichern', 'Enregistrer', 'Guardar', 'Salva', 'Salvar', 'Opslaan', 'Zapisz', 'Сохранить', 'حفظ', '保存'),
    'common.cancel': L('Cancel', 'İptal', 'Abbrechen', 'Annuler', 'Cancelar', 'Annulla', 'Cancelar', 'Annuleren', 'Anuluj', 'Отмена', 'إلغاء', 'キャンセル'),
    'common.close': L('Close', 'Kapat', 'Schließen', 'Fermer', 'Cerrar', 'Chiudi', 'Fechar', 'Sluiten', 'Zamknij', 'Закрыть', 'إغلاق', '閉じる'),
    'common.search': L('Search', 'Ara', 'Suchen', 'Rechercher', 'Buscar', 'Cerca', 'Pesquisar', 'Zoeken', 'Szukaj', 'Поиск', 'بحث', '検索'),
    'common.signout': L('Sign out', 'Çıkış yap', 'Abmelden', 'Se déconnecter', 'Cerrar sesión', 'Esci', 'Sair', 'Uitloggen', 'Wyloguj', 'Выйти', 'تسجيل الخروج', 'サインアウト'),
    'common.settings': L('Settings', 'Ayarlar', 'Einstellungen', 'Paramètres', 'Ajustes', 'Impostazioni', 'Configurações', 'Instellingen', 'Ustawienia', 'Настройки', 'الإعدادات', '設定'),
    'common.language': L('Language', 'Dil', 'Sprache', 'Langue', 'Idioma', 'Lingua', 'Idioma', 'Taal', 'Język', 'Язык', 'اللغة', '言語'),
    'common.newAsset': L('New Asset', 'Yeni Cihaz', 'Neues Gerät', 'Nouvel actif', 'Nuevo activo', 'Nuovo asset', 'Novo ativo', 'Nieuw item', 'Nowy zasób', 'Новое устройство', 'أصل جديد', '新規資産'),
    'common.delete': L('Delete', 'Sil', 'Löschen', 'Supprimer', 'Eliminar', 'Elimina', 'Excluir', 'Verwijderen', 'Usuń', 'Удалить', 'حذف', '削除'),
    'common.edit': L('Edit', 'Düzenle', 'Bearbeiten', 'Modifier', 'Editar', 'Modifica', 'Editar', 'Bewerken', 'Edytuj', 'Изменить', 'تعديل', '編集'),
    'common.print': L('Print', 'Yazdır', 'Drucken', 'Imprimer', 'Imprimir', 'Stampa', 'Imprimir', 'Afdrukken', 'Drukuj', 'Печать', 'طباعة', '印刷'),
    'common.download': L('Download', 'İndir', 'Herunterladen', 'Télécharger', 'Descargar', 'Scarica', 'Baixar', 'Downloaden', 'Pobierz', 'Скачать', 'تنزيل', 'ダウンロード'),
    'common.upload': L('Upload', 'Yükle', 'Hochladen', 'Charger', 'Subir', 'Carica', 'Enviar', 'Uploaden', 'Wgraj', 'Загрузить', 'رفع', 'アップロード'),
    'common.add': L('Add', 'Ekle', 'Hinzufügen', 'Ajouter', 'Añadir', 'Aggiungi', 'Adicionar', 'Toevoegen', 'Dodaj', 'Добавить', 'إضافة', '追加'),
    'common.return': L('Return', 'Geri Al', 'Zurückgeben', 'Retourner', 'Devolver', 'Restituisci', 'Devolver', 'Retourneren', 'Zwróć', 'Вернуть', 'استرجاع', '返却'),
    'common.revoke': L('Revoke', 'İptal Et', 'Widerrufen', 'Révoquer', 'Revocar', 'Revoca', 'Revogar', 'Intrekken', 'Odwołaj', 'Отозвать', 'إلغاء الصلاحية', '取り消す'),
    'common.assign': L('Assign', 'Zimmetle', 'Zuweisen', 'Attribuer', 'Asignar', 'Assegna', 'Atribuir', 'Toewijzen', 'Przypisz', 'Назначить', 'تخصيص', '割り当て'),
    'common.unassign': L('Unassign', 'Zimmeti Kaldır', 'Zuweisung aufheben', 'Retirer l\u2019attribution', 'Desasignar', 'Rimuovi assegnazione', 'Remover atribuição', 'Toewijzing opheffen', 'Usuń przypisanie', 'Снять назначение', 'إلغاء التخصيص', '割り当て解除'),
    'common.yes': L('Yes', 'Evet', 'Ja', 'Oui', 'Sí', 'Sì', 'Sim', 'Ja', 'Tak', 'Да', 'نعم', 'はい'),
    'common.no': L('No', 'Hayır', 'Nein', 'Non', 'No', 'No', 'Não', 'Nee', 'Nie', 'Нет', 'لا', 'いいえ'),
    'common.loading': L('Loading…', 'Yükleniyor…', 'Wird geladen…', 'Chargement…', 'Cargando…', 'Caricamento…', 'Carregando…', 'Laden…', 'Wczytywanie…', 'Загрузка…', 'جارٍ التحميل…', '読み込み中…'),
    'common.actions': L('Actions', 'İşlemler', 'Aktionen', 'Actions', 'Acciones', 'Azioni', 'Ações', 'Acties', 'Akcje', 'Действия', 'الإجراءات', '操作'),
    'common.status': L('Status', 'Durum', 'Status', 'Statut', 'Estado', 'Stato', 'Status', 'Status', 'Status', 'Статус', 'الحالة', 'ステータス'),
    'common.filter': L('Filter', 'Filtrele', 'Filtern', 'Filtrer', 'Filtrar', 'Filtra', 'Filtrar', 'Filteren', 'Filtruj', 'Фильтр', 'تصفية', 'フィルター'),
    'common.export': L('Export', 'Dışa Aktar', 'Exportieren', 'Exporter', 'Exportar', 'Esporta', 'Exportar', 'Exporteren', 'Eksportuj', 'Экспорт', 'تصدير', 'エクスポート'),
    'common.import': L('Import', 'İçe Aktar', 'Importieren', 'Importer', 'Importar', 'Importa', 'Importar', 'Importeren', 'Importuj', 'Импорт', 'استيراد', 'インポート'),
    'common.refresh': L('Refresh', 'Yenile', 'Aktualisieren', 'Actualiser', 'Actualizar', 'Aggiorna', 'Atualizar', 'Vernieuwen', 'Odśwież', 'Обновить', 'تحديث', '更新'),
    'common.confirm': L('Confirm', 'Onayla', 'Bestätigen', 'Confirmer', 'Confirmar', 'Confirma', 'Confirmar', 'Bevestigen', 'Potwierdź', 'Подтвердить', 'تأكيد', '確認'),
    'common.back': L('Back', 'Geri', 'Zurück', 'Retour', 'Atrás', 'Indietro', 'Voltar', 'Terug', 'Wstecz', 'Назад', 'رجوع', '戻る'),
    'common.next': L('Next', 'İleri', 'Weiter', 'Suivant', 'Siguiente', 'Avanti', 'Próximo', 'Volgende', 'Dalej', 'Далее', 'التالي', '次へ'),
    'common.view': L('View', 'Görüntüle', 'Ansehen', 'Voir', 'Ver', 'Visualizza', 'Ver', 'Bekijken', 'Podgląd', 'Просмотр', 'عرض', '表示'),
    'common.camera': L('Camera', 'Kamera', 'Kamera', 'Caméra', 'Cámara', 'Fotocamera', 'Câmera', 'Camera', 'Kamera', 'Камера', 'الكاميرا', 'カメラ'),
    'common.scan': L('Scan', 'Tara', 'Scannen', 'Scanner', 'Escanear', 'Scansiona', 'Escanear', 'Scannen', 'Skanuj', 'Сканировать', 'مسح', 'スキャン'),
    'common.open': L('Open', 'Aç', 'Öffnen', 'Ouvrir', 'Abrir', 'Apri', 'Abrir', 'Openen', 'Otwórz', 'Открыть', 'فتح', '開く'),
    'common.continue': L('Continue', 'Devam Et', 'Weiter', 'Continuer', 'Continuar', 'Continua', 'Continuar', 'Doorgaan', 'Kontynuuj', 'Продолжить', 'استمرار', '続ける'),
    'common.result': L('Result', 'Sonuç', 'Ergebnis', 'Résultat', 'Resultado', 'Risultato', 'Resultado', 'Resultaat', 'Wynik', 'Результат', 'النتيجة', '結果'),
    'common.overview': L('Overview', 'Genel Bakış', 'Übersicht', 'Aperçu', 'Resumen', 'Panoramica', 'Visão geral', 'Overzicht', 'Przegląd', 'Обзор', 'نظرة عامة', '概要'),
    'common.documents': L('Documents', 'Belgeler', 'Dokumente', 'Documents', 'Documentos', 'Documenti', 'Documentos', 'Documenten', 'Dokumenty', 'Документы', 'المستندات', '文書'),
    'common.history': L('History', 'Geçmiş', 'Verlauf', 'Historique', 'Historial', 'Cronologia', 'Histórico', 'Geschiedenis', 'Historia', 'История', 'السجل', '履歴'),
    'common.unknown': L('Unknown', 'Bilinmiyor', 'Unbekannt', 'Inconnu', 'Desconocido', 'Sconosciuto', 'Desconhecido', 'Onbekend', 'Nieznany', 'Неизвестно', 'غير معروف', '不明'),
    'common.matched': L('Matched', 'Eşleşti', 'Übereinstimmung', 'Correspondant', 'Coincidente', 'Corrispondente', 'Correspondido', 'Overeenkomend', 'Dopasowano', 'Совпало', 'مطابق', '一致'),
    'common.missing': L('Missing', 'Eksik', 'Fehlend', 'Manquant', 'Faltante', 'Mancante', 'Faltante', 'Ontbrekend', 'Brakujące', 'Отсутствует', 'مفقود', '欠落'),
    'common.expected': L('Expected', 'Beklenen', 'Erwartet', 'Attendu', 'Esperado', 'Previsto', 'Esperado', 'Verwacht', 'Oczekiwane', 'Ожидается', 'المتوقع', '予定'),
    'common.found': L('Found', 'Bulundu', 'Gefunden', 'Trouvé', 'Encontrado', 'Trovato', 'Encontrado', 'Gevonden', 'Znaleziono', 'Найдено', 'تم العثور عليه', '発見'),
    'common.notifications': L('Notifications', 'Bildirimler', 'Benachrichtigungen', 'Notifications', 'Notificaciones', 'Notifiche', 'Notificações', 'Meldingen', 'Powiadomienia', 'Уведомления', 'الإشعارات', '通知'),
    'common.help': L('Help', 'Yardım', 'Hilfe', 'Aide', 'Ayuda', 'Aiuto', 'Ajuda', 'Help', 'Pomoc', 'Справка', 'مساعدة', 'ヘルプ'),

    /* ---------------------------- login.* / topbar.* ---------------------------- */
    'login.email': L('Email', 'E-posta', 'E-Mail', 'E-mail', 'Correo', 'Email', 'E-mail', 'E-mail', 'E-mail', 'Эл. почта', 'البريد الإلكتروني', 'メール'),
    'login.password': L('Password', 'Şifre', 'Passwort', 'Mot de passe', 'Contraseña', 'Password', 'Senha', 'Wachtwoord', 'Hasło', 'Пароль', 'كلمة المرور', 'パスワード'),
    'login.signin': L('Sign in', 'Giriş yap', 'Anmelden', 'Se connecter', 'Iniciar sesión', 'Accedi', 'Entrar', 'Inloggen', 'Zaloguj się', 'Войти', 'تسجيل الدخول', 'サインイン'),
    'topbar.search': L('Search assets, employees, or tags (Cmd+K)', 'Cihaz, çalışan veya etiket ara (Cmd+K)', 'Geräte, Mitarbeiter oder Tags suchen (Cmd+K)', 'Rechercher actifs, employés ou tags (Cmd+K)', 'Buscar activos, empleados o etiquetas (Cmd+K)', 'Cerca asset, dipendenti o tag (Cmd+K)', 'Pesquisar ativos, funcionários ou tags (Cmd+K)', 'Zoek items, medewerkers of tags (Cmd+K)', 'Szukaj zasobów, pracowników lub tagów (Cmd+K)', 'Поиск устройств, сотрудников, тегов (Cmd+K)', 'ابحث عن الأصول أو الموظفين أو الوسوم (Cmd+K)', '資産・従業員・タグを検索 (Cmd+K)'),

    /* ---------------------------- stock.* (Stock Count) ---------------------------- */
    'stock.startNew': L('Start New Count', 'Yeni Sayım Başlat', 'Neue Inventur starten', 'Démarrer un nouvel inventaire', 'Iniciar nuevo recuento', 'Avvia nuovo inventario', 'Iniciar nova contagem', 'Nieuwe telling starten', 'Zacznij nową inwentaryzację', 'Начать новую инвентаризацию', 'بدء جرد جديد', '新規棚卸しを開始'),
    'stock.sessions': L('Count Sessions', 'Sayım Oturumları', 'Inventursitzungen', 'Sessions d\u2019inventaire', 'Sesiones de recuento', 'Sessioni di inventario', 'Sessões de contagem', 'Telsessies', 'Sesje inwentaryzacji', 'Сеансы инвентаризации', 'جلسات الجرد', '棚卸しセッション'),
    'stock.scanPlaceholder': L('Type or scan an asset tag / serial number', 'Cihaz etiketi veya seri numarasını yazın ya da tarayın', 'Anlagenetikett / Seriennummer eingeben oder scannen', 'Saisissez ou scannez une étiquette d\u2019actif / numéro de série', 'Escriba o escanee una etiqueta de activo / número de serie', 'Digita o scansiona un tag asset / numero di serie', 'Digite ou escaneie uma etiqueta de ativo / número de série', 'Voer een activatag / serienummer in of scan het', 'Wpisz lub zeskanuj tag zasobu / numer seryjny', 'Введите или отсканируйте бирку актива / серийный номер', 'اكتب أو مسح رقم علامة الأصل / الرقم التسلسلي', '資産タグ・シリアル番号を入力またはスキャン'),
    'stock.cameraBtn': L('Camera', 'Kamera', 'Kamera', 'Caméra', 'Cámara', 'Fotocamera', 'Câmera', 'Camera', 'Kamera', 'Камера', 'الكاميرا', 'カメラ'),
    'stock.closeCompare': L('Close & Compare', 'Kapat ve Karşılaştır', 'Schließen & Vergleichen', 'Fermer et comparer', 'Cerrar y comparar', 'Chiudi e confronta', 'Fechar e comparar', 'Sluiten & vergelijken', 'Zamknij i porównaj', 'Закрыть и сравнить', 'إغلاق ومقارنة', '終了して比較'),
    'stock.tipPhone': L('Tip: on a phone, use the camera button to scan barcodes continuously.', 'İpucu: telefonda barkodları sürekli taramak için kamera düğmesini kullanın.', 'Tipp: Nutzen Sie auf dem Smartphone die Kamera-Taste, um Barcodes fortlaufend zu scannen.', 'Astuce : sur téléphone, utilisez le bouton caméra pour scanner les codes-barres en continu.', 'Consejo: en el móvil, use el botón de cámara para escanear códigos de barras de forma continua.', 'Suggerimento: su telefono, usa il pulsante fotocamera per scansionare i codici a barre in continuo.', 'Dica: no celular, use o botão da câmera para escanear códigos de barras continuamente.', 'Tip: gebruik op een telefoon de camera-knop om streepjescodes continu te scannen.', 'Wskazówka: na telefonie użyj przycisku kamery, aby skanować kody kreskowe w trybie ciągłym.', 'Совет: на телефоне используйте кнопку камеры для непрерывного сканирования штрихкодов.', 'نصيحة: على الهاتف، استخدم زر الكاميرا لمسح الرموز الشريطية بشكل متواصل.', 'ヒント：スマートフォンではカメラボタンでバーコードを連続スキャンできます。'),
    'stock.typeTagOrSerial': L('Type the asset tag or serial number instead', 'Bunun yerine cihaz etiketini veya seri numarasını yazın', 'Geben Sie stattdessen das Anlagenetikett oder die Seriennummer ein', 'Saisissez plutôt l\u2019étiquette de l\u2019actif ou le numéro de série', 'Escriba en su lugar la etiqueta del activo o el número de serie', 'Digita invece il tag asset o il numero di serie', 'Digite a etiqueta do ativo ou o número de série em vez disso', 'Voer in plaats daarvan de activatag of het serienummer in', 'Wpisz zamiast tego tag zasobu lub numer seryjny', 'Введите вместо этого бирку актива или серийный номер', 'اكتب رقم علامة الأصل أو الرقم التسلسلي بدلاً من ذلك', '代わりに資産タグまたはシリアル番号を入力してください'),
    'stock.scanCameraTitle': L('Scan with camera', 'Kamera ile Tara', 'Mit Kamera scannen', 'Scanner avec la caméra', 'Escanear con la cámara', 'Scansiona con la fotocamera', 'Escanear com a câmera', 'Scannen met camera', 'Skanuj kamerą', 'Сканировать камерой', 'المسح بالكاميرا', 'カメラでスキャン'),
    'stock.stopScanning': L('Stop scanning', 'Taramayı Durdur', 'Scannen beenden', 'Arrêter le scan', 'Detener escaneo', 'Interrompi scansione', 'Parar de escanear', 'Stop met scannen', 'Zatrzymaj skanowanie', 'Остановить сканирование', 'إيقاف المسح', 'スキャンを停止'),
    'stock.alreadyScanned': L('already scanned', 'zaten tarandı', 'bereits gescannt', 'déjà scanné', 'ya escaneado', 'già scansionato', 'já escaneado', 'al gescand', 'już zeskanowano', 'уже отсканировано', 'تم مسحه من قبل', 'スキャン済み'),
    'stock.counted': L('counted', 'sayıldı', 'gezählt', 'compté', 'contado', 'contato', 'contado', 'geteld', 'zliczono', 'подсчитано', 'تم عدّه', 'カウント済み'),
    'stock.notInInventory': L('not found in inventory', 'envanterde bulunamadı', 'nicht im Inventar gefunden', 'introuvable dans l\u2019inventaire', 'no encontrado en el inventario', 'non trovato nell\u2019inventario', 'não encontrado no inventário', 'niet gevonden in de inventaris', 'nie znaleziono w inwentarzu', 'не найдено в инвентаре', 'غير موجود في المخزون', '在庫に見つかりません'),
    'stock.countClosed': L('Count closed', 'Sayım Kapatıldı', 'Inventur abgeschlossen', 'Inventaire clôturé', 'Recuento cerrado', 'Inventario chiuso', 'Contagem encerrada', 'Telling gesloten', 'Inwentaryzacja zamknięta', 'Инвентаризация закрыта', 'تم إغلاق الجرد', '棚卸しを終了しました'),
    'stock.startCount': L('Start count', 'Sayımı Başlat', 'Inventur starten', 'Démarrer l\u2019inventaire', 'Iniciar recuento', 'Avvia inventario', 'Iniciar contagem', 'Telling starten', 'Zacznij inwentaryzację', 'Начать инвентаризацию', 'بدء الجرد', '棚卸しを開始'),
    'stock.countName': L('Count name', 'Sayım Adı', 'Inventurname', 'Nom de l\u2019inventaire', 'Nombre del recuento', 'Nome inventario', 'Nome da contagem', 'Naam van telling', 'Nazwa inwentaryzacji', 'Название инвентаризации', 'اسم الجرد', '棚卸し名'),
    'stock.limitLocation': L('Limit to location (optional)', 'Konumla sınırla (isteğe bağlı)', 'Auf Standort beschränken (optional)', 'Limiter à un emplacement (facultatif)', 'Limitar a una ubicación (opcional)', 'Limita a una sede (opzionale)', 'Limitar a um local (opcional)', 'Beperken tot locatie (optioneel)', 'Ogranicz do lokalizacji (opcjonalnie)', 'Ограничить местоположением (необязательно)', 'الحصر بموقع معيّن (اختياري)', '拠点を指定（任意）'),
    'stock.allLocations': L('All locations', 'Tüm Konumlar', 'Alle Standorte', 'Tous les emplacements', 'Todas las ubicaciones', 'Tutte le sedi', 'Todos os locais', 'Alle locaties', 'Wszystkie lokalizacje', 'Все местоположения', 'جميع المواقع', 'すべての拠点'),

    /* ---------------------------- emp.* (Employee detail) ---------------------------- */
    'emp.assignedAssets': L('Assigned Assets', 'Zimmetli Cihazlar', 'Zugewiesene Geräte', 'Actifs attribués', 'Activos asignados', 'Asset assegnati', 'Ativos atribuídos', 'Toegewezen items', 'Przypisane zasoby', 'Назначенные устройства', 'الأصول المخصصة', '割り当て済み資産'),
    'emp.assignedSoftware': L('Assigned Software', 'Zimmetli Yazılımlar', 'Zugewiesene Software', 'Logiciels attribués', 'Software asignado', 'Software assegnato', 'Software atribuído', 'Toegewezen software', 'Przypisane oprogramowanie', 'Назначенное ПО', 'البرامج المخصصة', '割り当て済みソフトウェア'),
    'emp.mobileLines': L('Mobile Lines', 'Mobil Hatlar', 'Mobilfunknummern', 'Lignes mobiles', 'Líneas móviles', 'Linee mobili', 'Linhas móveis', 'Mobiele lijnen', 'Linie komórkowe', 'Мобильные линии', 'خطوط الجوال', 'モバイル回線'),
    'emp.handoverReceipts': L('Handover Receipts', 'Zimmet Tutanakları', 'Übergabeprotokolle', 'Reçus de remise', 'Recibos de entrega', 'Ricevute di consegna', 'Recibos de entrega', 'Overdrachtsbonnen', 'Protokoły przekazania', 'Акты передачи', 'إيصالات التسليم', '引き渡し記録'),
    'emp.activityHistory': L('Activity History', 'Etkinlik Geçmişi', 'Aktivitätsverlauf', 'Historique d\u2019activité', 'Historial de actividad', 'Cronologia attività', 'Histórico de atividades', 'Activiteitengeschiedenis', 'Historia aktywności', 'История активности', 'سجل النشاط', 'アクティビティ履歴'),
    'emp.noAssets': L('No assets assigned.', 'Zimmetli cihaz yok.', 'Keine Geräte zugewiesen.', 'Aucun actif attribué.', 'No hay activos asignados.', 'Nessun asset assegnato.', 'Nenhum ativo atribuído.', 'Geen items toegewezen.', 'Brak przypisanych zasobów.', 'Устройства не назначены.', 'لا توجد أصول مخصصة.', '割り当てられた資産はありません。'),
    'emp.noSoftware': L('No software assigned.', 'Zimmetli yazılım yok.', 'Keine Software zugewiesen.', 'Aucun logiciel attribué.', 'No hay software asignado.', 'Nessun software assegnato.', 'Nenhum software atribuído.', 'Geen software toegewezen.', 'Brak przypisanego oprogramowania.', 'ПО не назначено.', 'لا توجد برامج مخصصة.', '割り当てられたソフトウェアはありません。'),
    'emp.noLines': L('No mobile lines assigned.', 'Zimmetli mobil hat yok.', 'Keine Mobilfunknummern zugewiesen.', 'Aucune ligne mobile attribuée.', 'No hay líneas móviles asignadas.', 'Nessuna linea mobile assegnata.', 'Nenhuma linha móvel atribuída.', 'Geen mobiele lijnen toegewezen.', 'Brak przypisanych linii komórkowych.', 'Мобильные линии не назначены.', 'لا توجد خطوط جوال مخصصة.', '割り当てられたモバイル回線はありません。'),
    'emp.assignSoftware': L('Assign Software', 'Yazılım Zimmetle', 'Software zuweisen', 'Attribuer un logiciel', 'Asignar software', 'Assegna software', 'Atribuir software', 'Software toewijzen', 'Przypisz oprogramowanie', 'Назначить ПО', 'تخصيص برنامج', 'ソフトウェアを割り当て'),
    'emp.assignLine': L('Assign Line', 'Hat Zimmetle', 'Leitung zuweisen', 'Attribuer une ligne', 'Asignar línea', 'Assegna linea', 'Atribuir linha', 'Lijn toewijzen', 'Przypisz linię', 'Назначить линию', 'تخصيص خط', '回線を割り当て'),
    'emp.unassign': L('Unassign', 'Zimmeti Kaldır', 'Zuweisung aufheben', 'Retirer l\u2019attribution', 'Desasignar', 'Rimuovi assegnazione', 'Remover atribuição', 'Toewijzing opheffen', 'Usuń przypisanie', 'Снять назначение', 'إلغاء التخصيص', '割り当て解除'),
    'emp.returnAsset': L('Return Asset', 'Cihazı Geri Al', 'Gerät zurückgeben', 'Retourner l\u2019actif', 'Devolver activo', 'Restituisci asset', 'Devolver ativo', 'Item retourneren', 'Zwróć zasób', 'Вернуть устройство', 'استرجاع الأصل', '資産を返却'),
    'emp.generateForm': L('Generate Form', 'Form Oluştur', 'Formular erstellen', 'Générer le formulaire', 'Generar formulario', 'Genera modulo', 'Gerar formulário', 'Formulier genereren', 'Generuj formularz', 'Создать форму', 'إنشاء نموذج', 'フォームを生成'),
    'emp.uploadScan': L('Upload scan', 'Taramayı Yükle', 'Scan hochladen', 'Charger le scan', 'Subir escaneo', 'Carica scansione', 'Enviar digitalização', 'Scan uploaden', 'Wgraj skan', 'Загрузить скан', 'رفع المسح الممسوح', 'スキャンをアップロード'),
    'emp.signedScan': L('Signed scan', 'İmzalı Tarama', 'Unterschriebener Scan', 'Scan signé', 'Escaneo firmado', 'Scansione firmata', 'Digitalização assinada', 'Ondertekende scan', 'Podpisany skan', 'Подписанный скан', 'مسح موقّع', '署名済みスキャン'),
    'emp.generated': L('Generated', 'Oluşturuldu', 'Generiert', 'Généré', 'Generado', 'Generato', 'Gerado', 'Gegenereerd', 'Wygenerowano', 'Создано', 'تم إنشاؤه', '生成済み'),

    /* ---------------------------- lines.* (Mobile Lines) ---------------------------- */
    'lines.phone': L('Phone Number', 'Telefon Numarası', 'Telefonnummer', 'Numéro de téléphone', 'Número de teléfono', 'Numero di telefono', 'Número de telefone', 'Telefoonnummer', 'Numer telefonu', 'Номер телефона', 'رقم الهاتف', '電話番号'),
    'lines.operator': L('Operator', 'Operatör', 'Anbieter', 'Opérateur', 'Operador', 'Operatore', 'Operadora', 'Provider', 'Operator', 'Оператор', 'المشغّل', '通信会社'),
    'lines.plan': L('Plan', 'Tarife', 'Tarif', 'Forfait', 'Plan', 'Piano', 'Plano', 'Abonnement', 'Plan', 'Тариф', 'الباقة', 'プラン'),
    'lines.sim': L('SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'SIM', 'شريحة SIM', 'SIM'),
    'lines.assign': L('Assign', 'Zimmetle', 'Zuweisen', 'Attribuer', 'Asignar', 'Assegna', 'Atribuir', 'Toewijzen', 'Przypisz', 'Назначить', 'تخصيص', '割り当て'),
    'lines.unassign': L('Take back', 'Geri Al', 'Zurücknehmen', 'Reprendre', 'Recuperar', 'Riprendi', 'Retomar', 'Terugnemen', 'Odbierz', 'Забрать обратно', 'استرجاع', '回収'),
    'lines.noLinesYet': L('No mobile lines yet.', 'Henüz mobil hat yok.', 'Noch keine Mobilfunknummern.', 'Aucune ligne mobile pour le moment.', 'Aún no hay líneas móviles.', 'Nessuna linea mobile ancora.', 'Ainda não há linhas móveis.', 'Nog geen mobiele lijnen.', 'Brak jeszcze linii komórkowych.', 'Мобильных линий пока нет.', 'لا توجد خطوط جوال حتى الآن.', 'モバイル回線はまだありません。'),

    /* ---------------------------- doc.* ---------------------------- */
    'doc.previewUnavailable': L('Preview unavailable', 'Önizleme kullanılamıyor', 'Vorschau nicht verfügbar', 'Aperçu indisponible', 'Vista previa no disponible', 'Anteprima non disponibile', 'Pré-visualização indisponível', 'Voorbeeld niet beschikbaar', 'Podgląd niedostępny', 'Предпросмотр недоступен', 'المعاينة غير متاحة', 'プレビュー不可'),
    'doc.clickToView': L('Click to view', 'Görüntülemek için tıklayın', 'Zum Anzeigen klicken', 'Cliquez pour afficher', 'Haga clic para ver', 'Clicca per visualizzare', 'Clique para visualizar', 'Klik om te bekijken', 'Kliknij, aby wyświetlić', 'Нажмите, чтобы просмотреть', 'اضغط للعرض', 'クリックして表示'),
  };

  let current = null;
  let enIndex = null;

  function lang() {
    if (current) return current;
    const stored = localStorage.getItem('itacm:lang');
    if (stored && LANGS[stored]) return (current = stored);
    const inst = (typeof AppConfig !== 'undefined' && AppConfig.language) || '';
    return (current = LANGS[inst] ? inst : 'en');
  }

  function pick(row) {
    return row[lang()] || row.en || '';
  }

  /**
   * Translate by key (`nav.dashboard`) OR by exact English phrase
   * (`Dashboard Overview`). English-phrase lookup lets templates keep
   * readable English source while still translating when a matching `en`
   * value exists in the dictionary.
   */
  function t(key) {
    if (key == null || key === '') return '';
    const row = D[key];
    if (row) return pick(row);
    if (!enIndex) {
      enIndex = Object.create(null);
      for (const v of Object.values(D)) {
        if (v && v.en && !enIndex[v.en]) enIndex[v.en] = v;
      }
    }
    const byEn = enIndex[key];
    if (byEn) return pick(byEn);
    return key;
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
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  }

  window.I18N_LANGS = LANGS;
  window.t = t;
  window.i18nLang = lang;
  window.setLang = setLang;
  window.applyStaticI18n = applyStaticI18n;
})();
