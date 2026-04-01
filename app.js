
// ═══════════════════════════════════════════════
// PWA STORAGE SHIM — replaces chrome.storage.local
// Uses IndexedDB via a simple localStorage-based wrapper
// ═══════════════════════════════════════════════
const chromeStorage = (() => {
  const DB_NAME = 'DenemeTakipDB';
  const STORE   = 'state';
  let _db = null;

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  function tx(mode) {
    return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
  }

  return {
    get(keys) {
      return new Promise(async resolve => {
        const store = await tx('readonly');
        const result = {};
        const keysArr = Array.isArray(keys) ? keys : [keys];
        let pending = keysArr.length;
        if (pending === 0) return resolve(result);
        keysArr.forEach(k => {
          const req = store.get(k);
          req.onsuccess = () => {
            if (req.result !== undefined) result[k] = req.result;
            if (--pending === 0) resolve(result);
          };
          req.onerror = () => { if (--pending === 0) resolve(result); };
        });
      });
    },
    set(obj) {
      return new Promise(async (resolve, reject) => {
        const store = await tx('readwrite');
        const entries = Object.entries(obj);
        let pending = entries.length;
        if (pending === 0) return resolve();
        entries.forEach(([k, v]) => {
          const req = store.put(v, k);
          req.onsuccess = () => { if (--pending === 0) resolve(); };
          req.onerror   = e => reject(e.target.error);
        });
      });
    },
    onChanged: { addListener() {} }  // no-op for PWA
  };
})();

// Override chrome.storage.local with our shim
const _chromePWA = {
  storage: { local: chromeStorage, onChanged: { addListener() {} } },
  runtime: {
    getURL: (path) => path,
    lastError: null,
    sendMessage: () => {},
    onMessage: { addListener() {} }
  },
  tabs: { create: (opts) => window.open(opts.url, '_blank') },
  identity: { getAuthToken: null },  // handled separately
  extension: { getViews: null },
  action: { setBadgeText: () => {}, setBadgeBackgroundColor: () => {} },
  notifications: {
    create(id, opts) {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(opts.title, { body: opts.message, icon: opts.iconUrl });
      }
    }
  }
};

// Set chrome shim globally
if (typeof chrome === 'undefined' || !chrome.storage) {
  window.chrome = _chromePWA;
} else {
  // Patch existing chrome object
  chrome.storage.local = chromeStorage;
  chrome.storage.onChanged = { addListener() {} };
  const _base = window.location.pathname.replace(/\/[^/]*$/, '');
  chrome.runtime.getURL = (path) => window.location.origin + _base + '/' + path.replace(/^\//, '');
}

// ============================================================
// DENEME TAKİP v3.0 - popup.js
// ============================================================

// ===== STATE =====
let state = {
  exams: [], schools: [], categories: [], payments: [],
  publishers: [], periods: [], history: [], catalogItems: [],
  settings: { notifyDaysBefore: 3, notifyStockDays: 3, autoBackup: false },

  // UI state
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  calView: 'month',       // 'month' | 'year'
  activeTab: 'calendar',
  activeReportTab: 'summary',

  // Filters
  filterCat: '', filterType: '', filterPeriod: '', filterPub: '',
  filterSort: 'appDate', filterSubtab: 'pending',
  searchQuery: '',
  calFilterSchool: '',

  // Selection (bulk)
  selectedExams: new Set(),
  bulkMode: false,

  // School view
  viewingSchool: null,

  // Drag state
  dragExamId: null, dragDateType: null, // 'stock'|'app'
};

// ===== DEFAULT DATA =====
const DEFAULT_CATEGORIES = [
  { id: 'TYT',  name: 'TYT',      color: '#6c3fff', isDefault: true },
  { id: 'AYT',  name: 'AYT',      color: '#ff6b35', isDefault: true },
  { id: 'S5',   name: '5. Sınıf', color: '#10b981', isDefault: true },
  { id: 'S6',   name: '6. Sınıf', color: '#3b82f6', isDefault: true },
  { id: 'S7',   name: '7. Sınıf', color: '#8b5cf6', isDefault: true },
  { id: 'S8',   name: '8. Sınıf', color: '#f59e0b', isDefault: true },
  { id: 'S9',   name: '9. Sınıf', color: '#ef4444', isDefault: true },
  { id: 'S10',  name: '10. Sınıf',color: '#06b6d4', isDefault: true },
  { id: 'S11',  name: '11. Sınıf',color: '#ec4899', isDefault: true },
  { id: 'S12',  name: '12. Sınıf',color: '#f97316', isDefault: true },
];

const STATUS_CONFIG = {
  ordered:   { label: '📦 Sipariş Çekildi', short: '📦 Sipariş', color: '#f59e0b' },
  shipping:  { label: '🚚 Yolda',           short: '🚚 Yolda',   color: '#3b82f6' },
  arrived:   { label: '📬 Geldi',           short: '📬 Geldi',   color: '#8b5cf6' },
  delivered: { label: '🏫 Teslim Edildi',   short: '🏫 Teslim',  color: '#10b981' },
  applied:   { label: '✅ Uygulandı',       short: '✅ Uygulandı',color: '#059669' },
};
const STATUS_ORDER = ['ordered','shipping','arrived','delivered','applied'];

// Distinct color palette for schools - cycles through automatically
const SCHOOL_COLORS = [
  '#6c3fff','#ff6b35','#10b981','#3b82f6','#f59e0b',
  '#ef4444','#8b5cf6','#06b6d4','#ec4899','#f97316',
  '#84cc16','#14b8a6','#a855f7','#0ea5e9','#f43f5e',
  '#22c55e','#eab308','#6366f1','#d946ef','#fb923c',
  '#0891b2','#7c3aed','#b45309','#047857','#be123c',
];

function getNextSchoolColor() {
  const usedColors = new Set(state.schools.map(s => s.color).filter(Boolean));
  const available = SCHOOL_COLORS.find(c => !usedColors.has(c));
  return available || SCHOOL_COLORS[state.schools.length % SCHOOL_COLORS.length];
}

// İşler Kitabevi deneme takvimi — ilk açılışta otomatik kataloğa eklenir
const DEFAULT_CATALOG_ITEMS = [
  { name:'HAZIR BULUNUŞLUK SINAVI', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-07-07', applicationDate:'2025-07-14', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Genel' },
  { name:'HAZIR BULUNUŞLUK SINAVI', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-07-07', applicationDate:'2025-07-14', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-0', publisherName:'HIZ VE RENK KURUMSAL DENEME 2025-26', stockDate:'2025-08-07', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'PROLİG TYT', publisherName:'PROLİG KURUMSAL DENEME 2025-26', stockDate:'2025-08-01', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-0', publisherName:'ÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-08-15', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'YÖN SERİSİ TYT-1', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-08-18', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-1', publisherName:'AKTİF YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-08-18', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-0', publisherName:'YAYIN DENİZİ KURUMSAL DENEME 2025-26', stockDate:'2025-08-22', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-0 ROTA', publisherName:'YILDIZLAR YARIŞIYOR KURUMSAL DENEME 2025-26', stockDate:'2025-08-25', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT', publisherName:'ALAN YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-08-22', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-0', publisherName:'MİKROORİJİNAL KURUMSAL DENEME 2025-26', stockDate:'2025-08-30', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-1', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-09-09', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-1', publisherName:'YARIÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-09-13', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'YÖN SERİSİ TYT-2', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-09-15', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-1', publisherName:'ORBİTAL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-09-17', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT', publisherName:'ENS YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-09-12', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'ÜNİVERSİTEYE DOĞRU TYT-1', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-09-22', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Tarama' },
  { name:'ÜNİVERSİTEYE DOĞRU AYT-1', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-09-22', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Tarama' },
  { name:'PROLİG TYT-1', publisherName:'PROLİG KURUMSAL DENEME 2025-26', stockDate:'2025-09-28', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-1', publisherName:'BİYOTİK YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-10-01', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-1', publisherName:'KRALLAR KARMASI KURUMSAL DENEME 2025-26', stockDate:'2025-10-01', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT', publisherName:'AKTİF YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-09-26', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ AYT', publisherName:'AKTİF YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-09-26', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Tarama' },
  { name:'SÜREÇ DEĞERLENDİRME SERİSİ-1', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-09-29', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TYT-2', publisherName:'ORBİTAL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-10-09', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-AYT-1', publisherName:'ÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-10-10', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-1', publisherName:'YAYIN DENİZİ KURUMSAL DENEME 2025-26', stockDate:'2025-10-14', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-1', publisherName:'BİLGİ SARMAL KURUMSAL DENEME 2025-26', stockDate:'2025-10-10', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-AYT-1', publisherName:'ETKİLİ MATEMATİK KURUMSAL DENEME 2025-26', stockDate:'2025-10-17', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'REHBER SERİSİ TYT-1', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-10-20', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-AYT-1', publisherName:'HIZ VE RENK KURUMSAL DENEME 2025-26', stockDate:'2025-10-23', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ARA GRUP-1', publisherName:'BİLGİ SARMAL KURUMSAL DENEME 2025-26', stockDate:'2025-10-17', applicationDate:'2025-10-24', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TYT-AYT-1', publisherName:'ENS YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-10-26', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ÜNİVERSİTEYE DOĞRU TYT-2', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-10-27', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Tarama' },
  { name:'ÜNİVERSİTEYE DOĞRU AYT-2', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-10-27', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Tarama' },
  { name:'TYT-AYT', publisherName:'MERKEZ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-10-30', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-AYT', publisherName:'MİKROORİJİNAL KURUMSAL DENEME 2025-26', stockDate:'2025-10-24', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'MOTİVASYON DENEMELERİ TYT-1', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-11-03', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-AYT-2', publisherName:'BİYOTİK YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-11-04', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT-2', publisherName:'YAYIN DENİZİ KURUMSAL DENEME 2025-26', stockDate:'2025-11-06', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ARA GRUP-1', publisherName:'HIZ VE RENK KURUMSAL DENEME 2025-26', stockDate:'2025-10-30', applicationDate:'2025-11-07', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'DENEME KULÜBÜ TYT-1', publisherName:'BRANŞLAR KARMASI KURUMSAL DENEME 2025-26', stockDate:'2025-11-10', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-AYT-3', publisherName:'ORBİTAL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-11-13', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-1', publisherName:'KRALLAR KARMASI KURUMSAL DENEME 2025-26', stockDate:'2025-11-07', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-1', publisherName:'FULL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-11-17', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-AYT-1 ATAK', publisherName:'YILDIZLAR YARIŞIYOR KURUMSAL DENEME 2025-26', stockDate:'2025-11-17', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-2', publisherName:'HIZ VE RENK KURUMSAL DENEME 2025-26', stockDate:'2025-11-19', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-1', publisherName:'APOTEMİ YAYIN KURUMSAL DENEME 2025-26', stockDate:'2025-11-14', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-1', publisherName:'FİZİPEDİA KURUMSAL DENEME 2025-26', stockDate:'2025-11-21', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'SÜREÇ TAKİP SERİSİ-1', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-11-17', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TYT', publisherName:'BİLGİ ARŞİVİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-11-25', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'ARA GRUP-1', publisherName:'YARIÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-11-18', applicationDate:'2025-11-25', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TYT-2', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-11-25', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-1', publisherName:'ACİL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-11-26', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT-2', publisherName:'ÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-11-28', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ARA GRUP-1', publisherName:'ENS YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-11-23', applicationDate:'2025-11-30', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TYT-AYT-2', publisherName:'ENS YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-12-01', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-3', publisherName:'YAYIN DENİZİ KURUMSAL DENEME 2025-26', stockDate:'2025-12-03', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-AYT-1', publisherName:'HIZ VE RENK KURUMSAL DENEME 2025-26', stockDate:'2025-11-28', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'9-10-11 BURSLULUK', publisherName:'YAYIN DENİZİ KURUMSAL DENEME 2025-26', stockDate:'2025-11-28', applicationDate:'2025-12-05', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'ÜNİVERSİTEYE DOĞRU TYT-3', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-12-08', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Tarama' },
  { name:'ÜNİVERSİTEYE DOĞRU AYT-3', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-12-08', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Tarama' },
  { name:'TYT-1', publisherName:'EDEBİYAT DENİZİ KURUMSAL DENEME 2025-26', stockDate:'2025-12-11', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-AYT', publisherName:'ETAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-12-13', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'SÜREÇ DEĞERLENDİRME SERİSİ-2', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-12-08', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'KAZANDIRAN SERİ TYT-1', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2025-12-15', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'ARA GRUP-1', publisherName:'ÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-12-08', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TYT-AYT-4', publisherName:'ORBİTAL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-12-16', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-AYT-2', publisherName:'BİLGİ SARMAL KURUMSAL DENEME 2025-26', stockDate:'2025-12-12', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-1', publisherName:'DİDAKTİK KALEM KURUMSAL DENEME 2025-26', stockDate:'2025-12-24', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ARA GRUP-2', publisherName:'BİLGİ SARMAL KURUMSAL DENEME 2025-26', stockDate:'2025-12-19', applicationDate:'2025-12-26', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TÜRKİYE GENELİ TYT-AYT-1', publisherName:'ORİJİNAL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-12-19', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-2', publisherName:'AKTİF YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-12-28', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-2', publisherName:'YARIÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-12-31', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'PROLİG TYT-AYT-2', publisherName:'PROLİG KURUMSAL DENEME 2025-26', stockDate:'2026-01-02', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'9-10-11 BURSLULUK', publisherName:'HIZ VE RENK KURUMSAL DENEME 2025-26', stockDate:'2025-12-26', applicationDate:'2026-01-04', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'ÜNİVERSİTEYE DOĞRU TYT-4', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-01-05', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'ÜNİVERSİTEYE DOĞRU AYT-4', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-01-05', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Tarama' },
  { name:'11 BURSLULUK', publisherName:'ÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2025-12-28', applicationDate:'2026-01-05', categoryIds:["cat_s11"], categoryNames:'11. Sınıf', type:'Tarama' },
  { name:'TÜRKİYE GENELİ TYT-2', publisherName:'APOTEMİ YAYIN KURUMSAL DENEME 2025-26', stockDate:'2026-01-02', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'MOTİVASYON DENEMELERİ TYT-2', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-01-12', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-AYT-1', publisherName:'OKTET KURUMSAL DENEME 2025-26', stockDate:'2026-01-13', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-3', publisherName:'ENS YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-01-16', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'RİTİM TYT-AYT', publisherName:'PROLİG KURUMSAL DENEME 2025-26', stockDate:'2026-01-20', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'MSÜ PROVASI', publisherName:'BRANŞLAR KARMASI KURUMSAL DENEME 2025-26', stockDate:'2026-01-16', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'MSÜ PROVASI', publisherName:'ÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-01-30', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT-4', publisherName:'YAYIN DENİZİ KURUMSAL DENEME 2025-26', stockDate:'2026-02-02', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ARA GRUP-2', publisherName:'ENS YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-01-28', applicationDate:'2026-02-05', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'DENEME KULÜBÜ TYT-AYT', publisherName:'YILDIZLAR YARIŞIYOR KURUMSAL DENEME 2025-26', stockDate:'2026-02-06', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-2', publisherName:'FİZİPEDİA KURUMSAL DENEME 2025-26', stockDate:'2026-02-07', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'REHBER SERİSİ TYT-2', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-02-09', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TYT-AYT-3', publisherName:'HIZ VE RENK KURUMSAL DENEME 2025-26', stockDate:'2026-02-09', applicationDate:'2026-02-26', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ARA GRUP-2', publisherName:'YARIÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-02-04', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'ARA GRUP-3', publisherName:'BİLGİ SARMAL KURUMSAL DENEME 2025-26', stockDate:'2026-02-05', applicationDate:'2026-02-12', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TÜRKİYE GENELİ DENEME SINAVI', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-02-05', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ DENEME SINAVI', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-02-05', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'ÜNİVERSİTEYE DOĞRU TYT-5', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-02-16', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'ÜNİVERSİTEYE DOĞRU AYT-5', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-02-16', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'SÜREÇ TAKİP SERİSİ-2', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-02-09', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TYT-AYT', publisherName:'NEOFİZİK KURUMSAL DENEME 2025-26', stockDate:'2026-02-18', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT-2', publisherName:'KRALLAR KARMASI KURUMSAL DENEME 2025-26', stockDate:'2026-02-19', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-AYT', publisherName:'DENEME DEPOSU KURUMSAL DENEME 2025-26', stockDate:'2026-02-13', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'YÖN SERİSİ TYT-3', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-02-23', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'YÖN SERİSİ AYT-1', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-02-23', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT-4', publisherName:'ENS YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-02-24', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT', publisherName:'FERRUM KURUMSAL DENEME 2025-26', stockDate:'2026-02-25', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ARA GRUP-1', publisherName:'YAYIN DENİZİ KURUMSAL DENEME 2025-26', stockDate:'2026-02-20', applicationDate:'2026-02-27', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TYT-AYT-3', publisherName:'BİYOTİK YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-03-02', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT-4', publisherName:'HIZ VE RENK KURUMSAL DENEME 2025-26', stockDate:'2026-03-03', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-AYT', publisherName:'ÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-02-28', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'REKORTMEN TYT-AYT', publisherName:'PROLİG KURUMSAL DENEME 2025-26', stockDate:'2026-03-06', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'REHBER SERİSİ TYT-3', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-03-09', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'REHBER SERİSİ AYT-1', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-03-09', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'SÜREÇ DEĞERLENDİRME SERİSİ-3', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-03-02', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TYT-AYT-2', publisherName:'FULL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-03-10', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-2', publisherName:'EDEBİYAT DENİZİ KURUMSAL DENEME 2025-26', stockDate:'2026-03-12', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-AYT-2', publisherName:'KRALLAR KARMASI KURUMSAL DENEME 2025-26', stockDate:'2026-03-06', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-5', publisherName:'YAYIN DENİZİ KURUMSAL DENEME 2025-26', stockDate:'2026-03-16', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-2', publisherName:'ACİL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-03-17', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ÜNİVERSİTEYE DOĞRU TYT-6', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-03-23', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'ÜNİVERSİTEYE DOĞRU AYT-6', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-03-23', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'TYT-AYT-2', publisherName:'DİDAKTİK KALEM KURUMSAL DENEME 2025-26', stockDate:'2026-03-23', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ARA GRUP-2', publisherName:'YAYIN DENİZİ KURUMSAL DENEME 2025-26', stockDate:'2026-03-18', applicationDate:'2026-03-25', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TYT-AYT-2', publisherName:'OKTET KURUMSAL DENEME 2025-26', stockDate:'2026-03-27', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-3', publisherName:'AKTİF YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-03-29', applicationDate:'2026-04-11', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-3', publisherName:'ÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-03-30', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'SÜREÇ TAKİP SERİSİ-3', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-03-23', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'ARA GRUP', publisherName:'FULL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-03-24', applicationDate:'2026-04-01', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TYT-AYT', publisherName:'EDEBİYAT SOKAĞI KURUMSAL DENEME 2025-26', stockDate:'2026-04-02', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-AYT-3', publisherName:'BİLGİ SARMAL KURUMSAL DENEME 2025-26', stockDate:'2026-03-26', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ ARA GRUP', publisherName:'BİLGİ SARMAL KURUMSAL DENEME 2025-26', stockDate:'2026-03-26', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'PROLİG TYT-AYT-3', publisherName:'PROLİG KURUMSAL DENEME 2025-26', stockDate:'2026-04-06', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ARA GRUP-2', publisherName:'HIZ VE RENK KURUMSAL DENEME 2025-26', stockDate:'2026-04-07', applicationDate:'2026-04-14', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'DENEME KULÜBÜ TYT-3', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-04-07', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'DENEME KULÜBÜ AYT-1', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-04-07', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT-5', publisherName:'ENS YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-04-09', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-3', publisherName:'FULL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-04-11', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT-2', publisherName:'BRANŞLAR KARMASI KURUMSAL DENEME 2025-26', stockDate:'2026-04-13', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'KAZANDIRAN SERİ TYT-2', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-04-13', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'KAZANDIRAN SERİ AYT-1', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-04-13', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT-6', publisherName:'YAYIN DENİZİ KURUMSAL DENEME 2025-26', stockDate:'2026-04-16', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-AYT-3', publisherName:'APOTEMİ YAYIN KURUMSAL DENEME 2025-26', stockDate:'2026-04-12', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'SÜREÇ DEĞERLENDİRME SERİSİ-4', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-04-13', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'ARA GRUP-2', publisherName:'ÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-04-13', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TÜRKİYE GENELİ TYT-AYT', publisherName:'ACİL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-04-17', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'PROLİG ŞAMPİYONLAR LİGİ DK TYT-AYT-4', publisherName:'PROLİG KURUMSAL DENEME 2025-26', stockDate:'2026-04-26', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ÜNİVERSİTEYE DOĞRU TYT-7', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-04-27', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'ÜNİVERSİTEYE DOĞRU AYT-7', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-04-27', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'TYT-AYT-2 KLON', publisherName:'YILDIZLAR YARIŞIYOR KURUMSAL DENEME 2025-26', stockDate:'2026-04-27', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-5', publisherName:'HIZ VE RENK KURUMSAL DENEME 2025-26', stockDate:'2026-04-28', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT-4', publisherName:'BİYOTİK YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-04-29', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-2', publisherName:'ETKİLİ MATEMATİK KURUMSAL DENEME 2025-26', stockDate:'2026-04-30', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ARA GRUP', publisherName:'ORİJİNAL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-04-25', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'MOTİVASYON DENEMELERİ TYT-3', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-05-04', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'MOTİVASYON DENEMELERİ AYT-1', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-05-04', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT-5', publisherName:'ORBİTAL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-04', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT', publisherName:'DENEME DEPOSU KURUMSAL DENEME 2025-26', stockDate:'2026-05-07', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'DENEME KULÜBÜ TYT-AYT-4', publisherName:'AKTİF YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-08', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-AYT-2', publisherName:'HIZ VE RENK KURUMSAL DENEME 2025-26', stockDate:'2026-05-01', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-AYT-6', publisherName:'ENS YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-10', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ULTİ SERİ DENEME TYT-1', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-11', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'ULTİ SERİ DENEME TYT-2', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-11', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'ULTİ SERİ DENEME TYT-3', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-11', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'ULTİ SERİ DENEME AYT-1', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-11', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'ULTİ SERİ DENEME AYT-2', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-11', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'ULTİ SERİ DENEME AYT-3', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-11', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'SÜREÇ TAKİP SERİSİ-4', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-11', applicationDate:'', categoryIds:["cat_s9", "cat_s10", "cat_s11"], categoryNames:'9. Sınıf, 10. Sınıf, 11. Sınıf', type:'Tarama' },
  { name:'TYT-AYT', publisherName:'SÜRE YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-12', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TYT-4', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-12', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'AYT-2', publisherName:'ULTİ YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-12', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'PROLİG TYT-AYT-5', publisherName:'PROLİG KURUMSAL DENEME 2025-26', stockDate:'2026-05-14', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-AYT-4', publisherName:'BİLGİ SARMAL KURUMSAL DENEME 2025-26', stockDate:'2026-05-07', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'ÜNİVERSİTEYE DOĞRU TYT-8', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-05-18', applicationDate:'', categoryIds:["cat_tyt"], categoryNames:'TYT', type:'Genel' },
  { name:'ÜNİVERSİTEYE DOĞRU AYT-8', publisherName:'2025-2026 BES KURUMSAL DENEME', stockDate:'2026-05-18', applicationDate:'', categoryIds:["cat_ayt"], categoryNames:'AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-AYT-2', publisherName:'ORİJİNAL YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'2026-05-14', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'TÜRKİYE GENELİ TYT-AYT-2', publisherName:'BRANŞLAR KARMASI KURUMSAL DENEME 2025-26', stockDate:'2026-05-27', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'11-12ler tyt 12ler ayt', publisherName:'APOTEMİ YAYIN KURUMSAL DENEME 2025-26', stockDate:'', applicationDate:'2026-06-12', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'11-12ler tyt 12ler ayt', publisherName:'ÇAP YAYINLARI KURUMSAL DENEME 2025-26', stockDate:'', applicationDate:'2026-06-16', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' },
  { name:'11-12ler tyt 12ler ayt', publisherName:'BİLGİ SARMAL KURUMSAL DENEME 2025-26', stockDate:'', applicationDate:'', categoryIds:["cat_tyt", "cat_ayt"], categoryNames:'TYT, AYT', type:'Genel' }
];

// Uzunköprü okulları — ilk açılışta otomatik eklenir
const DEFAULT_PUBLISHERS = [
  { name: "2025-2026 BES KURUMSAL DENEME", short: "BES" },
  { name: "ACİL YAYINLARI KURUMSAL DENEME 2025-26", short: "ACİL" },
  { name: "AKADEMİ DENİZİ KPSS DENEME 2025-26", short: "AKADEMİ DENİZİ" },
  { name: "AKTİF YAYINLARI KURUMSAL DENEME 2025-26", short: "AKTİF" },
  { name: "ALAN YAYINLARI KURUMSAL DENEME 2025-26", short: "ALAN" },
  { name: "APOTEMİ YAYIN KURUMSAL DENEME 2025-26", short: "APOTEMİ" },
  { name: "AROMAT YAYIN KURUMSAL DENEME", short: "AROMAT" },
  { name: "AV YAYINLARI KURUMSAL DENEME 2025-26", short: "AV" },
  { name: "BEYİN TAKIMI KURUMSAL DENEME 2025-26", short: "BEYİN TAKIMI" },
  { name: "BİLGİ ARŞİVİ YAYINLARI KURUMSAL DENEME 2025-26", short: "BİLGİ ARŞİVİ" },
  { name: "BİLGİ SARMAL KURUMSAL DENEME 2025-26", short: "BİLGİ SARMAL" },
  { name: "BİYOTİK YAYINLARI KURUMSAL DENEME 2025-26", short: "BİYOTİK" },
  { name: "BRANŞLAR KARMASI KURUMSAL DENEME 2025-26", short: "BRANŞLAR KARMASI" },
  { name: "ÇAP YAYINLARI KURUMSAL DENEME 2025-26", short: "ÇAP" },
  { name: "DENEME DEPOSU KURUMSAL DENEME 2025-26", short: "DENEME DEPOSU" },
  { name: "DİDAKTİK KALEM KURUMSAL DENEME 2025-26", short: "DİDAKTİK KALEM" },
  { name: "EDEBİYAT DENİZİ KURUMSAL DENEME 2025-26", short: "EDEBİYAT DENİZİ" },
  { name: "EDEBİYAT SOKAĞI KURUMSAL DENEME 2025-26", short: "EDEBİYAT SOKAĞI" },
  { name: "ENS YAYINLARI KURUMSAL DENEME 2025-26", short: "ENS" },
  { name: "ETAP YAYINLARI KURUMSAL DENEME 2025-26", short: "ETAP" },
  { name: "ETKİLİ MATEMATİK KURUMSAL DENEME 2025-26", short: "ETKİLİ MATEMATİK" },
  { name: "FERRUM KURUMSAL DENEME 2025-26", short: "FERRUM" },
  { name: "FİZİPEDİA KURUMSAL DENEME 2025-26", short: "FİZİPEDİA" },
  { name: "FULL YAYINLARI KURUMSAL DENEME 2025-26", short: "FULL" },
  { name: "GERİ SAYIM KURUMSAL DENEME 2025-26", short: "GERİ SAYIM" },
  { name: "HIZ VE RENK KURUMSAL DENEME 2025-26", short: "HIZ VE RENK" },
  { name: "İNTRO YAYINLARI KURUMSAL DENEME 2025-26", short: "İNTRO" },
  { name: "İŞLEYEN ZEKA KURUMSAL DENEME 2025-26", short: "İŞLEYEN ZEKA" },
  { name: "KAPLAN ACADEMY KURUMSAL DENEME 25-26", short: "KAPLAN ACADEMY" },
  { name: "KLASMAN KURUMSAL DENEME 2025-26", short: "KLASMAN" },
  { name: "KRALLAR KARMASI KURUMSAL DENEME 2025-26", short: "KRALLAR KARMASI" },
  { name: "KRALLAR KULÜBÜ DENEME 2025-26", short: "KRALLAR KULÜBÜ" },
  { name: "LEGEND YAYINLARI KURUMSAL DENEME", short: "LEGEND" },
  { name: "MERKEZ YAYINLARI KURUMSAL DENEME 2025-26", short: "MERKEZ" },
  { name: "MİKROORİJİNAL KURUMSAL DENEME 2025-26", short: "MİKROORİJİNAL" },
  { name: "MOZAİK KURUMSAL DENEME 2025-26", short: "MOZAİK" },
  { name: "NEOFİZİK KURUMSAL DENEME 2025-26", short: "NEOFİZİK" },
  { name: "OKTET KURUMSAL DENEME 2025-26", short: "OKTET" },
  { name: "ORBİTAL YAYINLARI KURUMSAL DENEME 2025-26", short: "ORBİTAL" },
  { name: "ORİJİNAL YAYINLARI KURUMSAL DENEME 2025-26", short: "ORİJİNAL" },
  { name: "PROFESYONELLER KARMASI KURUMSAL DENEME", short: "PROFESYONELLER" },
  { name: "PROLİG KURUMSAL DENEME 2025-26", short: "PROLİG" },
  { name: "RİTİM YAYINLARI KURUMSAL DENEME", short: "RİTİM" },
  { name: "SON VİRAJ KURUMSAL DENEME 2025-26", short: "SON VİRAJ" },
  { name: "SÜRE YAYINLARI KURUMSAL DENEME 2025-26", short: "SÜRE" },
  { name: "ULTİ YAYINLARI KURUMSAL DENEME 2025-26", short: "ULTİ" },
  { name: "YARIÇAP YAYINLARI KURUMSAL DENEME 2025-26", short: "YARIÇAP" },
  { name: "YAYIN DENİZİ KURUMSAL DENEME 2025-26", short: "YAYIN DENİZİ" },
  { name: "YENİ TARZ YAYINLARI KURUMSAL DENEME", short: "YENİ TARZ" },
  { name: "YILDIZLAR YARIŞIYOR KURUMSAL DENEME 2025-26", short: "YILDIZLAR YARIŞIYOR" },
];

const DEFAULT_SCHOOLS = [
  // Liseler
  { name: 'KEMAL UNAKITAN ANADOLU İMAM HATİP LİSESİ',                 code: '144276' },
  { name: 'TEV ORHAN ÇETİN FEN LİSESİ',                               code: '974024' },
  { name: 'MUZAFFER ATASAY ANADOLU LİSESİ',                           code: '281022' },
  { name: 'ÖZEL UZUNKÖPRÜ FİNAL AKADEMİ ANADOLU LİSESİ',             code: '118324' },
  { name: 'UZUNKÖPRÜ MİMAR MUSLİHİDDİN MESLEKİ VE TEKNİK ANADOLU LİSESİ', code: '144240' },
  { name: 'UZUNKÖPRÜ ANADOLU LİSESİ',                                 code: '972834' },
  { name: 'UZUNKÖPRÜ HÜSEYİN ÇORUM MESLEKİ VE TEKNİK ANADOLU LİSESİ', code: '962522' },
  { name: 'UZUNKÖPRÜ KIZ MESLEKİ VE TEKNİK ANADOLU LİSESİ',          code: '144252' },
  { name: 'UZUNKÖPRÜ M. ARİF DİLMEN MESLEKİ VE TEKNİK ANADOLU LİSESİ', code: '144264' },
  // Ortaokullar
  { name: 'ATATÜRK ORTAOKULU',                                         code: '887600' },
  { name: 'ÇÖPKÖY ORTAOKULU',                                          code: '734081' },
  { name: 'YUNUS EMRE ORTAOKULU',                                      code: '737623' },
  { name: 'GAZİ TURHAN BEY ORTAOKULU',                                 code: '717763' },
  { name: 'KIRCASALIH ATATÜRK ORTAOKULU',                              code: '734084' },
  { name: 'HARMONLI RAUF ŞENBAŞ VE YUNUS ŞENUZ ORTAOKULU',            code: '734079' },
  { name: 'UZUNKÖPRÜ MAHMUT ARİF DİLMEN ORTAOKULU',                   code: '718711' },
  { name: 'KARAPINAR ORTAOKULU',                                       code: '734077' },
  { name: 'KURTBEY ORTAOKULU',                                         code: '734083' },
  { name: 'UZUNKÖPRÜ İMAM HATİP ORTAOKULU',                           code: '734075' },
];

const CLASS_LABELS = {
  S5:'5. Sınıf', S6:'6. Sınıf', S7:'7. Sınıf', S8:'8. Sınıf',
  S9:'9. Sınıf', S10:'10. Sınıf', S11:'11. Sınıf', S12:'12. Sınıf',
  TYT:'TYT', AYT:'AYT'
};

// ===== STORAGE =====
async function loadData() {
  const keys = ['exams','schools','categories','payments','publishers','periods','history','settings','catalogItems'];
  const data = await chromeStorage.get(keys);
  state.exams      = data.exams      || [];
  state.schools    = data.schools    || [];
  state.payments   = data.payments   || [];
  state.publishers = data.publishers || [];
  state.periods    = data.periods    || [];
  state.history    = data.history    || [];
  state.catalogItems = data.catalogItems || [];
  state.settings   = { notifyDaysBefore: 3, notifyStockDays: 3, autoBackup: false, ...(data.settings || {}) };
  if (data.categories && data.categories.length > 0) {
    state.categories = data.categories;
  } else {
    state.categories = [...DEFAULT_CATEGORIES];
    await saveData('categories');
  }

  // İlk açılışta yayıncılar boşsa, 50 yayıncıyı otomatik ekle — ÖNCE yüklenmeli
  if (state.publishers.length === 0) {
    state.publishers = DEFAULT_PUBLISHERS.map(p => ({
      id: genId(), name: p.name, short: p.short, phone: '', email: ''
    }));
    await saveData('publishers');
  }

  // İlk açılışta okullar boşsa, Uzunköprü okullarını otomatik ekle
  if (state.schools.length === 0) {
    state.schools = DEFAULT_SCHOOLS.map((s, i) => ({
      id: genId(),
      name: s.name,
      color: SCHOOL_COLORS[i % SCHOOL_COLORS.length],
      studentCounts: {},
      contacts: [],
      schoolCode: s.code || '',
      portalToken: genId() + genId(),
    }));
    await saveData('schools');
  }

  // İlk açılışta katalog boşsa, 179 denemeyi otomatik yükle
  // Publishers ve Categories ÖNCE init edilmeli ki ID eşleştirme çalışsın
  if (state.catalogItems.length === 0) {
    function findPubId(pubName) {
      const norm = s => s.toUpperCase()
        .replace(/İ/g,'I').replace(/Ğ/g,'G').replace(/Ü/g,'U')
        .replace(/Ş/g,'S').replace(/Ö/g,'O').replace(/Ç/g,'C').trim();
      const n = norm(pubName);
      let p = state.publishers.find(p => norm(p.name) === n);
      if (!p) p = state.publishers.find(p => p.short && norm(p.short) === n);
      if (!p) p = state.publishers.find(p => norm(p.name).includes(n) && n.length >= 3);
      if (!p) p = state.publishers.find(p => n.includes(norm(p.name)) && norm(p.name).length >= 3);
      return p?.id || '';
    }

    function resolveCatIds(defaultCatIds) {
      const CAT_KEY_MAP = {
        'cat_tyt': 'TYT', 'cat_ayt': 'AYT',
        'cat_s9': '9. Sınıf', 'cat_s10': '10. Sınıf',
        'cat_s11': '11. Sınıf', 'cat_s12': '12. Sınıf',
      };
      return defaultCatIds.map(key => {
        const catName = CAT_KEY_MAP[key];
        const cat = state.categories.find(c => c.name === catName);
        return cat?.id || key;
      });
    }

    state.catalogItems = DEFAULT_CATALOG_ITEMS.map(item => ({
      id: genId(),
      name: item.name,
      publisherName: item.publisherName,
      publisherId: findPubId(item.publisherName),
      stockDate: item.stockDate,
      applicationDate: item.applicationDate,
      categoryIds: resolveCatIds(item.categoryIds),
      categoryNames: item.categoryNames,
      type: item.type,
      examNo: '',
      periodId: '',
    }));
    await saveData('catalogItems');
  }
}

async function saveData(key) {
  await chromeStorage.set({ [key]: state[key] });
}

async function saveAll() {
  await chromeStorage.set({
    exams: state.exams, schools: state.schools,
    categories: state.categories, payments: state.payments,
    publishers: state.publishers, periods: state.periods,
    history: state.history, settings: state.settings,
    catalogItems: state.catalogItems
  });
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ===== HISTORY (UNDO) =====
function pushHistory(description, undoFn, data) {
  const entry = {
    id: genId(),
    description,
    timestamp: Date.now(),
    data: JSON.parse(JSON.stringify(data)) // deep clone
  };
  // Store undo function name and params separately
  entry.undoType = undoFn;
  state.history.unshift(entry);
  if (state.history.length > 20) state.history.pop();
  saveData('history');
  renderHistory();
  // Show undo button
  const btn = document.getElementById('btnUndoGlobal');
  if (btn) btn.style.display = '';
}

async function undoLast() {
  if (!state.history.length) return;
  const entry = state.history[0];

  if (entry.undoType === 'DELETE_EXAM') {
    state.exams.push(entry.data);
    await saveData('exams');
    toast('↩️ Deneme geri alındı', 'success');
  } else if (entry.undoType === 'DELETE_SCHOOL') {
    state.schools.push(entry.data);
    await saveData('schools');
    toast('↩️ Okul geri alındı', 'success');
  } else if (entry.undoType === 'STATUS_CHANGE') {
    const idx = state.exams.findIndex(e => e.id === entry.data.id);
    if (idx !== -1) {
      state.exams[idx].status = entry.data.oldStatus;
      await saveData('exams');
    }
    toast('↩️ Durum geri alındı', 'success');
  } else if (entry.undoType === 'BULK_STATUS') {
    entry.data.forEach(({ id, oldStatus }) => {
      const idx = state.exams.findIndex(e => e.id === id);
      if (idx !== -1) state.exams[idx].status = oldStatus;
    });
    await saveData('exams');
    toast('↩️ Toplu durum geri alındı', 'success');
  }

  state.history.shift();
  await saveData('history');
  renderHistory();
  renderExamList();
  if (!state.history.length) {
    const btn = document.getElementById('btnUndoGlobal');
    if (btn) btn.style.display = 'none';
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  // Handle Google OAuth redirect callback
  handleOAuthCallback();
  
  // Ensure app is visible immediately
  document.body.style.opacity = '1';
  await loadData();
  setupTabs();
  setupEventListeners();
  setupCatalogListeners();
  setupTabMode();
  setupStorageSync();
  setupKeyboardShortcuts();
  renderAll();
  checkAlerts();
  triggerBadgeUpdate();
});

function renderAll() {
  renderCalendar();
  renderExamList();
  renderSchoolList();
  renderReports();
  renderSettings();
  populateFilters();
  renderHistory();
}

// ===== TAB MODE =====
function setupTabMode() {
  // In standalone PWA mode, never use tab mode
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
    || window.navigator.standalone === true;
  const isTab = !isStandalone && window.outerWidth > 600;
  if (isTab) document.body.classList.add('tab-mode');

  const btn = document.getElementById('btnOpenTab');
  if (btn) btn.addEventListener('click', () => {
    window.open(window.location.href, '_blank');
  });
}

// ===== REAL-TIME SYNC =====
function setupStorageSync() {
  // PWA: no cross-tab sync needed (single tab app)
  if (false) (function() {
    const modalOpen = !document.getElementById('modalOverlay').classList.contains('hidden');
    if (modalOpen) return;
    let updated = false;
    const keys = ['exams','schools','categories','payments','publishers','periods','settings'];
    keys.forEach(k => {
      if (changes[k]) { state[k] = changes[k].newValue || (Array.isArray(state[k]) ? [] : {}); updated = true; }
    });
    if (updated) { renderAll(); checkAlerts(); showSyncToast(); }
  });
}

function showSyncToast() {
  toast('🔄 Senkronize edildi', 'success');
}

// ===== KEYBOARD SHORTCUTS =====
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+Z = undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undoLast();
    }
    // Escape = close modal
    if (e.key === 'Escape') closeModal();
    // Ctrl+F = focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      const s = document.getElementById('searchInput');
      if (s) { s.focus(); s.select(); }
    }
  });
}

// ===== TABS =====
function setupTabs() {
  const content = document.getElementById('mainContent');
  document.querySelectorAll('.tab').forEach(btn => {
    // Use both touchend and click for iOS PWA reliability
    const switchTab = (e) => {
      e.preventDefault();
      const tab = btn.dataset.tab;
      state.activeTab = tab;
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
      if (content) content.scrollTop = 0;
      if (tab === 'reports') renderReports();
      if (tab === 'schools') { showSchoolList(); }
      if (tab === 'settings') renderSettings();
    };
    btn.addEventListener('click', switchTab);
  });
}

// ===== ALERTS =====
function checkAlerts() {
  const today = new Date(); today.setHours(0,0,0,0);
  const in5 = new Date(today); in5.setDate(in5.getDate() + 5);
  const alerts = [];

  state.exams.forEach(exam => {
    if (exam.status === 'applied') return;

    // Stok tarihi yaklaşıyor
    if (exam.stockDate) {
      const sd = new Date(exam.stockDate); sd.setHours(0,0,0,0);
      const diff = Math.ceil((sd - today) / 86400000);
      if (diff >= 0 && diff <= (state.settings.notifyStockDays || 3)) {
        alerts.push({ type: 'stock', exam, diff });
      }
    }

    // Uygulama tarihi yakın ama teslim edilmemiş
    if (exam.applicationDate && exam.status !== 'delivered') {
      const ad = new Date(exam.applicationDate); ad.setHours(0,0,0,0);
      const diff = Math.ceil((ad - today) / 86400000);
      if (diff >= 0 && diff <= 5) {
        alerts.push({ type: 'undelivered', exam, diff });
      }
    }
  });

  const bell = document.getElementById('alertBell');
  const count = document.getElementById('alertCount');
  if (bell && count) {
    if (alerts.length > 0) {
      bell.classList.remove('hidden');
      count.textContent = alerts.length;
      bell.onclick = () => showAlertsModal(alerts);
    } else {
      bell.classList.add('hidden');
    }
  }
}

function showAlertsModal(alerts) {
  const html = `
    <div class="modal-title">🔔 Uyarılar (${alerts.length}) <button class="modal-close" id="closeModal">×</button></div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${alerts.map(a => {
        const sc = STATUS_CONFIG[a.exam.status || 'ordered'];
        if (a.type === 'stock') {
          return `<div style="padding:10px;background:#fef9c3;border-radius:8px;border-left:4px solid #f59e0b">
            <div style="font-weight:700;font-size:12px">📦 Stok Tarihi Yaklaşıyor</div>
            <div style="font-size:11px;margin-top:3px;color:#92400e">
              <b>${a.exam.name}</b>${a.exam.schoolName ? ' — ' + a.exam.schoolName : ''}
              <br>${a.diff === 0 ? '<b style="color:#ef4444">BUGÜN!</b>' : a.diff + ' gün kaldı'}
            </div>
          </div>`;
        } else {
          return `<div style="padding:10px;background:#fee2e2;border-radius:8px;border-left:4px solid #ef4444">
            <div style="font-weight:700;font-size:12px">⚠️ Uygulama Yakın, Teslim Edilmedi!</div>
            <div style="font-size:11px;margin-top:3px;color:#991b1b">
              <b>${a.exam.name}</b>${a.exam.schoolName ? ' — ' + a.exam.schoolName : ''}
              <br>${a.diff === 0 ? '<b>Bugün uygulama!</b>' : a.diff + ' gün sonra uygulama'} • Durum: ${sc.short}
            </div>
          </div>`;
        }
      }).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn-primary" id="cancelModal">Tamam</button>
    </div>`;
  openModal(html);
}

function triggerBadgeUpdate() {
  // Update page title badge instead of extension icon
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const in3 = new Date(today); in3.setDate(in3.getDate()+3);
    const count = state.exams.filter(e => {
      if (e.status==='applied') return false;
      const sd = e.stockDate||'', ad = e.applicationDate||'';
      const ts = today.toISOString().split('T')[0], t3 = in3.toISOString().split('T')[0];
      return (sd>=ts&&sd<=t3)||(ad>=ts&&ad<=t3);
    }).length;
    document.title = count > 0 ? `(${count}) DenemeTakip` : 'DenemeTakip';
  } catch(e) {}
}

// ===== TOAST =====
function toast(message, type = 'default', duration = 2500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Calendar nav
  document.getElementById('prevPeriod').addEventListener('click', () => {
    if (state.calView === 'month') {
      state.currentMonth--;
      if (state.currentMonth < 0) { state.currentMonth = 11; state.currentYear--; }
    } else {
      state.currentYear--;
    }
    renderCalendar();
  });
  document.getElementById('nextPeriod').addEventListener('click', () => {
    if (state.calView === 'month') {
      state.currentMonth++;
      if (state.currentMonth > 11) { state.currentMonth = 0; state.currentYear++; }
    } else {
      state.currentYear++;
    }
    renderCalendar();
  });

  // Calendar view toggle
  document.querySelectorAll('.cal-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.calView = btn.dataset.view;
      document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCalendar();
    });
  });

  // List buttons
  document.getElementById('btnAddExam').addEventListener('click', () => openCombinedExamModal());
  document.getElementById('btnAddSchool').addEventListener('click', () => openSchoolModal());
  document.getElementById('btnImportSchools').addEventListener('click', () => openSchoolImportModal());

  // Search
  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    searchClear.classList.toggle('hidden', !e.target.value);
    renderExamList();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = ''; state.searchQuery = '';
    searchClear.classList.add('hidden');
    renderExamList();
  });

  // Filters
  document.getElementById('filterCat').addEventListener('change', e => { state.filterCat = e.target.value; renderExamList(); });
  document.getElementById('filterPub')?.addEventListener('change', e => { state.filterPub = e.target.value; renderExamList(); });
  document.getElementById('filterType').addEventListener('change', e => { state.filterType = e.target.value; renderExamList(); });
  document.getElementById('filterPeriod').addEventListener('change', e => { state.filterPeriod = e.target.value; renderExamList(); });
  document.getElementById('filterSort').addEventListener('change', e => { state.filterSort = e.target.value; renderExamList(); });

  // Calendar school filter
  document.getElementById('calFilterSchool')?.addEventListener('change', e => {
    state.calFilterSchool = e.target.value;
    renderCalendar();
  });

  // Subtabs
  document.querySelectorAll('.list-subtab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.list-subtab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filterSubtab = btn.dataset.subtab;
      renderExamList();
    });
  });

  // Bulk actions
  document.getElementById('btnBulkDelete').addEventListener('click', bulkDelete);
  document.getElementById('btnBulkCancel').addEventListener('click', cancelBulkMode);

  // School compare
  document.getElementById('btnCompareSchools').addEventListener('click', showSchoolCompare);

  // Report tabs
  document.querySelectorAll('.report-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.report-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeReportTab = btn.dataset.rtab;
      renderReports();
    });
  });

  // Settings
  document.getElementById('btnAddCat').addEventListener('click', addCategory);
  document.getElementById('btnPeriodWizard')?.addEventListener('click', openPeriodWizard);
  document.getElementById('btnAddPublisher').addEventListener('click', () => {
    document.getElementById('addPublisherRow').style.display = 'flex';
    document.getElementById('btnAddPublisher').style.display = 'none';
  });
  document.getElementById('btnSavePublisher').addEventListener('click', savePublisher);
  document.getElementById('btnCancelPublisher').addEventListener('click', () => {
    document.getElementById('addPublisherRow').style.display = 'none';
    document.getElementById('btnAddPublisher').style.display = '';
  });
  document.getElementById('btnAddPeriod').addEventListener('click', addPeriod);
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
  document.getElementById('btnExportBackup').addEventListener('click', exportBackup);
  document.getElementById('btnDriveBackup').addEventListener('click', driveBackup);
  document.getElementById('btnImportBackup').addEventListener('change', importBackup);

  // Undo button
  const undoBtn = document.getElementById('btnUndoGlobal');
  if (undoBtn) {
    undoBtn.addEventListener('click', undoLast);
    undoBtn.style.display = state.history.length ? '' : 'none';
  }

  // Modal close
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
}

// ===== CALENDAR =====
const MONTHS = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const DAYS_SHORT = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];

function renderCalendar() {
  if (state.calView === 'year') {
    document.getElementById('calendarTitle').textContent = String(state.currentYear);
    document.getElementById('calendarGrid').classList.add('hidden');
    document.getElementById('yearGrid').classList.remove('hidden');
    document.getElementById('calendarLegend').style.display = '';
    renderYearView();
  } else {
    document.getElementById('calendarTitle').textContent = `${MONTHS[state.currentMonth]} ${state.currentYear}`;
    document.getElementById('calendarGrid').classList.remove('hidden');
    document.getElementById('yearGrid').classList.add('hidden');
    document.getElementById('calendarLegend').style.display = '';
    renderMonthView();
  }
}

function renderMonthView() {
  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  // Headers
  DAYS_SHORT.forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-header'; h.textContent = d; grid.appendChild(h);
  });

  // Build event map with school colors
  const eventMap = buildEventMap(state.currentYear, state.currentMonth);

  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;
  const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const prevLast = new Date(state.currentYear, state.currentMonth, 0).getDate();
  const today = new Date();

  // Prev month cells
  for (let i = startDow - 1; i >= 0; i--) {
    const cell = document.createElement('div');
    cell.className = 'cal-day other-month';
    cell.innerHTML = `<span class="day-num">${prevLast - i}</span>`;
    grid.appendChild(cell);
  }

  // Current month cells
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = toDateStr(state.currentYear, state.currentMonth + 1, d);
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.dataset.date = dateStr;

    if (today.getFullYear() === state.currentYear && today.getMonth() === state.currentMonth && today.getDate() === d) {
      cell.classList.add('today');
    }

    const dayNum = document.createElement('span');
    dayNum.className = 'day-num';
    dayNum.textContent = d;
    cell.appendChild(dayNum);

    if (eventMap[dateStr] && eventMap[dateStr].length > 0) {
      cell.classList.add('has-events');
      const dots = document.createElement('div');
      dots.className = 'day-dots';
      eventMap[dateStr].slice(0, 6).forEach(ev => {
        const dot = document.createElement('div');
        dot.className = 'day-dot';
        dot.style.background = ev.color;
        dot.title = `${ev.label}: ${ev.exam.name}`;
        dot.draggable = true;
        dot.dataset.examId = ev.exam.id;
        dot.dataset.dateType = ev.type;

        dot.addEventListener('dragstart', (e) => {
          state.dragExamId = ev.exam.id;
          state.dragDateType = ev.type;
          e.dataTransfer.effectAllowed = 'move';
        });
        dots.appendChild(dot);
      });
      cell.appendChild(dots);
      cell.addEventListener('click', () => showDayDetail(dateStr, eventMap[dateStr]));
    }

    // Drop target
    cell.addEventListener('dragover', (e) => { e.preventDefault(); cell.classList.add('drag-over'); });
    cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.classList.remove('drag-over');
      if (state.dragExamId) handleCalendarDrop(state.dragExamId, state.dragDateType, dateStr);
    });

    grid.appendChild(cell);
  }

  // Next month cells
  const totalCells = startDow + lastDay;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let i = 1; i <= remaining; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-day other-month';
    cell.innerHTML = `<span class="day-num">${i}</span>`;
    grid.appendChild(cell);
  }
}

function renderYearView() {
  const grid = document.getElementById('yearGrid');
  grid.innerHTML = '';

  for (let m = 0; m < 12; m++) {
    const mini = document.createElement('div');
    mini.className = 'mini-month';
    const evMap = buildEventMap(state.currentYear, m);
    const firstDow = (() => { let d = new Date(state.currentYear, m, 1).getDay(); return d === 0 ? 6 : d - 1; })();
    const lastD = new Date(state.currentYear, m + 1, 0).getDate();
    const today = new Date();

    let miniHtml = `<div class="mini-month-title">${MONTHS[m]}</div><div class="mini-grid">`;
    DAYS_SHORT.forEach(d => { miniHtml += `<div class="mini-day" style="font-weight:700;color:var(--text-muted)">${d[0]}</div>`; });
    for (let i = 0; i < firstDow; i++) miniHtml += `<div class="mini-day"></div>`;

    for (let d = 1; d <= lastD; d++) {
      const ds = toDateStr(state.currentYear, m + 1, d);
      const evs = evMap[ds] || [];
      const hasStock = evs.some(e => e.type === 'stock');
      const hasApp = evs.some(e => e.type === 'app');
      const isToday = today.getFullYear() === state.currentYear && today.getMonth() === m && today.getDate() === d;
      let cls = 'mini-day';
      if (hasStock && hasApp) cls += ' has-both';
      else if (hasStock) cls += ' has-stock';
      else if (hasApp) cls += ' has-app';
      if (isToday) cls += ' today-mini';
      miniHtml += `<div class="${cls}" title="${ds}">${d}</div>`;
    }
    miniHtml += '</div>';
    mini.innerHTML = miniHtml;
    mini.style.cursor = 'pointer';
    mini.addEventListener('click', () => {
      state.calView = 'month';
      state.currentMonth = m;
      document.querySelectorAll('.cal-view-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.cal-view-btn[data-view="month"]').classList.add('active');
      renderCalendar();
    });
    grid.appendChild(mini);
  }
}

function buildEventMap(year, month) {
  const map = {};
  // Filter by school if set
  const schoolFilter = state.calFilterSchool || '';
  state.exams.forEach(exam => {
    if (schoolFilter && exam.schoolId !== schoolFilter) return;
    const school = state.schools.find(s => s.id === exam.schoolId);
    // School color for calendar (renk kodlu takvim)
    const schoolColor = school?.color || null;
    const cat = getCatById(exam.categoryId);
    const defaultColor = cat?.color || '#8b5cf6';

    if (exam.stockDate) {
      if (!map[exam.stockDate]) map[exam.stockDate] = [];
      map[exam.stockDate].push({
        type: 'stock', exam,
        color: schoolColor || '#f59e0b',
        label: 'Stok'
      });
    }
    if (exam.applicationDate) {
      if (!map[exam.applicationDate]) map[exam.applicationDate] = [];
      map[exam.applicationDate].push({
        type: 'app', exam,
        color: schoolColor || defaultColor,
        label: 'Uygulama'
      });
    }
  });
  return map;
}

async function handleCalendarDrop(examId, dateType, newDate) {
  const idx = state.exams.findIndex(e => e.id === examId);
  if (idx === -1) return;
  const exam = state.exams[idx];
  const oldDate = dateType === 'stock' ? exam.stockDate : exam.applicationDate;

  if (dateType === 'stock') state.exams[idx].stockDate = newDate;
  else state.exams[idx].applicationDate = newDate;

  await saveData('exams');
  renderCalendar();
  toast(`📅 ${dateType === 'stock' ? 'Stok' : 'Uygulama'} tarihi güncellendi: ${formatDate(newDate)}`, 'success');
}

function showDayDetail(dateStr, events) {
  const detail = document.getElementById('dayDetail');
  detail.innerHTML = `<h4>📅 ${formatDate(dateStr)}</h4>`;
  detail.classList.remove('hidden');
  events.forEach(ev => {
    const item = document.createElement('div');
    item.className = 'day-detail-item';
    item.style.background = ev.type === 'stock' ? '#fef3c7' : '#ede9ff';
    item.style.color = ev.type === 'stock' ? '#92400e' : '#5b21b6';
    const icon = ev.type === 'stock' ? '📦' : '🎯';
    const label = ev.type === 'stock' ? 'Stok' : 'Uygulama';
    const cat = getCatById(ev.exam.categoryId);
    item.innerHTML = `${icon} <b>${ev.exam.name}</b> — ${label}
      <span style="margin-left:auto;font-size:10px;opacity:0.7">
        ${cat ? cat.name : ''} ${ev.exam.type || ''} ${ev.exam.schoolName || ''}
      </span>`;
    detail.appendChild(item);
  });
}


// ===== EXAM LIST =====
function renderExamList() {
  const list = document.getElementById('examList');
  let exams = [...state.exams];

  // Period filter
  if (state.filterPeriod) exams = exams.filter(e => e.periodId === state.filterPeriod);

  // Subtab filter
  if (state.filterSubtab === 'pending') exams = exams.filter(e => (e.status || 'ordered') !== 'applied');
  else if (state.filterSubtab === 'applied') exams = exams.filter(e => e.status === 'applied');

  // Category/type/publisher filter
  if (state.filterCat) exams = exams.filter(e => (e.categoryIds || [e.categoryId]).includes(state.filterCat));
  if (state.filterType) exams = exams.filter(e => e.type === state.filterType);
  if (state.filterPub) exams = exams.filter(e => e.publisherId === state.filterPub);

  // Search
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    exams = exams.filter(e =>
      e.name?.toLowerCase().includes(q) ||
      e.schoolName?.toLowerCase().includes(q) ||
      e.categoryNames?.toLowerCase().includes(q) ||
      e.type?.toLowerCase().includes(q) ||
      (e.applicationDate && formatDate(e.applicationDate).includes(q)) ||
      (e.stockDate && formatDate(e.stockDate).includes(q)) ||
      (e.status && STATUS_CONFIG[e.status]?.label.toLowerCase().includes(q)) ||
      (e.trackingNumber && e.trackingNumber.toLowerCase().includes(q))
    );
  }

  // Sort
  exams.sort((a, b) => {
    const sort = state.filterSort || 'appDate';
    if (sort === 'appDate')     return (a.applicationDate||'').localeCompare(b.applicationDate||'');
    if (sort === 'appDateDesc') return (b.applicationDate||'').localeCompare(a.applicationDate||'');
    if (sort === 'stockDate')   return (a.stockDate||'').localeCompare(b.stockDate||'');
    if (sort === 'stockDateDesc') return (b.stockDate||'').localeCompare(a.stockDate||'');
    if (sort === 'name')        return (a.name||'').localeCompare(b.name||'', 'tr');
    return 0;
  });

  const bulkToolbar = document.getElementById('bulkToolbar');
  if (state.bulkMode) {
    bulkToolbar.classList.remove('hidden');
    document.getElementById('bulkCount').textContent = `${state.selectedExams.size} seçili`;
    list.classList.add('bulk-mode');
  } else {
    bulkToolbar.classList.add('hidden');
    list.classList.remove('bulk-mode');
  }

  if (exams.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">${state.filterSubtab === 'applied' ? '✅' : '📝'}</div>
      ${state.searchQuery ? 'Arama sonucu bulunamadı' :
        state.filterSubtab === 'applied' ? 'Uygulanmış deneme yok' :
        state.filterSubtab === 'pending' ? 'Bekleyen deneme yok' : 'Henüz deneme eklenmedi'}
    </div>`;
    return;
  }

  list.innerHTML = '';
  exams.forEach(exam => {
    const cat = getCatById(exam.categoryId);
    const catBadges = (exam.categoryIds?.length > 0 ? exam.categoryIds : (exam.categoryId ? [exam.categoryId] : []))
      .map(id => { const c = getCatById(id); return c ? `<span class="badge" style="background:${c.color}22;color:${c.color}">${c.name}</span>` : ''; }).join('');

    const status = exam.status || 'ordered';
    const sc = STATUS_CONFIG[status] || STATUS_CONFIG.ordered;
    const isApplied = status === 'applied';
    const isSelected = state.selectedExams.has(exam.id);

    const card = document.createElement('div');
    card.className = 'exam-card' + (isApplied ? ' exam-applied' : '') + (isSelected ? ' selected' : '');
    card.style.borderLeftColor = sc.color;

    // Notes preview
    const notesHtml = exam.notes?.length > 0
      ? `<div class="exam-notes-preview">📝 ${exam.notes[exam.notes.length-1].text}</div>` : '';

    // Tracking number
    const trackingHtml = exam.trackingNumber
      ? `<span class="exam-meta-item"><a class="tracking-link" href="https://www.ptt.gov.tr/tr/bireysel/gonderi-takip#${exam.trackingNumber}" target="_blank">📮 ${exam.trackingNumber}</a></span>` : '';

    // Period badge
    const period = state.periods.find(p => p.id === exam.periodId);
    const periodBadge = period ? `<span class="badge" style="background:#f0fdf4;color:#166534;font-size:9px">${period.name}</span>` : '';

    // Publisher name
    // Publisher: look up by ID first, fall back to stored name, then catalog item
    const publisher = state.publishers.find(p => p.id === exam.publisherId);
    let pubDisplay = '';
    if (publisher) {
      // Use short name if it's meaningfully shorter, else full name
      pubDisplay = publisher.short || publisher.name;
    } else if (exam.publisherName) {
      // Strip only "KURUMSAL DENEME 2025-26" part, keep the publisher identity
      pubDisplay = exam.publisherName
        .replace(/ KURUMSAL DENEME \d{4}-\d{2,4}$/,'')
        .replace(/ KURUMSAL DENEME$/,'')
        .trim();
    } else if (exam.catalogItemId) {
      const ci = state.catalogItems.find(i => i.id === exam.catalogItemId);
      if (ci?.publisherName) {
        pubDisplay = ci.publisherName
          .replace(/ KURUMSAL DENEME \d{4}-\d{2,4}$/,'')
          .replace(/ KURUMSAL DENEME$/,'')
          .trim();
      }
    }
    const pubBadge = pubDisplay
      ? `<span style="font-size:10px;color:var(--text-muted);font-weight:600">📚 ${pubDisplay}</span>` : '';

    card.innerHTML = `
      <div class="exam-card-header">
        <div class="exam-card-header-left">
          <input type="checkbox" class="exam-select-cb" ${isSelected ? 'checked' : ''} data-id="${exam.id}">
          <div style="min-width:0">
            <span class="exam-name">${exam.name}</span>
            ${pubBadge}
          </div>
        </div>
        <div class="exam-badges">
          ${catBadges}
          ${exam.type ? `<span class="badge badge-type-${exam.type.toLowerCase()}">${exam.type}</span>` : ''}
          ${periodBadge}
        </div>
      </div>
      <div class="exam-card-meta">
        ${exam.schoolName ? `<span class="exam-meta-item">🏫 ${exam.schoolName}</span>` : ''}
        ${exam.stockDate ? `<span class="exam-meta-item">📦 Stok: ${formatDate(exam.stockDate)}</span>` : ''}
        ${exam.applicationDate ? `<span class="exam-meta-item">🎯 Uygulama: ${formatDate(exam.applicationDate)}</span>` : ''}
        ${exam.price ? `<span class="exam-meta-item">💰 ${exam.qty ? exam.qty + ' × ' + Number(exam.unitPrice).toLocaleString('tr-TR') + ' ₺ = ' : ''}${Number(exam.price).toLocaleString('tr-TR')} ₺</span>` : ''}
        ${trackingHtml}
      </div>
      ${(exam.categoryBreakdown && Object.keys(exam.categoryBreakdown).length > 1) ? `
      <div class="exam-cat-breakdown">
        ${Object.entries(exam.categoryBreakdown).map(([id, qty]) => {
          const c = getCatById(id);
          return c ? `<span class="exam-cat-breakdown-chip" style="background:${c.color}18;color:${c.color};border:1px solid ${c.color}33">${c.name}: <b>${qty}</b></span>` : '';
        }).join('')}
        <span class="exam-cat-breakdown-chip" style="background:var(--primary-light);color:var(--primary);font-weight:800">Toplam: ${Object.values(exam.categoryBreakdown).reduce((s,v)=>s+v,0)}</span>
      </div>` : ''}
      ${notesHtml}
      <div class="exam-status-row">
        <div class="status-steps">
          ${STATUS_ORDER.map(key => {
            const s = STATUS_CONFIG[key];
            const isDone = STATUS_ORDER.indexOf(key) < STATUS_ORDER.indexOf(status);
            const isActive = key === status;
            return `<button class="status-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}"
              data-id="${exam.id}" data-status="${key}"
              style="--sc:${s.color}" title="${s.label}">
              ${s.short}
            </button>`;
          }).join('')}
        </div>
      </div>
      <div class="exam-card-actions">
        <button class="btn-xs btn-edit" data-id="${exam.id}">✏️</button>
        <button class="btn-xs btn-copy" data-id="${exam.id}" title="Kopyala">📋</button>
        <button class="btn-xs btn-note" data-id="${exam.id}" title="Not Ekle">📝</button>
        <button class="btn-xs btn-result" data-id="${exam.id}" title="Sonuç Gir" style="${exam.result ? 'background:#d1fae5;color:#065f46' : ''}">
          ${exam.result ? '📊 Sonuç' : '📊'}
        </button>
        <button class="btn-xs btn-gcal" data-id="${exam.id}" style="${exam.gcalAdded ? 'background:#dcfce7;color:#166534' : ''}">
          ${exam.gcalAdded ? '✅ Takvim' : '📅 Takvim'}
        </button>
        <button class="btn-xs btn-delete" data-id="${exam.id}">🗑️</button>
      </div>`;

    list.appendChild(card);
  });

  // Attach listeners
  list.querySelectorAll('.exam-select-cb').forEach(cb => {
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = cb.dataset.id;
      if (cb.checked) {
        state.selectedExams.add(id);
        state.bulkMode = true;
      } else {
        state.selectedExams.delete(id);
        if (state.selectedExams.size === 0) state.bulkMode = false;
      }
      renderExamList();
    });
  });
  list.querySelectorAll('.btn-edit').forEach(b => b.addEventListener('click', () => openExamModal(b.dataset.id)));
  list.querySelectorAll('.btn-copy').forEach(b => b.addEventListener('click', () => copyExam(b.dataset.id)));
  list.querySelectorAll('.btn-note').forEach(b => b.addEventListener('click', () => openNotesModal(b.dataset.id)));
  list.querySelectorAll('.btn-result').forEach(b => b.addEventListener('click', () => openExamResultModal(b.dataset.id)));
  list.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', () => deleteExam(b.dataset.id)));
  list.querySelectorAll('.btn-gcal').forEach(b => b.addEventListener('click', () => addSingleToGCal(b.dataset.id)));
  list.querySelectorAll('.status-step').forEach(b => b.addEventListener('click', () => setExamStatus(b.dataset.id, b.dataset.status)));

  // Bulk status buttons
  const bulkBtns = document.getElementById('bulkStatusBtns');
  if (bulkBtns) {
    bulkBtns.innerHTML = '';
    STATUS_ORDER.forEach(key => {
      const s = STATUS_CONFIG[key];
      const btn = document.createElement('button');
      btn.className = 'btn-xs';
      btn.style.background = s.color + '22';
      btn.style.color = s.color;
      btn.style.border = `1px solid ${s.color}`;
      btn.textContent = s.short;
      btn.addEventListener('click', () => bulkSetStatus(key));
      bulkBtns.appendChild(btn);
    });
  }
}

function cancelBulkMode() {
  state.selectedExams.clear();
  state.bulkMode = false;
  renderExamList();
}

async function bulkSetStatus(newStatus) {
  if (!state.selectedExams.size) return;
  const undoData = [];
  state.selectedExams.forEach(id => {
    const exam = state.exams.find(e => e.id === id);
    if (exam) undoData.push({ id, oldStatus: exam.status || 'ordered' });
  });
  pushHistory(`${state.selectedExams.size} denemenin durumu → ${STATUS_CONFIG[newStatus].label}`, 'BULK_STATUS', undoData);

  state.selectedExams.forEach(id => {
    const idx = state.exams.findIndex(e => e.id === id);
    if (idx !== -1) {
      state.exams[idx].status = newStatus;
      state.exams[idx].applied = newStatus === 'applied';
    }
  });
  await saveData('exams');
  state.selectedExams.clear();
  state.bulkMode = false;
  renderExamList();
  toast(`✅ ${undoData.length} denemenin durumu güncellendi`, 'success');
  triggerBadgeUpdate();
}

async function bulkDelete() {
  if (!state.selectedExams.size) return;
  if (!confirm(`${state.selectedExams.size} denemeyi silmek istediğinize emin misiniz?`)) return;
  state.exams = state.exams.filter(e => !state.selectedExams.has(e.id));
  await saveData('exams');
  state.selectedExams.clear();
  state.bulkMode = false;
  renderExamList();
  toast('🗑️ Denemeler silindi', 'success');
  triggerBadgeUpdate();
}

async function setExamStatus(id, status) {
  const idx = state.exams.findIndex(e => e.id === id);
  if (idx === -1) return;
  const oldStatus = state.exams[idx].status || 'ordered';
  pushHistory(`${state.exams[idx].name} → ${STATUS_CONFIG[status].label}`, 'STATUS_CHANGE', { id, oldStatus });
  state.exams[idx].status = status;
  state.exams[idx].applied = status === 'applied';
  await saveData('exams');
  renderExamList();
  checkAlerts();
  triggerBadgeUpdate();
}

async function copyExam(id) {
  const original = state.exams.find(e => e.id === id);
  if (!original) return;
  const copy = { ...JSON.parse(JSON.stringify(original)), id: genId(), gcalAdded: false, gcalEventIds: [], status: 'ordered', applied: false };
  copy.name = copy.name + ' (Kopya)';
  state.exams.push(copy);
  await saveData('exams');
  renderExamList();
  renderCalendar();
  toast('📋 Deneme kopyalandı', 'success');
}

function openNotesModal(examId) {
  const exam = state.exams.find(e => e.id === examId);
  if (!exam) return;
  const notes = exam.notes || [];

  const html = `
    <div class="modal-title">📝 Notlar — ${exam.name} <button class="modal-close" id="closeModal">×</button></div>
    <div class="notes-list" id="notesList" style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;max-height:200px;overflow-y:auto">
      ${notes.length === 0 ? '<div style="color:var(--text-muted);font-size:12px;padding:8px">Henüz not yok</div>' :
        notes.map(n => `
          <div style="background:var(--bg);border-radius:8px;padding:8px 10px;position:relative">
            <div style="font-size:12px;color:var(--text)">${n.text}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:3px">${new Date(n.createdAt).toLocaleDateString('tr-TR')} ${new Date(n.createdAt).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</div>
            <button class="btn-xs btn-delete note-delete" data-id="${n.id}" style="position:absolute;top:6px;right:6px;padding:2px 6px">✕</button>
          </div>`).join('')}
    </div>
    <div class="form-group">
      <label class="form-label">Yeni Not</label>
      <textarea id="newNoteText" class="form-textarea" placeholder="Not yazın..."></textarea>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">Kapat</button>
      <button class="btn-primary" id="saveNote">💾 Not Ekle</button>
    </div>`;

  openModal(html);

  document.querySelectorAll('.note-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = state.exams.findIndex(e => e.id === examId);
      if (idx !== -1) {
        state.exams[idx].notes = (state.exams[idx].notes || []).filter(n => n.id !== btn.dataset.id);
        await saveData('exams');
        openNotesModal(examId);
      }
    });
  });

  document.getElementById('saveNote').addEventListener('click', async () => {
    const text = document.getElementById('newNoteText').value.trim();
    if (!text) return;
    const idx = state.exams.findIndex(e => e.id === examId);
    if (idx !== -1) {
      if (!state.exams[idx].notes) state.exams[idx].notes = [];
      state.exams[idx].notes.push({ id: genId(), text, createdAt: Date.now() });
      await saveData('exams');
      openNotesModal(examId);
      renderExamList();
    }
  });
}

async function deleteExam(id) {
  if (!confirm('Bu denemeyi silmek istediğinize emin misiniz?')) return;
  const exam = state.exams.find(e => e.id === id);
  if (!exam) return;

  pushHistory(`"${exam.name}" silindi`, 'DELETE_EXAM', exam);

  // Google Calendar'dan sil
  if (exam.gcalAdded) {
    try {
      const token = await getGoogleToken();
      if (exam.gcalEventIds?.length > 0) {
        for (const eid of exam.gcalEventIds) {
          await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eid}`, {
            method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
          });
        }
      } else {
        // İsme göre ara ve sil
        const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?q=${encodeURIComponent(exam.name)}&maxResults=10`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (r.ok) {
          const d = await r.json();
          for (const ev of (d.items || [])) {
            if (ev.summary?.includes(exam.name)) {
              await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${ev.id}`, {
                method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` }
              });
            }
          }
        }
      }
    } catch (e) { console.error('GCal delete error:', e); }
  }

  state.exams = state.exams.filter(e => e.id !== id);
  await saveData('exams');
  renderExamList();
  renderCalendar();
  triggerBadgeUpdate();
  toast('🗑️ Deneme silindi', 'success');
}


// ===== SCHOOL LIST =====
function renderSchoolList() {
  if (state.viewingSchool) {
    showSchoolDetail(state.viewingSchool);
    return;
  }
  const list = document.getElementById('schoolList');
  if (!list) return;

  const totalDebt = state.schools.reduce((sum, s) => sum + Math.max(0, calcSchoolDebt(s.id)), 0);
  const el = document.getElementById('schoolSummary');
  if (el) el.textContent = `Toplam alacak: ${totalDebt.toLocaleString('tr-TR')} ₺`;

  if (state.schools.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">🏫</div>Henüz okul eklenmedi</div>`;
    return;
  }

  list.innerHTML = '';
  state.schools.forEach(school => {
    const debt = calcSchoolDebt(school.id);
    const examCount = state.exams.filter(e => e.schoolId === school.id).length;
    const debtClass = debt > 0 ? 'debt-positive' : debt < 0 ? 'debt-negative' : 'debt-zero';
    const card = document.createElement('div');
    card.className = 'school-card';
    card.style.borderLeftColor = school.color || 'var(--primary)';
    card.innerHTML = `
      <div style="flex:1;min-width:0">
        <div class="school-name">${school.name}</div>
        <div class="school-stats">${examCount} deneme • ${(school.contacts?.length || 0)} yetkili</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="school-debt" style="cursor:pointer">
          <div class="debt-amount ${debtClass}">${Math.abs(debt).toLocaleString('tr-TR')} ₺</div>
          <div style="font-size:10px;color:var(--text-muted)">${debt > 0 ? 'Borç' : debt < 0 ? 'Alacak' : 'Ödendi'}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:3px">
          <button class="btn-xs btn-edit school-edit-btn" data-id="${school.id}">✏️</button>
          <button class="btn-xs btn-delete school-del-btn" data-id="${school.id}">🗑️</button>
        </div>
      </div>`;

    const mainArea = card.querySelector('div:first-child');
    mainArea.style.cursor = 'pointer';
    mainArea.addEventListener('click', () => { state.viewingSchool = school.id; showSchoolDetail(school.id); });
    card.querySelector('.school-debt').addEventListener('click', () => { state.viewingSchool = school.id; showSchoolDetail(school.id); });
    card.querySelector('.school-edit-btn').addEventListener('click', e => { e.stopPropagation(); openSchoolModal(school.id); });
    card.querySelector('.school-del-btn').addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm(`"${school.name}" silinsin mi?`)) return;
      pushHistory(`"${school.name}" okulu silindi`, 'DELETE_SCHOOL', school);
      state.schools = state.schools.filter(s => s.id !== school.id);
      await saveData('schools');
      renderSchoolList();
      toast('🗑️ Okul silindi', 'success');
    });
    list.appendChild(card);
  });
}

function showSchoolList() {
  state.viewingSchool = null;
  const list = document.getElementById('schoolList');
  const detail = document.getElementById('schoolDetail');
  const compare = document.getElementById('schoolCompare');
  const toolbar = document.getElementById('schoolsToolbar');
  if (list) list.classList.remove('hidden');
  if (detail) detail.classList.add('hidden');
  if (compare) compare.classList.add('hidden');
  if (toolbar) toolbar.classList.remove('hidden');
  renderSchoolList();
}

function showSchoolDetail(schoolId) {
  const school = state.schools.find(s => s.id === schoolId);
  if (!school) return;
  state.viewingSchool = schoolId;

  const list = document.getElementById('schoolList');
  const detail = document.getElementById('schoolDetail');
  const toolbar = document.getElementById('schoolsToolbar');
  const compare = document.getElementById('schoolCompare');

  if (list) list.classList.add('hidden');
  if (compare) compare.classList.add('hidden');
  if (toolbar) toolbar.classList.add('hidden');
  if (!detail) return;
  detail.classList.remove('hidden');

  const exams = state.exams.filter(e => e.schoolId === schoolId);
  const payments = state.payments.filter(p => p.schoolId === schoolId);
  const totalCharge = exams.reduce((sum, e) => sum + (Number(e.price)||0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount)||0), 0);
  const debt = totalCharge - totalPaid;
  const sc = school.studentCounts || {};
  const scEntries = Object.entries(sc).filter(([,v]) => v > 0);
  const contacts = school.contacts || [];

  // Portal token
  if (!school.portalToken) school.portalToken = genId() + genId();

  const portalUrl = `${window.location.origin}${window.location.pathname}?portal=1&token=${school.portalToken}`;

  detail.innerHTML = `
    <div class="school-detail-header">
      <button class="btn-back" id="btnBackSchools">← Geri</button>
      <div class="school-detail-name" style="color:${school.color||'var(--text)'}">${school.name}</div>
      <button class="btn-xs btn-edit" id="btnEditSchoolDetail" style="margin-left:auto">✏️ Düzenle</button>
    </div>

    <div class="debt-summary">
      <div class="debt-box">
        <div class="label">Toplam Tutar</div>
        <div class="value" style="color:var(--danger)">${totalCharge.toLocaleString('tr-TR')} ₺</div>
      </div>
      <div class="debt-box">
        <div class="label">Ödenen</div>
        <div class="value" style="color:var(--success)">${totalPaid.toLocaleString('tr-TR')} ₺</div>
      </div>
      <div class="debt-box">
        <div class="label">Kalan</div>
        <div class="value" style="color:${debt>0?'var(--danger)':debt<0?'var(--info)':'var(--success)'}">${debt.toLocaleString('tr-TR')} ₺</div>
      </div>
    </div>

    ${scEntries.length > 0 ? `
    <div class="section-title" style="margin-bottom:6px">👨‍🎓 Öğrenci Sayıları</div>
    <div class="student-counts-display" style="margin-bottom:10px">
      ${scEntries.map(([k,v]) => `<span class="student-count-badge">${CLASS_LABELS[k]||k}: <b>${v}</b></span>`).join('')}
    </div>` : ''}

    ${contacts.length > 0 ? `
    <div class="section-title" style="margin-bottom:6px">👤 Yetkililer</div>
    <div class="contacts-list" id="contactsList">
      ${contacts.map(c => `
        <div class="contact-item">
          <div class="contact-info">
            <div class="contact-name">${c.name} ${c.role ? '<span style="color:var(--text-muted);font-weight:400">— ' + c.role + '</span>' : ''}</div>
            <div class="contact-phone">${c.phone || ''} ${c.email ? '• ' + c.email : ''}</div>
          </div>
          <div class="contact-actions">
            ${c.phone ? `<a class="btn-xs btn-call" href="tel:${c.phone}" title="Ara">📞</a>` : ''}
          </div>
        </div>`).join('')}
    </div>` : ''}

    <div class="section-title" style="margin-top:10px;margin-bottom:6px">💳 Ödeme Ekle</div>
    <div class="payment-add-row">
      <input type="number" id="paymentAmount" placeholder="Tutar (₺)" class="input-sm" style="width:110px">
      <input type="date" id="paymentDate" class="input-sm">
      <input type="text" id="paymentNote" placeholder="Not" class="input-sm">
      <button class="btn-sm btn-success" id="btnAddPayment">Ekle</button>
    </div>

    <div class="section-title" style="margin-bottom:6px">📋 Ödeme Geçmişi</div>
    <div class="payment-list" id="paymentList">
      ${payments.length === 0 ? '<div style="font-size:11px;color:var(--text-muted);padding:6px">Henüz ödeme kaydı yok</div>' : ''}
    </div>

    <div class="section-title" style="margin-top:10px;margin-bottom:6px">📝 Denemeler (${exams.length})</div>
    <div class="school-exams-list" id="schoolExamsList"></div>

    <div class="section-title" style="margin-top:10px;margin-bottom:6px">🔗 Okul Portalı</div>
    <div class="portal-link-box">
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">Okula göndereceğiniz salt-okunur bağlantı:</div>
      <code class="portal-link-url" id="portalUrl">${portalUrl}</code>
      <div style="display:flex;gap:6px;margin-top:6px">
        <button class="btn-xs btn-edit" id="btnCopyPortal">📋 Kopyala</button>
        <button class="btn-xs btn-edit" id="btnOpenPortal">🔗 Aç</button>
      </div>
    </div>

    <div class="export-row">
      <button class="btn-secondary" id="btnExportPDF" style="font-size:11px">📄 PDF İndir</button>
      <button class="btn-secondary" id="btnExportExcel" style="font-size:11px">📊 Excel İndir</button>
    </div>`;

  // Render payments
  const pList = detail.querySelector('#paymentList');
  [...payments].sort((a,b) => (b.date||'').localeCompare(a.date||'')).forEach(p => {
    const item = document.createElement('div'); item.className = 'payment-item';
    item.innerHTML = `<span>${formatDate(p.date)} ${p.note ? '— ' + p.note : ''}</span>
      <div style="display:flex;align-items:center;gap:6px">
        <span class="payment-amount">+${Number(p.amount).toLocaleString('tr-TR')} ₺</span>
        <button class="btn-xs btn-delete" style="padding:1px 5px;font-size:10px" data-pid="${p.id}">✕</button>
      </div>`;
    item.querySelector('[data-pid]').addEventListener('click', async () => {
      state.payments = state.payments.filter(x => x.id !== p.id);
      await saveData('payments');
      showSchoolDetail(schoolId);
    });
    pList.appendChild(item);
  });

  // Render school exams
  const eList = detail.querySelector('#schoolExamsList');
  [...exams].sort((a,b) => (a.applicationDate||'').localeCompare(b.applicationDate||'')).forEach(e => {
    const sc2 = STATUS_CONFIG[e.status || 'ordered'];
    const row = document.createElement('div'); row.className = 'school-exam-row';
    row.innerHTML = `
      <div style="flex:1;min-width:0">
        <span class="school-exam-name">${e.name}</span>
        <span class="badge" style="margin-left:5px;font-size:9px;background:${sc2.color}22;color:${sc2.color}">${sc2.short}</span>
        ${(e.categoryIds||[]).map(id => { const c=getCatById(id); return c?`<span class="badge" style="font-size:9px;background:${c.color}22;color:${c.color}">${c.name}</span>`:''; }).join('')}
      </div>
      <div class="school-exam-date">
        ${e.applicationDate ? `🎯 ${formatDate(e.applicationDate)}` : ''}
        ${e.price ? `<br><span style="color:var(--danger);font-weight:700">${e.qty||''} × ${Number(e.unitPrice||0).toLocaleString('tr-TR')} = ${Number(e.price).toLocaleString('tr-TR')} ₺</span>` : ''}
      </div>`;
    eList.appendChild(row);
  });

  // Listeners
  detail.querySelector('#btnBackSchools').addEventListener('click', showSchoolList);
  detail.querySelector('#btnEditSchoolDetail').addEventListener('click', () => openSchoolModal(schoolId));
  detail.querySelector('#btnAddPayment').addEventListener('click', () => addPayment(schoolId));
  detail.querySelector('#btnExportPDF').addEventListener('click', () => exportPDF(school, exams, payments, debt));
  detail.querySelector('#btnExportExcel').addEventListener('click', () => exportExcel(school, exams, payments, debt));
  detail.querySelector('#btnCopyPortal').addEventListener('click', () => {
    navigator.clipboard.writeText(portalUrl).then(() => toast('📋 Link kopyalandı', 'success'));
  });
  detail.querySelector('#btnOpenPortal').addEventListener('click', () => {
    window.open(portalUrl, '_blank');
  });

  // Save portal token
  const sidx = state.schools.findIndex(s => s.id === schoolId);
  if (sidx !== -1 && !state.schools[sidx].portalToken) {
    state.schools[sidx].portalToken = school.portalToken;
    saveData('schools');
  }
}

function showSchoolCompare() {
  const compare = document.getElementById('schoolCompare');
  const list = document.getElementById('schoolList');
  const toolbar = document.getElementById('schoolsToolbar');
  const detail = document.getElementById('schoolDetail');
  if (list) list.classList.add('hidden');
  if (detail) detail.classList.add('hidden');
  if (toolbar) toolbar.classList.add('hidden');
  if (!compare) return;
  compare.classList.remove('hidden');

  const schools = state.schools.map(s => ({
    ...s,
    examCount: state.exams.filter(e => e.schoolId === s.id).length,
    debt: calcSchoolDebt(s.id),
    totalCharge: state.exams.filter(e => e.schoolId === s.id).reduce((sum, e) => sum + (Number(e.price)||0), 0),
  }));

  const maxExam = Math.max(...schools.map(s => s.examCount), 1);
  const maxCharge = Math.max(...schools.map(s => s.totalCharge), 1);

  compare.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <button class="btn-back" id="btnBackFromCompare">← Geri</button>
      <div style="font-size:15px;font-weight:800">Okul Karşılaştırma</div>
    </div>
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="background:var(--primary);color:white">
            <th style="padding:8px 10px;text-align:left;font-size:10px">OKUL</th>
            <th style="padding:8px 10px;text-align:center;font-size:10px">DENEME</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px">TOPLAM</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px">BORÇ</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px">DENEME DAĞILIMI</th>
          </tr>
        </thead>
        <tbody>
          ${schools.sort((a,b) => b.totalCharge - a.totalCharge).map((s,i) => `
            <tr style="${i%2===0?'background:var(--bg)':''}">
              <td style="padding:7px 10px;font-weight:700;color:${s.color||'var(--primary)'}">${s.name.length > 20 ? s.name.slice(0,20)+'…' : s.name}</td>
              <td style="padding:7px 10px;text-align:center;font-weight:700">${s.examCount}</td>
              <td style="padding:7px 10px;text-align:right;font-weight:700">${s.totalCharge.toLocaleString('tr-TR')} ₺</td>
              <td style="padding:7px 10px;text-align:right;font-weight:700;color:${s.debt>0?'var(--danger)':s.debt<0?'var(--info)':'var(--success)'}">${s.debt.toLocaleString('tr-TR')} ₺</td>
              <td style="padding:7px 10px">
                <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
                  <div style="background:${s.color||'var(--primary)'};height:100%;width:${(s.examCount/maxExam*100).toFixed(0)}%;border-radius:4px"></div>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  compare.querySelector('#btnBackFromCompare').addEventListener('click', showSchoolList);
}

function calcSchoolDebt(schoolId) {
  const exams = state.exams.filter(e => e.schoolId === schoolId);
  const payments = state.payments.filter(p => p.schoolId === schoolId);
  const totalCharge = exams.reduce((sum, e) => sum + (Number(e.price)||0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount)||0), 0);
  return totalCharge - totalPaid;
}

async function addPayment(schoolId) {
  const amount = document.getElementById('paymentAmount')?.value;
  const date = document.getElementById('paymentDate')?.value;
  const note = document.getElementById('paymentNote')?.value || '';
  if (!amount || !date) { toast('Tutar ve tarih zorunlu', 'error'); return; }
  state.payments.push({ id: genId(), schoolId, amount: Number(amount), date, note });
  await saveData('payments');
  showSchoolDetail(schoolId);
  toast('💳 Ödeme eklendi', 'success');
}


// ===== REPORTS =====
function renderReports() {
  const content = document.getElementById('reportContent');
  if (!content) return;
  const tab = state.activeReportTab;
  if (tab === 'summary') renderSummaryReport(content);
  else if (tab === 'monthly') renderMonthlyReport(content);
  else if (tab === 'yearly') renderYearlyReport(content);
  else if (tab === 'schools') renderSchoolsReport(content);
  else if (tab === 'period') renderPeriodReport(content);
  else if (tab === 'export') renderExportTab(content);
}

function renderExportTab(content) {
  const totalExams = state.exams.length;
  const totalRevenue = state.exams.reduce((s,e)=>s+Number(e.price||0),0);
  content.innerHTML = `
    <div class="section-title" style="margin-bottom:12px">⬇️ Genel Export</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:14px">
        <div style="font-weight:700;font-size:13px;margin-bottom:4px">📋 Tüm Denemeler</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">${totalExams} deneme • Toplam ${totalRevenue.toLocaleString('tr-TR')} ₺</div>
        <div style="display:flex;gap:8px">
          <button class="btn-secondary" id="btnExportAllPDF" style="font-size:11px">📄 PDF İndir</button>
          <button class="btn-secondary" id="btnExportAllExcel" style="font-size:11px">📊 Excel İndir</button>
        </div>
      </div>
      <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:14px">
        <div style="font-weight:700;font-size:13px;margin-bottom:4px">🏫 Tüm Okullar (Borç Özeti)</div>
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">${state.schools.length} okul</div>
        <div style="display:flex;gap:8px">
          <button class="btn-secondary" id="btnExportAllSchoolsPDF" style="font-size:11px">📄 PDF İndir</button>
        </div>
      </div>
    </div>`;

  document.getElementById('btnExportAllPDF')?.addEventListener('click', exportAllExamsPDF);
  document.getElementById('btnExportAllExcel')?.addEventListener('click', exportAllExamsExcel);
  document.getElementById('btnExportAllSchoolsPDF')?.addEventListener('click', exportAllSchoolsPDF);
}

function exportAllSchoolsPDF() {
  const rows = state.schools.map(s => {
    const debt = calcSchoolDebt(s.id);
    const examCount = state.exams.filter(e=>e.schoolId===s.id).length;
    return `<tr>
      <td style="font-weight:600;color:${s.color||'var(--primary)'}">${s.name}</td>
      <td style="text-align:center">${examCount}</td>
      <td style="text-align:right;font-weight:700;color:${debt>0?'#ef4444':debt<0?'#3b82f6':'#10b981'}">${debt.toLocaleString('tr-TR')} ₺</td>
    </tr>`;
  }).join('');
  const totalDebt = state.schools.reduce((s,sc)=>s+Math.max(0,calcSchoolDebt(sc.id)),0);
  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
  <style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px}
  h1{color:#6c3fff}table{width:100%;border-collapse:collapse;margin-top:16px}
  th{background:#6c3fff;color:white;padding:7px 10px;text-align:left}
  td{padding:6px 10px;border-bottom:1px solid #e5e1ff}tr:nth-child(even)td{background:#f8f7ff}
  @media print{body{padding:12px}}</style></head><body>
  <h1>🏫 Okul Borç Özeti</h1>
  <div style="color:#7c6fa0;font-size:11px;margin-bottom:4px">Tarih: ${new Date().toLocaleDateString('tr-TR')} • Toplam Alacak: ${totalDebt.toLocaleString('tr-TR')} ₺</div>
  <table><thead><tr><th>Okul</th><th style="text-align:center">Deneme</th><th style="text-align:right">Borç</th></tr></thead>
  <tbody>${rows}</tbody></table></body></html>`;
  const w = window.open('','_blank');
  if(!w){toast('Pop-up engellendi','error');return;}
  w.document.write(html); w.document.close();
  setTimeout(()=>w.print(),600);
}

function renderSummaryReport(content) {
  const total = state.exams.length;
  const applied = state.exams.filter(e => e.status === 'applied').length;
  const pending = total - applied;
  const today = new Date(); today.setHours(0,0,0,0);
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);

  const upcoming = state.exams.filter(e => {
    if (!e.applicationDate || e.status === 'applied') return false;
    const d = new Date(e.applicationDate); d.setHours(0,0,0,0);
    return d >= today && d <= in30;
  }).sort((a,b) => a.applicationDate.localeCompare(b.applicationDate));

  const catCounts = {};
  state.exams.forEach(e => {
    const ids = e.categoryIds?.length > 0 ? e.categoryIds : (e.categoryId ? [e.categoryId] : []);
    ids.forEach(id => {
      const c = getCatById(id);
      const name = c?.name || 'Diğer';
      catCounts[name] = { count: (catCounts[name]?.count||0)+1, color: c?.color||'var(--primary)' };
    });
  });
  const maxCat = Math.max(...Object.values(catCounts).map(v => v.count), 1);

  const statusCounts = {};
  STATUS_ORDER.forEach(s => { statusCounts[s] = state.exams.filter(e => (e.status||'ordered') === s).length; });

  content.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Toplam Deneme</div></div>
      <div class="stat-card"><div class="stat-value">${state.schools.length}</div><div class="stat-label">Okul Sayısı</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--success)">${applied}</div><div class="stat-label">Uygulandı</div></div>
      <div class="stat-card"><div class="stat-value" style="color:var(--warning)">${pending}</div><div class="stat-label">Bekleyen</div></div>
    </div>

    <div class="stats-section">
      <div class="section-title">📊 Durum Dağılımı</div>
      ${STATUS_ORDER.map(key => {
        const s = STATUS_CONFIG[key];
        const count = statusCounts[key] || 0;
        const pct = total > 0 ? (count/total*100).toFixed(0) : 0;
        return `<div class="stats-bar-row">
          <span class="stats-bar-label" style="color:${s.color}">${s.short}</span>
          <div class="stats-bar-track"><div class="stats-bar-fill" style="width:${pct}%;background:${s.color}"></div></div>
          <span class="stats-bar-count">${count}</span>
        </div>`;
      }).join('')}
    </div>

    <div class="stats-section">
      <div class="section-title">🗂️ Kategori Dağılımı</div>
      ${Object.entries(catCounts).map(([name, v]) => `
        <div class="stats-bar-row">
          <span class="stats-bar-label">${name}</span>
          <div class="stats-bar-track"><div class="stats-bar-fill" style="width:${(v.count/maxCat*100).toFixed(0)}%;background:${v.color}"></div></div>
          <span class="stats-bar-count">${v.count}</span>
        </div>`).join('')}
    </div>

    ${upcoming.length > 0 ? `
    <div class="stats-section">
      <div class="section-title">⏰ Yaklaşan Uygulamalar (30 gün)</div>
      <div class="upcoming-list">
        ${upcoming.map(e => {
          const days = Math.ceil((new Date(e.applicationDate) - today) / 86400000);
          const sc2 = STATUS_CONFIG[e.status || 'ordered'];
          return `<div class="upcoming-item">
            <div style="flex:1;min-width:0">
              <b>${e.name}</b>
              <span style="font-size:10px;color:${sc2.color};margin-left:5px">${sc2.short}</span>
              ${e.schoolName ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px">${e.schoolName}</span>` : ''}
            </div>
            <span class="upcoming-days">${days === 0 ? 'Bugün!' : days + ' gün'}</span>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}`;
}

function renderMonthlyReport(content) {
  const year = state.currentYear;
  const rows = [];
  for (let m = 0; m < 12; m++) {
    const monthExams = state.exams.filter(e => {
      const d = e.applicationDate || e.stockDate;
      if (!d) return false;
      const dt = new Date(d);
      return dt.getFullYear() === year && dt.getMonth() === m;
    });
    const applied = monthExams.filter(e => e.status === 'applied').length;
    rows.push({ month: MONTHS[m], total: monthExams.length, applied, pending: monthExams.length - applied });
  }

  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div class="section-title">${year} Yılı Aylık Raporu</div>
      <div style="display:flex;gap:8px">
        <button class="btn-xs btn-edit" id="prevReportYear">‹</button>
        <span style="font-weight:700">${year}</span>
        <button class="btn-xs btn-edit" id="nextReportYear">›</button>
      </div>
    </div>
    <table class="month-table">
      <thead><tr>
        <th>Ay</th>
        <th style="text-align:center">Toplam</th>
        <th style="text-align:center">Uygulandı</th>
        <th style="text-align:center">Bekleyen</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => r.total > 0 ? `<tr>
          <td style="font-weight:600">${r.month}</td>
          <td style="text-align:center;font-weight:700">${r.total}</td>
          <td style="text-align:center;color:var(--success);font-weight:700">${r.applied}</td>
          <td style="text-align:center;color:var(--warning);font-weight:700">${r.pending}</td>
        </tr>` : '').join('')}
        <tr style="background:var(--primary-light);font-weight:800">
          <td>TOPLAM</td>
          <td style="text-align:center">${rows.reduce((s,r)=>s+r.total,0)}</td>
          <td style="text-align:center;color:var(--success)">${rows.reduce((s,r)=>s+r.applied,0)}</td>
          <td style="text-align:center;color:var(--warning)">${rows.reduce((s,r)=>s+r.pending,0)}</td>
        </tr>
      </tbody>
    </table>`;

  content.querySelector('#prevReportYear').addEventListener('click', () => {
    state.currentYear--;
    renderMonthlyReport(content);
  });
  content.querySelector('#nextReportYear').addEventListener('click', () => {
    state.currentYear++;
    renderMonthlyReport(content);
  });
}

function renderYearlyReport(content) {
  const years = [...new Set(state.exams.map(e => {
    const d = e.applicationDate || e.stockDate;
    return d ? new Date(d).getFullYear() : null;
  }).filter(Boolean))].sort();

  if (years.length === 0) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">📆</div>Henüz veri yok</div>`;
    return;
  }

  content.innerHTML = `
    <div class="section-title" style="margin-bottom:12px">Yıllık Rapor</div>
    <table class="month-table">
      <thead><tr>
        <th>Yıl</th>
        <th style="text-align:center">Toplam</th>
        <th style="text-align:center">Uygulandı</th>
        <th style="text-align:center">Bekleyen</th>
      </tr></thead>
      <tbody>
        ${years.map(year => {
          const yearExams = state.exams.filter(e => {
            const d = e.applicationDate || e.stockDate;
            return d && new Date(d).getFullYear() === year;
          });
          const applied = yearExams.filter(e => e.status === 'applied').length;
          return `<tr>
            <td style="font-weight:700">${year}</td>
            <td style="text-align:center;font-weight:700">${yearExams.length}</td>
            <td style="text-align:center;color:var(--success);font-weight:700">${applied}</td>
            <td style="text-align:center;color:var(--warning);font-weight:700">${yearExams.length - applied}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

function renderSchoolsReport(content) {
  const schools = state.schools.map(s => {
    const exams = state.exams.filter(e => e.schoolId === s.id);
    const debt = calcSchoolDebt(s.id);
    return { ...s, examCount: exams.length, debt, totalCharge: exams.reduce((sum,e)=>sum+(Number(e.price)||0),0) };
  }).sort((a,b) => b.examCount - a.examCount);

  content.innerHTML = `
    <div class="section-title" style="margin-bottom:12px">Okul Bazlı Rapor</div>
    <table class="month-table">
      <thead><tr>
        <th>Okul</th>
        <th style="text-align:center">Deneme</th>
        <th style="text-align:right">Toplam</th>
        <th style="text-align:right">Borç</th>
      </tr></thead>
      <tbody>
        ${schools.map(s => `<tr>
          <td style="font-weight:600;color:${s.color||'var(--text)'}">${s.name.length>22?s.name.slice(0,22)+'…':s.name}</td>
          <td style="text-align:center;font-weight:700">${s.examCount}</td>
          <td style="text-align:right;font-weight:700">${s.totalCharge.toLocaleString('tr-TR')} ₺</td>
          <td style="text-align:right;font-weight:700;color:${s.debt>0?'var(--danger)':s.debt<0?'var(--info)':'var(--success)'}">${s.debt.toLocaleString('tr-TR')} ₺</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
}


// ===== SETTINGS =====
function renderSettings() {
  renderPeriods();
  renderCategories();
  renderPublisherList();
  renderHistory();

  const nd = document.getElementById('notifyDays');
  const nsd = document.getElementById('notifyStockDays');
  const ab = document.getElementById('autoBackup');
  if (nd) nd.value = state.settings.notifyDaysBefore || 3;
  if (nsd) nsd.value = state.settings.notifyStockDays || 3;
  if (ab) ab.checked = !!state.settings.autoBackup;

  const lastBackup = state.settings.lastBackup;
  const lbi = document.getElementById('lastBackupInfo');
  if (lbi) lbi.textContent = lastBackup ? `Son yedek: ${new Date(lastBackup).toLocaleString('tr-TR')}` : 'Henüz yedek alınmadı.';
}

function renderPeriods() {
  const list = document.getElementById('periodList');
  if (!list) return;
  list.innerHTML = '';
  state.periods.forEach(p => {
    const item = document.createElement('div');
    item.className = 'period-item' + (p.isActive ? ' active-period' : '');
    item.innerHTML = `
      <div style="flex:1">
        <span style="font-weight:700">${p.name}</span>
        ${p.isActive ? '<span class="period-active-badge" style="margin-left:6px">Aktif</span>' : ''}
        <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${p.startDate ? formatDate(p.startDate) : ''} ${p.endDate ? '— ' + formatDate(p.endDate) : ''}</div>
      </div>
      <div style="display:flex;gap:4px">
        <button class="btn-xs btn-edit period-activate" data-id="${p.id}" title="${p.isActive ? 'Aktif' : 'Aktif Yap'}">
          ${p.isActive ? '✅' : '○'}
        </button>
        <button class="btn-xs btn-delete period-delete" data-id="${p.id}">✕</button>
      </div>`;
    item.querySelector('.period-activate').addEventListener('click', async () => {
      state.periods.forEach(x => x.isActive = x.id === p.id);
      await saveData('periods');
      renderPeriods();
      populateFilters();
    });
    item.querySelector('.period-delete').addEventListener('click', async () => {
      state.periods = state.periods.filter(x => x.id !== p.id);
      await saveData('periods');
      renderPeriods();
      populateFilters();
    });
    list.appendChild(item);
  });
}

async function addPeriod() {
  const name = document.getElementById('newPeriodName')?.value.trim();
  const start = document.getElementById('newPeriodStart')?.value;
  const end = document.getElementById('newPeriodEnd')?.value;
  if (!name) return;
  state.periods.push({ id: genId(), name, startDate: start, endDate: end, isActive: state.periods.length === 0 });
  await saveData('periods');
  document.getElementById('newPeriodName').value = '';
  document.getElementById('newPeriodStart').value = '';
  document.getElementById('newPeriodEnd').value = '';
  renderPeriods();
  populateFilters();
  toast('📅 Dönem eklendi', 'success');
}

function renderCategories() {
  const list = document.getElementById('categoryList');
  if (!list) return;
  list.innerHTML = '';
  state.categories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'tag-item';
    item.style.background = cat.color + '22';
    item.style.color = cat.color;
    item.style.borderColor = cat.color + '44';
    item.innerHTML = `${cat.name}${!cat.isDefault ? ` <button class="tag-delete" data-id="${cat.id}">×</button>` : ''}`;
    if (!cat.isDefault) {
      item.querySelector('.tag-delete').addEventListener('click', async () => {
        state.categories = state.categories.filter(c => c.id !== cat.id);
        await saveData('categories');
        renderCategories();
        populateFilters();
      });
    }
    list.appendChild(item);
  });
}

async function addCategory() {
  const name = document.getElementById('newCatName')?.value.trim();
  const color = document.getElementById('newCatColor')?.value || '#6366f1';
  if (!name) return;
  state.categories.push({ id: genId(), name, color });
  await saveData('categories');
  document.getElementById('newCatName').value = '';
  renderCategories();
  populateFilters();
  toast('🗂️ Kategori eklendi', 'success');
}

function renderPublisherList() {
  const container = document.getElementById('publisherList');
  if (!container) return;
  
  // Collapsible header
  const isOpen = container.dataset.open === 'true';
  const total = state.publishers.length;
  
  container.innerHTML = `
    <div class="pub-list-header" id="pubListToggle" style="
      display:flex;align-items:center;justify-content:space-between;
      padding:10px 12px;background:var(--bg);border-radius:var(--radius-sm);
      border:1.5px solid var(--border);cursor:pointer;margin-bottom:6px;
    ">
      <span style="font-weight:700;font-size:13px">📚 ${total} Yayınevi</span>
      <span style="font-size:18px;color:var(--primary)">${isOpen ? '▲' : '▼'}</span>
    </div>
    <div id="pubListItems" style="display:${isOpen ? 'flex' : 'none'};flex-direction:column;gap:6px">
    </div>
  `;
  
  document.getElementById('pubListToggle').addEventListener('click', () => {
    container.dataset.open = isOpen ? 'false' : 'true';
    renderPublisherList();
  });
  
  if (!isOpen) return;
  
  const itemsEl = document.getElementById('pubListItems');

  state.publishers.forEach(pub => {
    const card = document.createElement('div');
    card.className = 'publisher-card';
    card.innerHTML = `
      <div class="publisher-card-header">
        <span class="publisher-name">📚 ${pub.name}</span>
        <div style="display:flex;gap:4px">
          <button class="btn-xs btn-edit pub-edit" data-id="${pub.id}">✏️</button>
          <button class="btn-xs btn-delete pub-del" data-id="${pub.id}">🗑️</button>
        </div>
      </div>
      <div class="publisher-info">
        ${pub.phone ? `📞 ${pub.phone}` : ''} ${pub.email ? `• ✉️ ${pub.email}` : ''}
      </div>`;
    card.querySelector('.pub-del').addEventListener('click', async () => {
      state.publishers = state.publishers.filter(p => p.id !== pub.id);
      await saveData('publishers');
      renderPublisherList();
    });
    card.querySelector('.pub-edit').addEventListener('click', () => openPublisherEditModal(pub.id));
    itemsEl.appendChild(card);
  });
}
