#!/usr/bin/env node
/**
 * Demo data seeder (postgres mode) — simulates a ~500-employee company:
 *   500 employees, ~750 assets, handover receipts + full audit history,
 *   20 license pools with per-employee assignments, consumables, repairs.
 *
 *   npm run seed:demo          (aborts if the DB already has real data)
 *   npm run seed:demo -- --force
 */
require('dotenv').config();
const config = require('../src/config');

if (config.backend !== 'postgres') {
  console.error('seed-demo runs in DATA_BACKEND=postgres mode only.');
  process.exit(1);
}

const { pool, query } = require('../src/providers/postgres/pool');
const { DEFAULT_LOCATIONS } = require('../src/utils/defaults');
const { ensureDatabase } = require('../src/providers/postgres/migrate');

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rnd(arr.length)];
const chance = (p) => Math.random() < p;
const pad = (n, w = 4) => String(n).padStart(w, '0');
const daysAgo = (d) => new Date(Date.now() - d * 86400000);
const daysAhead = (d) => new Date(Date.now() + d * 86400000);
const hex = '0123456789ABCDEF';
const mac = () => Array.from({ length: 6 }, () => hex[rnd(16)] + hex[rnd(16)]).join(':');
const serial = (p) => p + Array.from({ length: 8 }, () => hex[rnd(36) % 16] + '').join('').slice(0, 8) + rnd(999);

const FIRST = ['Ahmet','Mehmet','Mustafa','Ali','Hüseyin','Hasan','İbrahim','Osman','Yusuf','Murat','Emre','Burak','Caner','Deniz','Efe','Furkan','Gökhan','Halil','Kaan','Kerem','Levent','Onur','Serkan','Tolga','Umut','Volkan','Ayşe','Fatma','Emine','Hatice','Zeynep','Elif','Meryem','Şerife','Sultan','Hanife','Merve','Büşra','Esra','Kübra','Rabia','Selin','Derya','Ebru','Gamze','Pınar','Seda','Tuğba','Yasemin','Özge'];
const LAST = ['Yılmaz','Kaya','Demir','Şahin','Çelik','Yıldız','Yıldırım','Öztürk','Aydın','Özdemir','Arslan','Doğan','Kılıç','Aslan','Çetin','Kara','Koç','Kurt','Özkan','Şimşek','Polat','Korkmaz','Erdoğan','Güneş','Aktaş','Bulut','Turan','Kaplan','Avcı','Sarı'];
const DEPTS = [
  ['Yazılım Geliştirme', ['Yazılım Mühendisi','Kıdemli Yazılım Mühendisi','Takım Lideri','QA Mühendisi','DevOps Mühendisi']],
  ['Bilgi Teknolojileri', ['Sistem Yöneticisi','Ağ Uzmanı','BT Destek Uzmanı','Güvenlik Analisti']],
  ['Finans', ['Muhasebe Uzmanı','Finans Analisti','Bütçe Uzmanı','Mali İşler Müdürü']],
  ['İnsan Kaynakları', ['İK Uzmanı','İşe Alım Uzmanı','Bordro Uzmanı','İK Müdürü']],
  ['Satış', ['Satış Temsilcisi','Satış Müdürü','İş Geliştirme Uzmanı','Müşteri Yöneticisi']],
  ['Pazarlama', ['Pazarlama Uzmanı','Dijital Pazarlama Uzmanı','İçerik Editörü','Marka Yöneticisi']],
  ['Operasyon', ['Operasyon Uzmanı','Lojistik Uzmanı','Tedarik Uzmanı','Operasyon Müdürü']],
  ['Müşteri Hizmetleri', ['Müşteri Temsilcisi','Çağrı Merkezi Uzmanı','Destek Ekip Lideri']],
  ['Hukuk', ['Avukat','Hukuk Müşaviri','Uyum Uzmanı']],
  ['Tasarım', ['UI/UX Tasarımcısı','Grafik Tasarımcı','Ürün Tasarımcısı']],
];
const HW = {
  Laptop:  { brands: [['Lenovo',['ThinkPad T14','ThinkPad X1 Carbon','ThinkPad E15']], ['Dell',['Latitude 5440','Latitude 7430','XPS 13']], ['HP',['EliteBook 840','ProBook 450']], ['Apple',['MacBook Pro 14"','MacBook Air M2']]], sn: 'LT', specs: true, mac: true },
  Desktop: { brands: [['Dell',['OptiPlex 7010','OptiPlex 5000']], ['HP',['ProDesk 400','EliteDesk 800']], ['Lenovo',['ThinkCentre M70']]], sn: 'DT', specs: true, mac: true },
  Monitor: { brands: [['Dell',['U2723QE','P2422H','S2721DS']], ['LG',['27UP850','24MP60G']], ['Samsung',['S27A600','F27T350']]], sn: 'MN', specs: false, mac: false },
  Phone:   { brands: [['Apple',['iPhone 14','iPhone 15','iPhone 13']], ['Samsung',['Galaxy S23','Galaxy A54']]], sn: 'PH', specs: false, mac: true },
  Printer: { brands: [['HP',['LaserJet Pro M404','LaserJet M283']], ['Canon',['i-SENSYS MF445']], ['Brother',['HL-L2350DW']]], sn: 'PR', specs: false, mac: true },
  Network: { brands: [['Cisco',['Catalyst 2960','Catalyst 9200']], ['Ubiquiti',['UniFi Switch 24','UniFi AP AC Pro']], ['MikroTik',['CRS326']]], sn: 'NW', specs: false, mac: true },
  Peripheral: { brands: [['Logitech',['MX Master 3S','MX Keys','C920 Webcam']], ['Jabra',['Evolve2 65']]], sn: 'PE', specs: false, mac: false },
};
const CPUS = ['Intel i5-1235U','Intel i7-1355U','Ryzen 5 5600U','Ryzen 7 7840U','Apple M2'];
const RAMS = ['8GB','16GB','32GB'];
const DISKS = ['256GB SSD','512GB SSD','1TB SSD'];
const OSES = ['Windows 11 Pro','Windows 10 Pro','macOS Sonoma','Ubuntu 22.04'];
const LICENSES = [
  ['Microsoft 365 E3','Microsoft',300],['Adobe Creative Cloud','Adobe',40],['JetBrains All Products','JetBrains',60],
  ['Figma Organization','Figma',35],['Slack Business+','Slack',450],['Zoom Pro','Zoom',120],['AutoCAD','Autodesk',15],
  ['Windows Server CAL','Microsoft',200],['ESET Endpoint Security','ESET',500],['Cisco AnyConnect VPN','Cisco',400],
  ['Atlassian Jira','Atlassian',150],['GitHub Enterprise','GitHub',80],['Notion Team','Notion',100],['1Password Business','1Password',250],
  ['Tableau Creator','Salesforce',12],['SAP ERP User','SAP',90],['Miro Business','Miro',50],['Postman Enterprise','Postman',40],
  ['SolidWorks','Dassault',8],['Camtasia','TechSmith',10],
];
const CONSUMABLES = [
  ['HP 85A Toner',3,5],['HP 26A Toner',12,5],['Canon 052 Toner',2,4],['USB-C Kablo',45,15],['HDMI Kablo',30,10],
  ['USB-C Adaptör',8,10],['Kablosuz Mouse',25,10],['Klavye (TR-Q)',18,8],['Laptop Çantası',22,10],['Ethernet Kablosu Cat6 (3m)',60,20],
  ['AA Pil (4lü)',40,15],['Webcam Kapağı',100,20],['Laptop Standı',6,8],['Docking Station',4,5],['Temizlik Kiti',14,5],
];

async function main() {
  const force = process.argv.includes('--force');
  await ensureDatabase();

  const { rows: [{ n }] } = await query('SELECT COUNT(*)::int AS n FROM employees');
  if (n > 20 && !force) {
    console.error(`DB already has ${n} employees. Re-run with --force to seed anyway.`);
    process.exit(1);
  }

  const { rows: admins } = await query(`SELECT id, username FROM users WHERE role = 'Admin' LIMIT 1`);
  const admin = admins[0] || { id: 'system', username: 'System' };
  const by = [admin.id, admin.username];

  console.log('[seed] employees…');
  const employees = [];
  const usedEmails = new Set();
  for (let i = 0; i < 500; i++) {
    const f = pick(FIRST), l = pick(LAST);
    let email = `${f}.${l}`.toLowerCase().replace(/ı/g,'i').replace(/ş/g,'s').replace(/ç/g,'c')
      .replace(/ö/g,'o').replace(/ü/g,'u').replace(/ğ/g,'g') + '@firma.com.tr';
    if (usedEmails.has(email)) email = email.replace('@', `${i}@`);
    usedEmails.add(email);
    const [dept, titles] = pick(DEPTS);
    employees.push({ name: `${f} ${l}`, email, dept, title: pick(titles), status: chance(0.95) ? 'Active' : 'Inactive' });
  }
  for (const e of employees) {
    const { rows } = await query(
      `INSERT INTO employees (full_name, email, department, title, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [e.name, e.email, e.dept, e.title, e.status, daysAgo(rnd(900) + 30)]
    );
    e.id = rows[0].id;
  }
  const activeEmps = employees.filter((e) => e.status === 'Active');

  console.log('[seed] assets…');
  const assets = [];
  let tagNo = 2000;
  const counts = { Laptop: 340, Desktop: 90, Monitor: 160, Phone: 80, Printer: 25, Network: 30, Peripheral: 45 };
  for (const [cat, cnt] of Object.entries(counts)) {
    const def = HW[cat];
    for (let i = 0; i < cnt; i++) {
      const [brand, models] = pick(def.brands);
      assets.push({
        tag: `IT-${pad(tagNo++)}`, cat, brand, model: pick(models),
        sn: serial(def.sn), macE: def.mac && chance(0.7) ? mac() : null, macW: def.mac && chance(0.8) ? mac() : null,
        specs: def.specs ? { cpu: pick(CPUS), ram: pick(RAMS), storage: pick(DISKS), os: pick(OSES) } : {},
        warranty: chance(0.8) ? daysAhead(rnd(1100) - 200) : null,
      });
    }
  }
  for (const a of assets) {
    const { rows } = await query(
      `INSERT INTO assets (asset_tag, serial_number, brand, model, category, mac_ethernet, mac_wifi,
                           specs, status, warranty_end_date, qr_code_string, created_at, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'In Stock',$9,$10,$11,$12) RETURNING id`,
      [a.tag, a.sn, a.brand, a.model, a.cat, a.macE, a.macW, JSON.stringify(a.specs),
       a.warranty, `ITACPRO|ASSET|${a.tag}`, daysAgo(rnd(900) + 30), pick(DEFAULT_LOCATIONS)]
    );
    a.id = rows[0].id;
  }

  console.log('[seed] handovers + history…');
  const shuffled = [...assets].sort(() => Math.random() - 0.5);
  let cursor = 0;
  const takeAssets = (k) => shuffled.slice(cursor, (cursor += k));
  const NOTES = ['Yeni, kutulu teslim edildi','İkinci el, temiz durumda','Şarj adaptörü ile birlikte','Çanta ve mouse dahil','Ekran koruyucu takılı',''];

  // ~55% of assets get assigned to random active employees via receipts.
  const assignTotal = Math.floor(assets.length * 0.55);
  while (cursor < assignTotal) {
    const emp = pick(activeEmps);
    const batch = takeAssets(Math.min(1 + rnd(3), assignTotal - cursor));
    if (!batch.length) break;
    const when = daysAgo(rnd(700));
    const items = batch.map((a) => ({
      assetId: a.id, assetTag: a.tag, brand: a.brand, model: a.model, category: a.cat,
      serialNumber: a.sn, macAddress: a.macE || a.macW || null, conditionNote: pick(NOTES),
    }));
    await query(
      `INSERT INTO handovers (employee_id, employee_name, it_user_id, transaction_date, document_type, items)
       VALUES ($1,$2,$3,$4,'single',$5::jsonb)`,
      [emp.id, emp.name, by[0], when, JSON.stringify(items)]
    );
    for (const [i, a] of batch.entries()) {
      await query(`UPDATE assets SET status='Assigned', current_employee_id=$2, current_employee_name=$3 WHERE id=$1`,
        [a.id, emp.id, emp.name]);
      await query(
        `INSERT INTO asset_history (asset_id, asset_tag, employee_id, employee_name, action_type, notes, changed_by, changed_by_name, "timestamp")
         VALUES ($1,$2,$3,$4,'assigned',$5,$6,$7,$8)`,
        [a.id, a.tag, emp.id, emp.name, items[i].conditionNote, ...by, when]
      );
      a.holder = emp;
    }
    await query('UPDATE employees SET active_asset_count = active_asset_count + $2 WHERE id = $1', [emp.id, batch.length]);
  }

  // Past churn: some currently-assigned assets also have an older previous owner.
  for (const a of shuffled.slice(0, Math.floor(assignTotal * 0.3))) {
    const prev = pick(activeEmps);
    if (a.holder && prev.id === a.holder.id) continue;
    const t1 = daysAgo(rnd(300) + 750), t2 = new Date(t1.getTime() + (rnd(200) + 30) * 86400000);
    await query(
      `INSERT INTO asset_history (asset_id, asset_tag, employee_id, employee_name, action_type, notes, changed_by, changed_by_name, "timestamp")
       VALUES ($1,$2,$3,$4,'assigned','Önceki zimmet',$5,$6,$7),
              ($1,$2,$3,$4,'returned','Cihaz değişimi nedeniyle iade',$5,$6,$8)`,
      [a.id, a.tag, prev.id, prev.name, ...by, t1, t2]
    );
  }

  // Repairs: ~35 assets in repair (open logs) + 60 closed repair logs.
  console.log('[seed] maintenance…');
  const SERVICE = ['TeknoServis A.Ş.','Arena Bilgisayar Servis','Notebook Klinik','Vestel Yetkili Servis'];
  const ISSUES = ['Ekran arızası','Batarya şişmesi','Klavye tuş arızası','Anakart sorunu','Fan gürültüsü','Şarj soketi arızası','Yazılım kaynaklı açılmama'];
  const inRepair = shuffled.slice(assignTotal, assignTotal + 35);
  for (const a of inRepair) {
    const when = daysAgo(rnd(20));
    await query(
      `INSERT INTO maintenance_logs (asset_id, asset_tag, service_company, issue_description, cost, sent_date, previous_status, previous_employee)
       VALUES ($1,$2,$3,$4,$5,$6,'In Stock',NULL)`,
      [a.id, a.tag, pick(SERVICE), pick(ISSUES), rnd(4000), when]
    );
    await query(`UPDATE assets SET status='In Repair' WHERE id=$1`, [a.id]);
    await query(
      `INSERT INTO asset_history (asset_id, asset_tag, action_type, notes, changed_by, changed_by_name, "timestamp")
       VALUES ($1,$2,'sent_to_repair',$3,$4,$5,$6)`,
      [a.id, a.tag, pick(ISSUES), ...by, when]
    );
  }
  for (const a of shuffled.slice(assignTotal + 35, assignTotal + 95)) {
    const sent = daysAgo(rnd(400) + 30);
    await query(
      `INSERT INTO maintenance_logs (asset_id, asset_tag, service_company, issue_description, cost, sent_date, return_date, previous_status, resolution_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'In Stock','Onarıldı, test edildi')`,
      [a.id, a.tag, pick(SERVICE), pick(ISSUES), rnd(3500) + 250, sent, new Date(sent.getTime() + (rnd(20) + 2) * 86400000)]
    );
  }

  // Scrap ~8% of remaining stock.
  for (const a of shuffled.slice(assignTotal + 95, assignTotal + 95 + Math.floor(assets.length * 0.08))) {
    await query(`UPDATE assets SET status='Scrap' WHERE id=$1`, [a.id]);
  }

  console.log('[seed] licenses + software zimmet…');
  for (const [name, vendor, seats] of LICENSES) {
    const { rows } = await query(
      `INSERT INTO licenses (software_name, vendor, license_key, total_seats, expiration_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [name, vendor, `${name.slice(0, 3).toUpperCase()}-${rnd(9999)}-${rnd(9999)}-${rnd(9999)}`, seats,
       chance(0.2) ? daysAhead(rnd(28) + 2) : daysAhead(rnd(700) + 40)]
    );
    const licId = rows[0].id;
    const holders = [...activeEmps].sort(() => Math.random() - 0.5).slice(0, Math.floor(seats * (0.4 + Math.random() * 0.5)));
    for (const emp of holders) {
      await query(
        `INSERT INTO license_assignments (license_id, software_name, employee_id, employee_name, assigned_by, assigned_by_name, assigned_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [licId, name, emp.id, emp.name, ...by, daysAgo(rnd(400))]
      );
    }
    await query('UPDATE licenses SET used_seats = $2 WHERE id = $1', [licId, holders.length]);
  }

  console.log('[seed] consumables…');
  for (const [item, stock, min] of CONSUMABLES) {
    await query(
      'INSERT INTO consumables (item_name, total_stock, minimum_stock_alert_level) VALUES ($1,$2,$3)',
      [item, stock, min]
    );
  }

  const stats = await query(`SELECT
    (SELECT COUNT(*) FROM employees) AS employees,
    (SELECT COUNT(*) FROM assets) AS assets,
    (SELECT COUNT(*) FROM handovers) AS handovers,
    (SELECT COUNT(*) FROM asset_history) AS history,
    (SELECT COUNT(*) FROM license_assignments) AS sw_assignments`);
  console.log('[seed] done:', stats.rows[0]);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
