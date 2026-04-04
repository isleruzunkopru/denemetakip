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
  const data = {};
  keys.forEach(k => { try { const v = localStorage.getItem(k); if(v !== null) data[k] = JSON.parse(v); } catch(e){} });
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
  try { localStorage.setItem(key, JSON.stringify(state[key])); } catch(e) {}
}

async function saveAll() {
  const keys = ['exams','schools','categories','payments','publishers','periods','history','settings','catalogItems'];
  keys.forEach(k => {
    try { localStorage.setItem(k, JSON.stringify(state[k])); } catch(e) {}
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
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isTab = !isStandalone && window.outerWidth > 600;
  if (isTab) document.body.classList.add('tab-mode');

  const btn = document.getElementById('btnOpenTab');
  if (btn) btn.addEventListener('click', () => {
    window.open(window.location.href, '_blank');
  });
}

// ===== REAL-TIME SYNC =====
function setupStorageSync() {
  window.addEventListener('storage', (event) => {
    if (!event.key) return;
    const keys = ['exams','schools','categories','payments','publishers','periods','settings'];
    if (!keys.includes(event.key)) return;
    const modalOpen = !document.getElementById('modalOverlay').classList.contains('hidden');
    if (modalOpen) return;
    try {
      if (event.newValue) state[event.key] = JSON.parse(event.newValue);
    } catch(e) {}
    renderAll(); checkAlerts();
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
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      state.activeTab = tab;
      document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${tab}`).classList.add('active');
      if (tab === 'reports') renderReports();
      if (tab === 'schools') { showSchoolList(); }
      if (tab === 'settings') renderSettings();
    });
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
  // badge update skipped in PWA
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
  document.getElementById('btnBulkGcal')?.addEventListener('click', async () => {
    const ids = [...state.selectedExams];
    if (!ids.length) { toast('Deneme seçilmedi', 'error'); return; }
    toast(`📅 ${ids.length} deneme takvime ekleniyor...`, 'default', 3000);
    let ok = 0;
    for (const id of ids) {
      const exam = state.exams.find(e => e.id === id);
      if (exam) {
        exam.gcalAdded = false; // reset so it adds fresh
        const result = await addToGoogleCalendar(exam);
        if (result) ok++;
        await new Promise(r => setTimeout(r, 400));
      }
    }
    cancelBulkMode();
    renderExamList();
    toast(`✅ ${ok} deneme takvime eklendi`, 'success');
  });

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
  document.getElementById('btnTogglePublishers')?.addEventListener('click', () => {
    const body = document.getElementById('publisherBody');
    const btn = document.getElementById('btnTogglePublishers');
    const isOpen = body.style.display !== 'none';
    body.style.display = isOpen ? 'none' : 'block';
    btn.textContent = isOpen ? '▼ Göster' : '▲ Gizle';
    localStorage.setItem('publisherBodyOpen', (!isOpen).toString());
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
  document.getElementById('btnDriveRestore')?.addEventListener('click', driveRestore);
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

  if (state.filterPeriod) exams = exams.filter(e => e.periodId === state.filterPeriod);
  if (state.filterSubtab === 'pending') exams = exams.filter(e => (e.status || 'ordered') !== 'applied');
  else if (state.filterSubtab === 'applied') exams = exams.filter(e => e.status === 'applied');
  if (state.filterCat) exams = exams.filter(e => (e.categoryIds || [e.categoryId]).includes(state.filterCat));
  if (state.filterType) exams = exams.filter(e => e.type === state.filterType);
  if (state.filterPub) exams = exams.filter(e => e.publisherId === state.filterPub);
  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    exams = exams.filter(e =>
      e.name?.toLowerCase().includes(q) || e.schoolName?.toLowerCase().includes(q) ||
      e.categoryNames?.toLowerCase().includes(q) || e.type?.toLowerCase().includes(q) ||
      (e.applicationDate && formatDate(e.applicationDate).includes(q)) ||
      (e.stockDate && formatDate(e.stockDate).includes(q)) ||
      (e.trackingNumber && e.trackingNumber.toLowerCase().includes(q))
    );
  }
  exams.sort((a, b) => {
    const sort = state.filterSort || 'appDate';
    if (sort === 'appDate')       return (a.applicationDate||'').localeCompare(b.applicationDate||'');
    if (sort === 'appDateDesc')   return (b.applicationDate||'').localeCompare(a.applicationDate||'');
    if (sort === 'stockDate')     return (a.stockDate||'').localeCompare(b.stockDate||'');
    if (sort === 'stockDateDesc') return (b.stockDate||'').localeCompare(a.stockDate||'');
    if (sort === 'name')          return (a.name||'').localeCompare(b.name||'', 'tr');
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

  const isTable = list.classList.contains('table-mode');

  if (isTable) {
    list.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:8px;border:1px solid #ddd6fe;';
    const table = document.createElement('table');
    table.className = 'exam-table';
    table.innerHTML = `<thead><tr>
      <th style="width:28px"><input type="checkbox" id="cbSelectAll"></th>
      <th>Deneme Adı</th>
      <th>Okul</th>
      <th>Stok</th>
      <th>Uygulama</th>
      <th>Durum</th>
      <th>İşlem</th>
    </tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');

    exams.forEach(exam => {
      const status = exam.status || 'ordered';
      const sc = STATUS_CONFIG[status] || STATUS_CONFIG.ordered;
      const isApplied = status === 'applied';
      const isSelected = state.selectedExams.has(exam.id);
      const catBadges = (exam.categoryIds?.length > 0 ? exam.categoryIds : (exam.categoryId ? [exam.categoryId] : []))
        .map(id => { const c = getCatById(id); return c ? `<span class="badge" style="background:${c.color}22;color:${c.color};font-size:9px;padding:1px 5px">${c.name}</span>` : ''; }).join('');
      let pubDisplay = '';
      const publisher = state.publishers.find(p => p.id === exam.publisherId);
      if (publisher) pubDisplay = publisher.name.replace(/ KURUMSAL DENEME \d{4}-\d{2,4}$/,'').trim();
      else if (exam.publisherName) pubDisplay = exam.publisherName.replace(/ KURUMSAL DENEME \d{4}-\d{2,4}$/,'').replace(/ YAYINLARI$/,'').trim();
      const statusSteps = STATUS_ORDER.map(key => {
        const s = STATUS_CONFIG[key];
        const isDone = STATUS_ORDER.indexOf(key) < STATUS_ORDER.indexOf(status);
        const isActive = key === status;
        return `<button class="status-step ${isActive?'active':''} ${isDone?'done':''}" data-id="${exam.id}" data-status="${key}" style="--sc:${s.color}" title="${s.label}">${s.short}</button>`;
      }).join('');
      const tr = document.createElement('tr');
      if (isApplied) tr.classList.add('row-applied');
      if (isSelected) tr.classList.add('row-selected');
      const activeStatus = STATUS_CONFIG[status];
      const statusBadge = `<span style="background:${activeStatus.color}22;color:${activeStatus.color};font-size:9px;padding:2px 7px;border-radius:4px;font-weight:600;white-space:nowrap">${activeStatus.label}</span>`;
      tr.innerHTML = `
        <td class="td-cb"><input type="checkbox" class="exam-select-cb" ${isSelected?'checked':''} data-id="${exam.id}"></td>
        <td class="td-name">
          <div class="et-name">${exam.name}</div>
          <div style="display:flex;gap:2px;flex-wrap:wrap;margin-top:2px">${catBadges}${exam.type ? `<span class="badge badge-type-${exam.type.toLowerCase()}" style="font-size:9px;padding:1px 5px">${exam.type}</span>` : ''}</div>
          ${pubDisplay ? `<div class="et-pub">📚 ${pubDisplay}</div>` : ''}
        </td>
        <td class="td-school">${exam.schoolName || '<span class="et-empty">—</span>'}</td>
        <td class="td-stock">${exam.stockDate ? formatDate(exam.stockDate) : '<span class="et-empty">—</span>'}</td>
        <td class="td-app">${exam.applicationDate ? formatDate(exam.applicationDate) : '<span class="et-empty">—</span>'}</td>
        <td class="td-status">${statusBadge}<div style="margin-top:3px"><div class="status-steps">${statusSteps}</div></div></td>
        <td class="td-actions">
          <button class="btn-xs btn-edit" data-id="${exam.id}" title="Düzenle">✏️</button>
          <button class="btn-xs btn-copy" data-id="${exam.id}" title="Kopyala">📋</button>
          <button class="btn-xs btn-note" data-id="${exam.id}" title="Not">📝</button>
          <button class="btn-xs btn-result" data-id="${exam.id}" title="Sonuç" style="${exam.result?'background:#d1fae5;color:#065f46':''}">📊</button>
          <button class="btn-xs btn-gcal" data-id="${exam.id}" title="Takvim" style="${exam.gcalAdded?'background:#dcfce7;color:#166534':''}">📅</button>
          <button class="btn-xs btn-delete" data-id="${exam.id}" title="Sil">🗑️</button>
        </td>`;
      tbody.appendChild(tr);
    });

    wrapper.appendChild(table);
    list.appendChild(wrapper);

    table.querySelector('#cbSelectAll')?.addEventListener('change', (e) => {
      table.querySelectorAll('.exam-select-cb').forEach(cb => {
        cb.checked = e.target.checked;
        const id = cb.dataset.id;
        if (e.target.checked) { state.selectedExams.add(id); state.bulkMode = true; }
        else state.selectedExams.delete(id);
      });
      if (!e.target.checked) state.bulkMode = false;
      renderExamList();
    });
    table.querySelectorAll('.exam-select-cb').forEach(cb => {
      cb.addEventListener('click', e => {
        e.stopPropagation();
        const id = cb.dataset.id;
        if (cb.checked) { state.selectedExams.add(id); state.bulkMode = true; }
        else { state.selectedExams.delete(id); if (state.selectedExams.size === 0) state.bulkMode = false; }
        renderExamList();
      });
    });
    table.querySelectorAll('.status-step').forEach(btn => btn.addEventListener('click', () => setExamStatus(btn.dataset.id, btn.dataset.status)));
    table.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => openExamModal(btn.dataset.id)));
    table.querySelectorAll('.btn-copy').forEach(btn => btn.addEventListener('click', () => copyExam(btn.dataset.id)));
    table.querySelectorAll('.btn-note').forEach(btn => btn.addEventListener('click', () => openNotesModal(btn.dataset.id)));
    table.querySelectorAll('.btn-result').forEach(btn => btn.addEventListener('click', () => openExamResultModal(btn.dataset.id)));
    table.querySelectorAll('.btn-gcal').forEach(btn => btn.addEventListener('click', () => addSingleToGCal(btn.dataset.id)));
    table.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => deleteExam(btn.dataset.id)));
    return;
  }

  // ===== CARD VIEW =====
  list.innerHTML = '';
  exams.forEach(exam => {
    const catBadges = (exam.categoryIds?.length > 0 ? exam.categoryIds : (exam.categoryId ? [exam.categoryId] : []))
      .map(id => { const c = getCatById(id); return c ? `<span class="badge" style="background:${c.color}22;color:${c.color}">${c.name}</span>` : ''; }).join('');
    const status = exam.status || 'ordered';
    const sc = STATUS_CONFIG[status] || STATUS_CONFIG.ordered;
    const isApplied = status === 'applied';
    const isSelected = state.selectedExams.has(exam.id);
    const card = document.createElement('div');
    card.className = 'exam-card' + (isApplied ? ' exam-applied' : '') + (isSelected ? ' selected' : '');
    card.style.borderLeftColor = sc.color;
    const notesHtml = exam.notes?.length > 0 ? `<div class="exam-notes-preview">📝 ${exam.notes[exam.notes.length-1].text}</div>` : '';
    const trackingHtml = exam.trackingNumber ? `<span class="exam-meta-item"><a class="tracking-link" href="https://www.ptt.gov.tr/tr/bireysel/gonderi-takip#${exam.trackingNumber}" target="_blank">📮 ${exam.trackingNumber}</a></span>` : '';
    const period = state.periods.find(p => p.id === exam.periodId);
    const periodBadge = period ? `<span class="badge" style="background:#f0fdf4;color:#166534;font-size:9px">${period.name}</span>` : '';
    const publisher = state.publishers.find(p => p.id === exam.publisherId);
    let pubDisplay = '';
    if (publisher) pubDisplay = publisher.short && publisher.short !== publisher.name ? publisher.short : publisher.name;
    else if (exam.publisherName) pubDisplay = exam.publisherName.replace(/ KURUMSAL DENEME \d{4}-\d{2,4}$/,'').replace(/ YAYINLARI$/,'').replace(/ YAYINLARI KURUMSAL.*$/,'').trim();
    else if (exam.catalogItemId) { const ci = state.catalogItems.find(i => i.id === exam.catalogItemId); if (ci?.publisherName) pubDisplay = ci.publisherName.replace(/ KURUMSAL DENEME \d{4}-\d{2,4}$/,'').replace(/ YAYINLARI$/,'').trim(); }
    const pubBadge = pubDisplay ? `<span style="font-size:10px;color:var(--text-muted);font-weight:600">📚 ${pubDisplay}</span>` : '';

    card.innerHTML = `
      <div class="exam-card-header">
        <div class="exam-card-header-left">
          <input type="checkbox" class="exam-select-cb" ${isSelected ? 'checked' : ''} data-id="${exam.id}">
          <div style="min-width:0"><span class="exam-name">${exam.name}</span>${pubBadge}</div>
        </div>
        <div class="exam-badges">${catBadges}${exam.type ? `<span class="badge badge-type-${exam.type.toLowerCase()}">${exam.type}</span>` : ''}${periodBadge}</div>
      </div>
      <div class="exam-card-meta">
        ${exam.schoolName ? `<span class="exam-meta-item">🏫 ${exam.schoolName}</span>` : ''}
        ${exam.stockDate ? `<span class="exam-meta-item">📦 Stok: ${formatDate(exam.stockDate)}</span>` : ''}
        ${exam.applicationDate ? `<span class="exam-meta-item">🎯 Uygulama: ${formatDate(exam.applicationDate)}</span>` : ''}
        ${exam.price ? `<span class="exam-meta-item">💰 ${exam.qty ? exam.qty + ' × ' + Number(exam.unitPrice).toLocaleString('tr-TR') + ' ₺ = ' : ''}${Number(exam.price).toLocaleString('tr-TR')} ₺</span>` : ''}
        ${trackingHtml}
      </div>
      ${(exam.categoryBreakdown && Object.keys(exam.categoryBreakdown).length > 1) ? `<div class="exam-cat-breakdown">${Object.entries(exam.categoryBreakdown).map(([id, qty]) => { const c = getCatById(id); return c ? `<span class="exam-cat-breakdown-chip" style="background:${c.color}18;color:${c.color};border:1px solid ${c.color}33">${c.name}: <b>${qty}</b></span>` : ''; }).join('')}<span class="exam-cat-breakdown-chip" style="background:var(--primary-light);color:var(--primary);font-weight:800">Toplam: ${Object.values(exam.categoryBreakdown).reduce((s,v)=>s+v,0)}</span></div>` : ''}
      ${notesHtml}
      <div class="exam-status-row"><div class="status-steps">${STATUS_ORDER.map(key => { const s = STATUS_CONFIG[key]; const isDone = STATUS_ORDER.indexOf(key) < STATUS_ORDER.indexOf(status); const isActive = key === status; return `<button class="status-step ${isActive?'active':''} ${isDone?'done':''}" data-id="${exam.id}" data-status="${key}" style="--sc:${s.color}" title="${s.label}">${s.short}</button>`; }).join('')}</div></div>
      <div class="exam-card-actions">
        <button class="btn-xs btn-edit" data-id="${exam.id}">✏️</button>
        <button class="btn-xs btn-copy" data-id="${exam.id}" title="Kopyala">📋</button>
        <button class="btn-xs btn-note" data-id="${exam.id}" title="Not Ekle">📝</button>
        <button class="btn-xs btn-result" data-id="${exam.id}" style="${exam.result?'background:#d1fae5;color:#065f46':''}">${exam.result ? '📊 Sonuç' : '📊'}</button>
        <button class="btn-xs btn-gcal" data-id="${exam.id}" style="${exam.gcalAdded?'background:#dcfce7;color:#166534':''}">${exam.gcalAdded ? '✅ Takvim' : '📅 Takvim'}</button>
        <button class="btn-xs btn-delete" data-id="${exam.id}">🗑️</button>
      </div>`;
    list.appendChild(card);
  });

  list.querySelectorAll('.exam-select-cb').forEach(cb => {
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = cb.dataset.id;
      if (cb.checked) { state.selectedExams.add(id); state.bulkMode = true; }
      else { state.selectedExams.delete(id); if (state.selectedExams.size === 0) state.bulkMode = false; }
      renderExamList();
    });
  });
  list.querySelectorAll('.status-step').forEach(btn => btn.addEventListener('click', () => setExamStatus(btn.dataset.id, btn.dataset.status)));
  list.querySelectorAll('.btn-edit').forEach(btn => btn.addEventListener('click', () => openExamModal(btn.dataset.id)));
  list.querySelectorAll('.btn-copy').forEach(btn => btn.addEventListener('click', () => copyExam(btn.dataset.id)));
  list.querySelectorAll('.btn-note').forEach(btn => btn.addEventListener('click', () => openNotesModal(btn.dataset.id)));
  list.querySelectorAll('.btn-result').forEach(btn => btn.addEventListener('click', () => openExamResultModal(btn.dataset.id)));
  list.querySelectorAll('.btn-gcal').forEach(btn => btn.addEventListener('click', () => addSingleToGCal(btn.dataset.id)));
  list.querySelectorAll('.btn-delete').forEach(btn => btn.addEventListener('click', () => deleteExam(btn.dataset.id)));

  const bulkBtns = document.getElementById('bulkStatusBtns');
  if (bulkBtns) {
    bulkBtns.innerHTML = '';
    STATUS_ORDER.forEach(key => {
      if (key === 'applied') return;
      const s = STATUS_CONFIG[key];
      const btn = document.createElement('button');
      btn.className = 'btn-xs';
      btn.style.background = s.color; btn.style.color = 'white';
      btn.textContent = s.label;
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

  const portalUrl = `${window.location.href.replace('index.html','').replace(/\/$/, '') + '/portal.html'}?token=${school.portalToken}`;

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

  // Add toggle button to publisher section if not already there
  const pubList = document.getElementById('publisherList');
  if (pubList) {
    const section = pubList.closest('.settings-section');
    if (section && !section.querySelector('#btnTogglePublishers')) {
      const title = section.querySelector('.section-title');
      if (title) {
        title.style.display = 'flex';
        title.style.alignItems = 'center';
        title.style.justifyContent = 'space-between';
        // Check saved state - default hidden
        const savedOpen = localStorage.getItem('publisherBodyOpen') === 'true';
        // Get or create publisher body wrapper
        let pubBody = document.getElementById('publisherBody');
        if (!pubBody) {
          pubBody = document.createElement('div');
          pubBody.id = 'publisherBody';
          pubList.parentNode.insertBefore(pubBody, pubList);
          pubBody.appendChild(pubList);
          const addRow = document.getElementById('addPublisherRow');
          const addBtn = document.getElementById('btnAddPublisher');
          if (addRow) pubBody.appendChild(addRow);
          if (addBtn) pubBody.appendChild(addBtn);
        }
        pubBody.style.display = savedOpen ? 'block' : 'none';
        const btn = document.createElement('button');
        btn.id = 'btnTogglePublishers';
        btn.className = 'btn-xs btn-secondary';
        btn.textContent = savedOpen ? '▲ Gizle' : '▼ Göster';
        btn.style.fontSize = '11px';
        btn.addEventListener('click', () => {
          const isOpen = pubBody.style.display !== 'none';
          pubBody.style.display = isOpen ? 'none' : 'block';
          btn.textContent = isOpen ? '▼ Göster' : '▲ Gizle';
          localStorage.setItem('publisherBodyOpen', (!isOpen).toString());
        });
        title.appendChild(btn);
      }
    }
  }

  const nd = document.getElementById('notifyDays');
  const nsd = document.getElementById('notifyStockDays');
  const ab = document.getElementById('autoBackup');
  if (nd) nd.value = state.settings.notifyDaysBefore || 3;
  if (nsd) nsd.value = state.settings.notifyStockDays || 3;
  if (ab) ab.checked = !!state.settings.autoBackup;

  const lastBackup = state.settings.lastBackup;
  const lbi = document.getElementById('lastBackupInfo');
  if (lbi) {
    const email = localStorage.getItem('gDriveEmail');
    const lastBackupText = lastBackup ? `Son yedek: ${new Date(lastBackup).toLocaleString('tr-TR')}` : 'Henüz yedek alınmadı.';
    const emailText = email ? `☑️ Bağlı hesap: ${email}` : '⚪ Drive hesabı bağlı değil';
    lbi.innerHTML = `<div>${emailText} ${email ? `<button onclick="localStorage.removeItem('gDriveEmail');renderSettings();" style="font-size:10px;color:red;background:none;border:none;cursor:pointer">Çıkış</button>` : ''}</div><div>${lastBackupText}</div>`;
  }
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
  container.innerHTML = '';
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
    container.appendChild(card);
  });
}

function openPublisherEditModal(pubId) {
  const pub = state.publishers.find(p => p.id === pubId);
  if (!pub) return;
  const html = `
    <div class="modal-title">✏️ Yayıncı Düzenle <button class="modal-close" id="closeModal">×</button></div>
    <div class="form-group"><label class="form-label">Yayıncı Adı</label>
      <input type="text" id="epName" class="form-input" value="${pub.name}"></div>
    <div class="form-group"><label class="form-label">Telefon</label>
      <input type="tel" id="epPhone" class="form-input" value="${pub.phone||''}"></div>
    <div class="form-group"><label class="form-label">E-posta</label>
      <input type="email" id="epEmail" class="form-input" value="${pub.email||''}"></div>
    <div class="form-group"><label class="form-label">Web Sitesi</label>
      <input type="url" id="epWeb" class="form-input" value="${pub.website||''}"></div>
    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">İptal</button>
      <button class="btn-primary" id="savePublisherEdit">💾 Kaydet</button>
    </div>`;
  openModal(html);
  document.getElementById('savePublisherEdit').addEventListener('click', async () => {
    const idx = state.publishers.findIndex(p => p.id === pubId);
    if (idx !== -1) {
      state.publishers[idx] = {
        ...state.publishers[idx],
        name: document.getElementById('epName').value.trim(),
        phone: document.getElementById('epPhone').value.trim(),
        email: document.getElementById('epEmail').value.trim(),
        website: document.getElementById('epWeb').value.trim(),
      };
      await saveData('publishers');
      closeModal();
      renderPublisherList();
      toast('📚 Yayıncı güncellendi', 'success');
    }
  });
}

async function savePublisher() {
  const name = document.getElementById('newPubName')?.value.trim();
  const phone = document.getElementById('newPubPhone')?.value.trim();
  const email = document.getElementById('newPubEmail')?.value.trim();
  if (!name) return;
  state.publishers.push({ id: genId(), name, phone, email });
  await saveData('publishers');
  document.getElementById('newPubName').value = '';
  document.getElementById('newPubPhone').value = '';
  document.getElementById('newPubEmail').value = '';
  document.getElementById('addPublisherRow').style.display = 'none';
  document.getElementById('btnAddPublisher').style.display = '';
  renderPublisherList();
  toast('📚 Yayıncı eklendi', 'success');
}

async function saveSettings() {
  state.settings.notifyDaysBefore = Number(document.getElementById('notifyDays')?.value || 3);
  state.settings.notifyStockDays = Number(document.getElementById('notifyStockDays')?.value || 3);
  state.settings.autoBackup = document.getElementById('autoBackup')?.checked || false;
  await saveData('settings');
  toast('⚙️ Ayarlar kaydedildi', 'success');
  triggerBadgeUpdate();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  if (!state.history.length) {
    list.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:8px">Henüz işlem yok</div>';
    return;
  }
  list.innerHTML = '';
  state.history.slice(0, 10).forEach((entry, i) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    const time = new Date(entry.timestamp);
    item.innerHTML = `
      <span class="history-desc">${entry.description}</span>
      <span class="history-time">${time.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})}</span>
      ${i === 0 ? `<button class="btn-xs btn-undo" id="undoBtn">↩️</button>` : ''}`;
    if (i === 0) item.querySelector('#undoBtn').addEventListener('click', undoLast);
    list.appendChild(item);
  });
}

// ===== FILTERS =====
function populateFilters() {
  // Category filter
  const sel = document.getElementById('filterCat');
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">Tüm Kategoriler</option>';
    state.categories.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      if (c.id === cur) o.selected = true;
      sel.appendChild(o);
    });
  }

  // Period filter
  const psel = document.getElementById('filterPeriod');
  if (psel) {
    const cur = psel.value;
    psel.innerHTML = '<option value="">Tüm Dönemler</option>';
    state.periods.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.name;
      if (p.id === cur) o.selected = true;
      psel.appendChild(o);
    });
  }

  // Calendar legend: add school colors
  const legend = document.getElementById('calendarLegend');
  if (legend) {
    const schoolsWithColor = state.schools.filter(s => s.color);
    if (schoolsWithColor.length > 0) {
      const extra = schoolsWithColor.slice(0, 4).map(s =>
        `<span class="legend-item"><span class="dot" style="background:${s.color}"></span>${s.name.slice(0,10)}</span>`
      ).join('');
      legend.innerHTML = `
        <span class="legend-item"><span class="dot dot-stock"></span>Stok</span>
        <span class="legend-item"><span class="dot dot-app"></span>Uygulama</span>
        ${extra}`;
    }
  }

  // Publisher filter
  const pubSel = document.getElementById('filterPub');
  if (pubSel) {
    const curPub = pubSel.value;
    // Only show publishers that have exams in the list
    const usedPubIds = new Set(state.exams.map(e => e.publisherId).filter(Boolean));
    pubSel.innerHTML = '<option value="">Tüm Yayınevleri</option>';
    state.publishers
      .filter(p => usedPubIds.has(p.id))
      .sort((a, b) => trNorm(a.short || a.name).localeCompare(trNorm(b.short || b.name)))
      .forEach(p => {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.short && p.short !== p.name ? p.short : p.name;
        if (p.id === curPub) o.selected = true;
        pubSel.appendChild(o);
      });
  }

  // Calendar school filter
  const calSchoolSel = document.getElementById('calFilterSchool');
  if (calSchoolSel) {
    const cur = calSchoolSel.value;
    calSchoolSel.innerHTML = '<option value="">Tüm Okullar</option>';
    [...state.schools]
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
      .forEach(s => {
        const o = document.createElement('option');
        o.value = s.id;
        o.textContent = s.name;
        if (s.id === cur) o.selected = true;
        calSchoolSel.appendChild(o);
      });
  }

  // Catalog filter
  populateCatalogFilter();
}


// ===== SCHOOL MODAL =====
function openSchoolModal(schoolId = null) {
  const school = schoolId ? state.schools.find(s => s.id === schoolId) : null;
  const sc = school?.studentCounts || {};
  const contacts = school?.contacts || [];

  const CLASS_KEYS = [
    { id: 'S5', label: '5. Sınıf' }, { id: 'S6', label: '6. Sınıf' },
    { id: 'S7', label: '7. Sınıf' }, { id: 'S8', label: '8. Sınıf' },
    { id: 'S9', label: '9. Sınıf' }, { id: 'S10', label: '10. Sınıf' },
    { id: 'S11', label: '11. Sınıf' }, { id: 'S12', label: '12. Sınıf' },
    { id: 'TYT', label: 'TYT' }, { id: 'AYT', label: 'AYT' }
  ];

  const contactsHtml = contacts.map((c, i) => `
    <div class="contact-form-row" data-idx="${i}" style="background:var(--bg);border-radius:8px;padding:8px;margin-bottom:6px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:4px">
        <input type="text" class="input-sm c-name" data-idx="${i}" placeholder="Ad Soyad" value="${c.name||''}">
        <input type="text" class="input-sm c-role" data-idx="${i}" placeholder="Görev (Müdür, ...)" value="${c.role||''}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px">
        <input type="tel" class="input-sm c-phone" data-idx="${i}" placeholder="Telefon" value="${c.phone||''}">
        <input type="email" class="input-sm c-email" data-idx="${i}" placeholder="E-posta" value="${c.email||''}">
        <button class="btn-xs btn-delete c-remove" data-idx="${i}">✕</button>
      </div>
    </div>`).join('');

  const html = `
    <div class="modal-title">${school ? '✏️ Okul Düzenle' : '🏫 Yeni Okul Ekle'} <button class="modal-close" id="closeModal">×</button></div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Okul Adı</label>
        <input type="text" id="schoolName" class="form-input" value="${school?.name||''}">
      </div>
      <div class="form-group">
        <label class="form-label">Renk (Takvim)</label>
        <input type="color" id="schoolColor" value="${school?.color || getNextSchoolColor()}" style="height:42px;width:100%;border-radius:8px;border:1.5px solid var(--border);cursor:pointer">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">👨‍🎓 Sınıf Bazında Öğrenci Sayıları</label>
      <div class="student-counts-grid">
        ${CLASS_KEYS.map(k => `
          <div class="student-count-row">
            <label class="student-count-label">${k.label}</label>
            <input type="number" class="input-sm student-count-input" data-key="${k.id}" min="0" placeholder="0" value="${sc[k.id]||''}">
          </div>`).join('')}
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">👤 Yetkililer</label>
      <div id="contactFormList">${contactsHtml}</div>
      <button class="btn-secondary" id="btnAddContact" style="margin-top:6px;width:100%;font-size:11px">+ Yetkili Ekle</button>
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">İptal</button>
      <button class="btn-primary" id="saveSchool">💾 Kaydet</button>
    </div>`;

  openModal(html);

  // Remove contact
  document.querySelectorAll('.c-remove').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.contact-form-row').remove());
  });

  // Add contact
  document.getElementById('btnAddContact').addEventListener('click', () => {
    const list = document.getElementById('contactFormList');
    const idx = list.children.length;
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="contact-form-row" data-idx="${idx}" style="background:var(--bg);border-radius:8px;padding:8px;margin-bottom:6px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:4px">
          <input type="text" class="input-sm c-name" placeholder="Ad Soyad">
          <input type="text" class="input-sm c-role" placeholder="Görev">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr auto;gap:6px">
          <input type="tel" class="input-sm c-phone" placeholder="Telefon">
          <input type="email" class="input-sm c-email" placeholder="E-posta">
          <button class="btn-xs btn-delete c-remove">✕</button>
        </div>
      </div>`;
    list.appendChild(div.firstElementChild);
    list.querySelector('.c-remove:last-of-type').addEventListener('click', e => e.target.closest('.contact-form-row').remove());
  });

  document.getElementById('saveSchool').addEventListener('click', async () => {
    const name = document.getElementById('schoolName').value.trim();
    if (!name) { toast('Okul adı zorunlu', 'error'); return; }
    const color = document.getElementById('schoolColor').value;

    const studentCounts = {};
    document.querySelectorAll('.student-count-input').forEach(inp => {
      if (inp.value) studentCounts[inp.dataset.key] = Number(inp.value);
    });

    const contacts = [...document.querySelectorAll('.contact-form-row')].map(row => ({
      id: genId(),
      name: row.querySelector('.c-name')?.value.trim() || '',
      role: row.querySelector('.c-role')?.value.trim() || '',
      phone: row.querySelector('.c-phone')?.value.trim() || '',
      email: row.querySelector('.c-email')?.value.trim() || '',
    })).filter(c => c.name);

    if (school) {
      const idx = state.schools.findIndex(s => s.id === school.id);
      const oldCounts = state.schools[idx].studentCounts || {};
      state.schools[idx] = { ...state.schools[idx], name, color, studentCounts, contacts };

      // Sync exam quantities for this school if student counts changed
      let examUpdated = false;
      state.exams.forEach((exam, i) => {
        if (exam.schoolId !== school.id) return;
        const catIds = exam.categoryIds?.length > 0 ? exam.categoryIds : (exam.categoryId ? [exam.categoryId] : []);
        // Build new breakdown from updated counts
        const newBreakdown = {};
        catIds.forEach(id => {
          if (studentCounts[id] > 0) newBreakdown[id] = studentCounts[id];
        });
        const newTotal = Object.values(newBreakdown).reduce((s, v) => s + v, 0);
        if (newTotal > 0) {
          state.exams[i] = { ...state.exams[i], qty: newTotal, categoryBreakdown: newBreakdown,
            price: newTotal && exam.unitPrice ? newTotal * exam.unitPrice : exam.price };
          examUpdated = true;
        }
      });
      if (examUpdated) await saveData('exams');
    } else {
      state.schools.push({ id: genId(), name, color, studentCounts, contacts, portalToken: genId()+genId() });
    }
    await saveData('schools');
    closeModal();
    if (state.viewingSchool === schoolId) showSchoolDetail(schoolId);
    else showSchoolList();
    populateFilters();
    renderExamList();
    const updatedCount = school ? state.exams.filter(e => e.schoolId === school.id).length : 0;
    toast(`🏫 Okul ${school ? 'güncellendi' : 'eklendi'}${updatedCount > 0 ? ` — ${updatedCount} denemenin adedi güncellendi` : ''}`, 'success');
  });
}


// ===== EXAM MODAL (Combined: Single / Bulk-School / Multi-Exam) =====
function openExamModal(examId = null) {
  // Edit existing exam
  const exam = examId ? state.exams.find(e => e.id === examId) : null;

  const catCheckboxes = state.categories.map(c =>
    `<label class="cat-checkbox-item" style="--cat-color:${c.color}">
      <input type="checkbox" class="cat-cb" value="${c.id}" data-name="${c.name}" data-color="${c.color}" ${exam?.categoryIds?.includes(c.id) ? 'checked' : ''}>
      <span class="cat-cb-label">${c.name}</span>
    </label>`).join('');

  const schoolOptions = state.schools.map(s =>
    `<option value="${s.id}" ${exam?.schoolId === s.id ? 'selected' : ''}>${s.name}</option>`).join('');

  const periodOptions = state.periods.map(p =>
    `<option value="${p.id}" ${exam?.periodId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');

  // Find publisher: by ID first, then by stored publisherName
  let resolvedPubId = exam?.publisherId || '';
  if (!resolvedPubId && exam?.publisherName) {
    const norm = s => s.toUpperCase().replace(/İ/g,'I').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ş/g,'S').replace(/Ö/g,'O').replace(/Ç/g,'C').trim();
    const n = norm(exam.publisherName);
    const matchedPub = state.publishers.find(p =>
      norm(p.name) === n || norm(p.name).includes(n) || n.includes(norm(p.name))
    );
    if (matchedPub) resolvedPubId = matchedPub.id;
  }

  const publisherOptions = state.publishers.map(p =>
    `<option value="${p.id}" data-name="${p.name}" ${p.id === resolvedPubId ? 'selected' : ''}>${p.name}</option>`).join('');

  const typeActive = (t) => exam?.type === t ? `active-${t.toLowerCase()}` : '';

  const html = `
    <div class="modal-title">${exam ? '✏️ Deneme Düzenle' : '➕ Deneme Ekle'} <button class="modal-close" id="closeModal">×</button></div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">📚 Yayıncı</label>
        <select id="cPublisher" class="form-select">
          <option value="">Seçin...</option>${publisherOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">🔢 Deneme No</label>
        <input type="number" id="cExamNo" class="form-input" placeholder="1,2,3..." min="1" value="${exam?.examNo||''}">
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Deneme Adı</label>
      <input type="text" id="cName" class="form-input" placeholder="Deneme adı..." value="${exam?.name||''}">
    </div>

    <div class="form-group">
      <label class="form-label">Kategori <span style="font-weight:400;font-size:10px;color:var(--text-muted)">(birden fazla seçilebilir)</span></label>
      <div class="cat-checkboxes">${catCheckboxes}</div>
    </div>

    <div class="form-group">
      <label class="form-label">Deneme Türü</label>
      <div class="type-selector">
        <button class="type-btn ${typeActive('Tarama')}" data-type="Tarama">📋 Tarama</button>
        <button class="type-btn ${typeActive('Genel')}" data-type="Genel">📘 Genel</button>
        <button class="type-btn ${typeActive('TG')}" data-type="TG">⭐ TG</button>
      </div>
      <input type="hidden" id="cType" value="${exam?.type||''}">
    </div>

    <div class="form-group">
      <label class="form-label">💰 Fiyat</label>
      <div class="price-calc-row">
        <div class="price-calc-field">
          <span class="price-calc-label">Adet</span>
          <input type="number" id="cQty" class="form-input" placeholder="0" min="1" value="${exam?.qty||''}">
        </div>
        <span class="price-calc-times">×</span>
        <div class="price-calc-field">
          <span class="price-calc-label">Birim ₺</span>
          <input type="number" id="cUnitPrice" class="form-input" placeholder="0" value="${exam?.unitPrice||''}">
        </div>
        <span class="price-calc-times">=</span>
        <div class="price-calc-field">
          <span class="price-calc-label">Toplam</span>
          <div id="cPriceTotal" class="price-total-display">${exam?.price ? Number(exam.price).toLocaleString('tr-TR') + ' ₺' : '—'}</div>
        </div>
      </div>
      <input type="hidden" id="cPrice" value="${exam?.price||0}">
    </div>

    <div class="form-group">
      <label class="form-label">Okul</label>
      <select id="cSchool" class="form-select">
        <option value="">Okul seçin...</option>${schoolOptions}
      </select>
      <input type="text" id="cSchoolNew" class="form-input" placeholder="Yeni okul adı yazın..." style="margin-top:6px;display:none">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">📦 Stok Tarihi</label>
        <input type="date" id="cStock" class="form-input" value="${exam?.stockDate||''}">
      </div>
      <div class="form-group">
        <label class="form-label">🎯 Uygulama Tarihi</label>
        <input type="date" id="cApp" class="form-input" value="${exam?.applicationDate||''}">
      </div>
    </div>

    ${state.periods.length > 0 ? `
    <div class="form-group">
      <label class="form-label">🗓️ Dönem</label>
      <select id="cPeriod" class="form-select">
        <option value="">Dönem seçin...</option>${periodOptions}
      </select>
    </div>` : ''}

    <div class="form-group">
      <label class="form-label">📮 Kargo Takip Numarası</label>
      <input type="text" id="cTracking" class="form-input" placeholder="Takip numarası..." value="${exam?.trackingNumber||''}">
    </div>

    <label class="gcal-toggle">
      <input type="checkbox" id="cGcal" ${!exam ? 'checked' : ''}> Google Takvim'e ekle
    </label>

    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">İptal</button>
      <button class="btn-primary" id="saveExamBtn">💾 ${exam ? 'Güncelle' : 'Kaydet'}</button>
    </div>`;

  openModal(html);

  // Type buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.className = 'type-btn');
      btn.classList.add(`active-${btn.dataset.type.toLowerCase()}`);
      document.getElementById('cType').value = btn.dataset.type;
    });
  });

  // Auto-fill name from publisher + number
  function autoFillName() {
    const sel = document.getElementById('cPublisher');
    const pubName = sel.options[sel.selectedIndex]?.dataset?.name || '';
    const no = document.getElementById('cExamNo').value;
    if (pubName && !exam) {
      document.getElementById('cName').value = no ? `${pubName} - ${no}` : pubName;
    }
  }
  document.getElementById('cPublisher').addEventListener('change', autoFillName);
  document.getElementById('cExamNo').addEventListener('input', autoFillName);

  // Price calc
  function updatePrice() {
    const qty = parseFloat(document.getElementById('cQty').value) || 0;
    const unit = parseFloat(document.getElementById('cUnitPrice').value) || 0;
    const total = qty * unit;
    document.getElementById('cPrice').value = total;
    const el = document.getElementById('cPriceTotal');
    el.textContent = total > 0 ? total.toLocaleString('tr-TR') + ' ₺' : '—';
    el.style.color = total > 0 ? 'var(--primary)' : 'var(--text-muted)';
  }
  document.getElementById('cQty').addEventListener('input', updatePrice);
  document.getElementById('cUnitPrice').addEventListener('input', updatePrice);

  // School auto-fill qty
  function autoFillQty() {
    const schoolId = document.getElementById('cSchool').value;
    if (!schoolId) return;
    const school = state.schools.find(s => s.id === schoolId);
    if (!school?.studentCounts) return;
    const selCats = [...document.querySelectorAll('.cat-cb:checked')].map(c => c.value);
    const total = selCats.reduce((sum, id) => sum + (school.studentCounts[id]||0), 0);
    if (total > 0) { document.getElementById('cQty').value = total; updatePrice(); }
  }
  document.getElementById('cSchool').addEventListener('change', e => {
    document.getElementById('cSchoolNew').style.display = e.target.value === '' ? 'block' : 'none';
    autoFillQty();
  });
  document.querySelectorAll('.cat-cb').forEach(cb => cb.addEventListener('change', autoFillQty));

  // Save
  document.getElementById('saveExamBtn').addEventListener('click', async () => {
    const name = document.getElementById('cName').value.trim();
    if (!name) { toast('Deneme adı zorunlu', 'error'); return; }

    const selectedCats = [...document.querySelectorAll('.cat-cb:checked')].map(cb => ({ id: cb.value, name: cb.dataset.name, color: cb.dataset.color }));
    const type = document.getElementById('cType').value;
    const price = Number(document.getElementById('cPrice').value) || 0;
    const qty = Number(document.getElementById('cQty').value) || null;
    const unitPrice = Number(document.getElementById('cUnitPrice').value) || null;
    const stockDate = document.getElementById('cStock').value;
    const applicationDate = document.getElementById('cApp').value;
    const addToGcal = document.getElementById('cGcal').checked;
    const publisherId = document.getElementById('cPublisher').value;
    const publisherName = state.publishers.find(p => p.id === publisherId)?.name || exam?.publisherName || '';
    const examNo = document.getElementById('cExamNo').value;
    const trackingNumber = document.getElementById('cTracking').value.trim();
    const periodId = document.getElementById('cPeriod')?.value || '';

    let schoolId = document.getElementById('cSchool').value;
    let schoolName = '';
    if (!schoolId) {
      const newName = document.getElementById('cSchoolNew').value.trim();
      if (newName) {
        const ns = { id: genId(), name: newName, color: '#6c3fff', contacts: [], studentCounts: {}, portalToken: genId()+genId() };
        state.schools.push(ns);
        await saveData('schools');
        schoolId = ns.id; schoolName = newName;
      }
    } else {
      schoolName = state.schools.find(s => s.id === schoolId)?.name || '';
    }

    const school = state.schools.find(s => s.id === schoolId);
    const sc = school?.studentCounts || {};

    // If multiple categories: create separate exam per category
    let newExams;
    if (selectedCats.length > 1 && !examId) {
      newExams = selectedCats.map(cat => {
        const catQty = sc[cat.id] || qty;
        return {
          id: genId(), name, categoryId: cat.id, categoryIds: [cat.id], categoryNames: cat.name,
          type, price: catQty && unitPrice ? catQty * unitPrice : price,
          qty: catQty, unitPrice, schoolId, schoolName,
          stockDate, applicationDate, publisherId, publisherName, examNo, trackingNumber, periodId,
          status: 'ordered', applied: false, notes: [], gcalAdded: false, gcalEventIds: []
        };
      });
    } else {
      const examData = {
        name, categoryId: selectedCats[0]?.id||'',
        categoryIds: selectedCats.map(c=>c.id),
        categoryNames: selectedCats.map(c=>c.name).join(', '),
        type, price, qty, unitPrice, schoolId, schoolName,
        stockDate, applicationDate, publisherId, publisherName, examNo, trackingNumber, periodId,
        status: 'ordered', applied: false
      };
      if (examId) {
        const idx = state.exams.findIndex(e => e.id === examId);
        state.exams[idx] = { ...state.exams[idx], ...examData };
        newExams = null;
      } else {
        newExams = [{ id: genId(), ...examData, notes: [], gcalAdded: false, gcalEventIds: [] }];
      }
    }

    if (newExams) state.exams.push(...newExams);
    await saveData('exams');
    closeModal(); renderAll();

    if (addToGcal) {
      const toAdd = newExams || [state.exams.find(e => e.id === examId)];
      for (const e of toAdd) {
        if (e) { await addToGoogleCalendar(e); await new Promise(r => setTimeout(r, 300)); }
      }
      renderExamList();
    }
    toast(`📝 Deneme ${examId ? 'güncellendi' : 'eklendi'}`, 'success');
    triggerBadgeUpdate();
  });
}

function openCombinedExamModal() {
  // Check if we want multi-school or multi-exam mode
  const html = `
    <div class="modal-title">➕ Deneme Ekle <button class="modal-close" id="closeModal">×</button></div>
    <div class="mode-toggle">
      <button class="mode-btn active" id="modeSingle">📝 Tek Deneme</button>
      <button class="mode-btn" id="modeBulkSchool">📦 Tek Deneme → Çok Okul</button>
      <button class="mode-btn" id="modeMultiExam">📋 Çok Deneme → Tek Okul</button>
    </div>
    <div id="modeContent"></div>`;

  openModal(html);

  function showSingleMode() {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('modeSingle').classList.add('active');
    closeModal();
    openExamModal(); // use the full exam modal
  }

  function showBulkSchoolMode() {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('modeBulkSchool').classList.add('active');
    openBulkSchoolModal();
  }

  function showMultiExamMode() {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('modeMultiExam').classList.add('active');
    openMultiExamModal();
  }

  document.getElementById('modeSingle').addEventListener('click', showSingleMode);
  document.getElementById('modeBulkSchool').addEventListener('click', showBulkSchoolMode);
  document.getElementById('modeMultiExam').addEventListener('click', showMultiExamMode);

  // Default to single
  showSingleMode();
}

// ===== SCHOOL BULK IMPORT =====
function openSchoolImportModal() {
  const html = `
    <div class="modal-title">📥 Toplu Okul Ekle <button class="modal-close" id="closeModal">×</button></div>
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;line-height:1.7">
      Her satıra bir okul yazın. Formatlar kabul edilir:<br>
      <code style="background:var(--bg);padding:1px 6px;border-radius:4px;font-size:11px">OKUL ADI</code> &nbsp;veya&nbsp;
      <code style="background:var(--bg);padding:1px 6px;border-radius:4px;font-size:11px">KOD  OKUL ADI  ŞEHİR/İLÇE</code>
    </div>

    <div class="form-group">
      <label class="form-label">Okul Listesi</label>
      <textarea id="schoolImportText" class="form-textarea" rows="10"
        placeholder="ATATÜRK ORTAOKULU&#10;YUNUS EMRE ORTAOKULU&#10;GAZİ TURHAN BEY ORTAOKULU&#10;..."></textarea>
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      <label style="font-size:12px;font-weight:700;color:var(--text-muted)">veya dosyadan:</label>
      <label class="btn-import" style="font-size:11px">
        📄 TXT/CSV Yükle
        <input type="file" id="schoolImportFile" accept=".txt,.csv,.tsv" style="display:none">
      </label>
    </div>

    <div id="schoolImportPreview" style="margin-bottom:10px"></div>

    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <input type="checkbox" id="schoolImportSkipDup" checked style="accent-color:var(--primary)">
      <label for="schoolImportSkipDup" style="font-size:12px;color:var(--text-muted)">Zaten ekli okulları atla</label>
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">İptal</button>
      <button class="btn-primary" id="btnDoImportSchools">🏫 Ekle</button>
    </div>`;

  openModal(html);

  const textarea = document.getElementById('schoolImportText');
  const preview  = document.getElementById('schoolImportPreview');

  // File upload → fill textarea
  document.getElementById('schoolImportFile').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { textarea.value = ev.target.result; updatePreview(); };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  });

  textarea.addEventListener('input', updatePreview);

  function parseLines(text) {
    return text.split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 2)
      .map(line => {
        // Try to parse: CODE\tNAME\tCITY  or  CODE  NAME  CITY
        const parts = line.split(/\t|  +/);
        if (parts.length >= 2) {
          // First part all digits → it's a code, second is name
          if (/^\d{5,7}$/.test(parts[0].trim())) {
            const name = parts[1].trim();
            const city = parts.slice(2).join(' ').trim();
            return { name, city, code: parts[0].trim() };
          }
        }
        // Just a name (possibly with city after /)
        const slashIdx = line.lastIndexOf('/');
        if (slashIdx > 0 && slashIdx < line.length - 1) {
          // Format: "NAME / CITY" or "CITY/DISTRICT"
          const afterSlash = line.slice(slashIdx + 1).trim();
          const beforeSlash = line.slice(0, slashIdx).trim();
          // If afterSlash looks like a city (short), it's name/city
          if (afterSlash.length < 30 && beforeSlash.length > 3) {
            return { name: beforeSlash, city: afterSlash, code: '' };
          }
        }
        return { name: line, city: '', code: '' };
      })
      .filter(s => s.name.length > 2);
  }

  function updatePreview() {
    const schools = parseLines(textarea.value);
    const skipDup = document.getElementById('schoolImportSkipDup')?.checked;
    const existing = new Set(state.schools.map(s => trNorm(s.name)));
    const newOnes = skipDup ? schools.filter(s => !existing.has(trNorm(s.name))) : schools;
    const skipped = schools.length - newOnes.length;

    preview.innerHTML = schools.length === 0 ? '' : `
      <div style="padding:8px 12px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--text-muted)">
        <b style="color:var(--primary)">${schools.length}</b> okul tanındı
        ${skipped > 0 ? ` • <b style="color:var(--warning)">${skipped}</b> zaten kayıtlı (atlanacak)` : ''}
        • <b style="color:var(--success)">${newOnes.length}</b> eklenecek
      </div>`;

    const btn = document.getElementById('btnDoImportSchools');
    if (btn) btn.textContent = `🏫 ${newOnes.length} Okul Ekle`;
  }

  textarea.addEventListener('input', updatePreview);
  document.getElementById('schoolImportSkipDup').addEventListener('change', updatePreview);

  document.getElementById('btnDoImportSchools').addEventListener('click', async () => {
    const schools = parseLines(textarea.value);
    if (!schools.length) { toast('Liste boş', 'error'); return; }

    const skipDup = document.getElementById('schoolImportSkipDup').checked;
    const existing = new Set(state.schools.map(s => trNorm(s.name)));

    let added = 0;
    for (const s of schools) {
      if (skipDup && existing.has(trNorm(s.name))) continue;
      const color = getNextSchoolColor();
      const notes = [s.city, s.code].filter(Boolean).join(' · ');
      state.schools.push({
        id: genId(),
        name: s.name,
        color,
        studentCounts: {},
        contacts: notes ? [{ id: genId(), name: notes, role: 'Bilgi', phone: '', email: '' }] : [],
        portalToken: genId() + genId(),
      });
      added++;
    }

    await saveData('schools');
    closeModal();
    renderSchoolList();
    populateFilters();
    toast(`🏫 ${added} okul eklendi`, 'success');
  });
}

function openBulkSchoolModal() {
  const catCheckboxes = state.categories.map(c =>
    `<label class="cat-checkbox-item" style="--cat-color:${c.color}">
      <input type="checkbox" class="cat-cb" value="${c.id}" data-name="${c.name}" data-color="${c.color}">
      <span class="cat-cb-label">${c.name}</span>
    </label>`).join('');

  const publisherOptions = state.publishers.map(p => `<option value="${p.id}" data-name="${p.name}">${p.name}</option>`).join('');
  const periodOptions = state.periods.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  const schoolRows = state.schools.length === 0
    ? '<div style="color:var(--text-muted);padding:8px;font-size:12px">Önce okul ekleyin</div>'
    : state.schools.map(s => `
      <div class="bulk-school-row-item">
        <label class="bulk-school-check-label">
          <input type="checkbox" class="bulk-school-cb" value="${s.id}" data-name="${s.name}">
          <span style="color:${s.color||'var(--text)'}">${s.name}</span>
        </label>
        <div class="bulk-school-pricing" id="pricing_${s.id}" style="display:none">
          <input type="number" class="input-sm bulk-qty-input" data-school="${s.id}" placeholder="Adet" style="width:64px">
          <span style="color:var(--text-muted);font-weight:700">×</span>
          <input type="number" class="input-sm bulk-unit-input" data-school="${s.id}" placeholder="₺" style="width:72px">
          <span style="color:var(--text-muted);font-weight:700">=</span>
          <span class="bulk-total-display" id="btotal_${s.id}" style="font-weight:800;color:var(--primary);min-width:56px">—</span>
        </div>
      </div>`).join('');

  const html = `
    <div class="modal-title">📦 Toplu Ekle (Aynı Deneme → Çok Okul) <button class="modal-close" id="closeModal">×</button></div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">📚 Yayıncı</label>
        <select id="bPublisher" class="form-select"><option value="">Seçin...</option>${publisherOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">🔢 No</label>
        <input type="number" id="bExamNo" class="form-input" placeholder="1,2..." min="1">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Deneme Adı</label>
      <input type="text" id="bName" class="form-input" placeholder="Deneme adı...">
    </div>
    <div class="form-group">
      <label class="form-label">Kategori</label>
      <div class="cat-checkboxes">${catCheckboxes}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Tür</label>
      <div class="type-selector">
        <button class="type-btn" data-type="Tarama">📋 Tarama</button>
        <button class="type-btn" data-type="Genel">📘 Genel</button>
        <button class="type-btn" data-type="TG">⭐ TG</button>
      </div>
      <input type="hidden" id="bType" value="">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">📦 Stok</label>
        <input type="date" id="bStock" class="form-input">
      </div>
      <div class="form-group">
        <label class="form-label">🎯 Uygulama</label>
        <input type="date" id="bApp" class="form-input">
      </div>
    </div>
    ${state.periods.length > 0 ? `
    <div class="form-group">
      <label class="form-label">🗓️ Dönem</label>
      <select id="bPeriod" class="form-select"><option value="">Dönem seçin...</option>${periodOptions}</select>
    </div>` : ''}
    <div class="form-group">
      <label class="form-label">Okullar</label>
      <div class="bulk-school-rows">${schoolRows}</div>
    </div>
    <label class="gcal-toggle"><input type="checkbox" id="bGcal" checked> Google Takvim'e ekle</label>
    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">İptal</button>
      <button class="btn-primary" id="saveBulkSchool">💾 Hepsine Ekle</button>
    </div>`;

  openModal(html);

  // Publisher auto-fill
  function autoFillB() {
    const sel = document.getElementById('bPublisher');
    const n = sel.options[sel.selectedIndex]?.dataset?.name||'';
    const no = document.getElementById('bExamNo').value;
    if (n) document.getElementById('bName').value = no ? `${n} - ${no}` : n;
  }
  document.getElementById('bPublisher').addEventListener('change', autoFillB);
  document.getElementById('bExamNo').addEventListener('input', autoFillB);

  // Type buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.className = 'type-btn');
      btn.classList.add(`active-${btn.dataset.type.toLowerCase()}`);
      document.getElementById('bType').value = btn.dataset.type;
    });
  });

  // Checkbox listeners
  document.querySelectorAll('.bulk-school-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const pricing = document.getElementById(`pricing_${cb.value}`);
      if (pricing) pricing.style.display = cb.checked ? 'flex' : 'none';
      if (cb.checked) autoFillBulkQty(cb.value);
    });
  });

  // Cat change → update qty
  document.querySelectorAll('.cat-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      document.querySelectorAll('.bulk-school-cb:checked').forEach(scb => autoFillBulkQty(scb.value));
    });
  });

  // Unit price listeners
  document.querySelectorAll('.bulk-qty-input, .bulk-unit-input').forEach(inp => {
    inp.addEventListener('input', () => updateBulkRowTotal(inp.dataset.school));
  });

  function autoFillBulkQty(schoolId) {
    const school = state.schools.find(s => s.id === schoolId);
    if (!school?.studentCounts) return;
    const selCats = [...document.querySelectorAll('.cat-cb:checked')].map(c => c.value);
    const total = selCats.reduce((sum, id) => sum + (school.studentCounts[id]||0), 0);
    const inp = document.querySelector(`.bulk-qty-input[data-school="${schoolId}"]`);
    if (inp && total > 0) { inp.value = total; updateBulkRowTotal(schoolId); }
  }

  function updateBulkRowTotal(schoolId) {
    const qty = parseFloat(document.querySelector(`.bulk-qty-input[data-school="${schoolId}"]`)?.value)||0;
    const unit = parseFloat(document.querySelector(`.bulk-unit-input[data-school="${schoolId}"]`)?.value)||0;
    const el = document.getElementById(`btotal_${schoolId}`);
    if (el) el.textContent = qty*unit > 0 ? (qty*unit).toLocaleString('tr-TR') + ' ₺' : '—';
  }

  document.getElementById('saveBulkSchool').addEventListener('click', async () => {
    const name = document.getElementById('bName').value.trim();
    if (!name) { toast('Deneme adı zorunlu', 'error'); return; }
    const selCats = [...document.querySelectorAll('.cat-cb:checked')].map(cb => ({ id: cb.value, name: cb.dataset.name }));
    const type = document.getElementById('bType').value;
    const stockDate = document.getElementById('bStock').value;
    const applicationDate = document.getElementById('bApp').value;
    const addToGcal = document.getElementById('bGcal').checked;
    const publisherId = document.getElementById('bPublisher').value;
    const examNo = document.getElementById('bExamNo').value;
    const periodId = document.getElementById('bPeriod')?.value||'';
    const selSchools = [...document.querySelectorAll('.bulk-school-cb:checked')].map(cb => ({ id: cb.value, name: cb.dataset.name }));
    if (!selSchools.length) { toast('En az bir okul seçin', 'error'); return; }

    const newExams = [];
    selSchools.forEach(s => {
      const school = state.schools.find(sc => sc.id === s.id);
      const sc2 = school?.studentCounts || {};
      const bQty = Number(document.querySelector(`.bulk-qty-input[data-school="${s.id}"]`)?.value)||null;
      const bUnit = Number(document.querySelector(`.bulk-unit-input[data-school="${s.id}"]`)?.value)||null;

      if (selCats.length > 1) {
        selCats.forEach(cat => {
          const cq = sc2[cat.id] || bQty;
          newExams.push({ id:genId(), name, categoryId:cat.id, categoryIds:[cat.id], categoryNames:cat.name,
            type, price:cq&&bUnit?cq*bUnit:0, qty:cq, unitPrice:bUnit, schoolId:s.id, schoolName:s.name,
            stockDate, applicationDate, publisherId, examNo, periodId,
            status:'ordered', applied:false, notes:[], gcalAdded:false, gcalEventIds:[] });
        });
      } else {
        const bPrice = bQty&&bUnit ? bQty*bUnit : 0;
        newExams.push({ id:genId(), name,
          categoryId:selCats[0]?.id||'', categoryIds:selCats.map(c=>c.id), categoryNames:selCats.map(c=>c.name).join(', '),
          type, price:bPrice, qty:bQty, unitPrice:bUnit, schoolId:s.id, schoolName:s.name,
          stockDate, applicationDate, publisherId, examNo, periodId,
          status:'ordered', applied:false, notes:[], gcalAdded:false, gcalEventIds:[] });
      }
    });

    state.exams.push(...newExams);
    await saveData('exams');
    closeModal(); renderAll();
    if (addToGcal) {
      for (const e of state.exams.slice(-newExams.length)) {
        await addToGoogleCalendar(e); await new Promise(r=>setTimeout(r,300));
      }
      renderExamList();
    }
    toast(`📝 ${newExams.length} deneme eklendi`, 'success');
    triggerBadgeUpdate();
  });
}

function openMultiExamModal() {
  const schoolOptions = state.schools.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  const periodOptions = state.periods.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const publisherOptions = state.publishers.map(p => `<option value="${p.id}" data-name="${p.name}">${p.name}</option>`).join('');
  let rowCount = 0;

  const html = `
    <div class="modal-title">📋 Çok Deneme → Tek Okul <button class="modal-close" id="closeModal">×</button></div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">🏫 Okul</label>
        <select id="multiSchool" class="form-select"><option value="">Okul seçin...</option>${schoolOptions}</select>
      </div>
      ${state.periods.length > 0 ? `
      <div class="form-group">
        <label class="form-label">🗓️ Dönem</label>
        <select id="multiPeriod" class="form-select"><option value="">Seçin...</option>${periodOptions}</select>
      </div>` : ''}
    </div>
    <div id="multiExamRows" class="multi-exam-rows"></div>
    <button class="btn-secondary" id="btnAddRow" style="width:100%;margin-top:8px;font-size:12px">+ Deneme Satırı Ekle</button>
    <label class="gcal-toggle" style="margin-top:8px"><input type="checkbox" id="multiGcal" checked> Google Takvim'e ekle</label>
    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">İptal</button>
      <button class="btn-primary" id="saveMultiExam">💾 Hepsini Ekle</button>
    </div>`;

  openModal(html);

  function buildRow(idx) {
    const catCbs = state.categories.map(c =>
      `<label class="cat-checkbox-item" style="--cat-color:${c.color}">
        <input type="checkbox" class="mcat-cb" data-row="${idx}" value="${c.id}" data-name="${c.name}">
        <span class="cat-cb-label" style="padding:2px 7px;font-size:10px">${c.name}</span>
      </label>`).join('');
    return `
      <div class="multi-exam-row" data-row="${idx}">
        <div class="multi-row-header">
          <span class="multi-row-num">#${idx+1}</span>
          <button class="btn-xs btn-delete mrow-del" data-row="${idx}">✕</button>
        </div>
        <div class="form-row" style="margin-bottom:6px">
          <div>
            <select class="form-select mrow-pub" data-row="${idx}"><option value="">Yayıncı...</option>${publisherOptions}</select>
          </div>
          <div>
            <input type="number" class="form-input mrow-no" data-row="${idx}" placeholder="No" min="1" style="max-width:80px">
          </div>
        </div>
        <input type="text" class="form-input mrow-name" data-row="${idx}" placeholder="Deneme adı..." style="margin-bottom:6px">
        <div class="cat-checkboxes" style="margin-bottom:6px">${catCbs}</div>
        <div class="type-selector" style="margin-bottom:6px">
          <button class="type-btn mtype-btn" data-row="${idx}" data-type="Tarama">📋 Tarama</button>
          <button class="type-btn mtype-btn" data-row="${idx}" data-type="Genel">📘 Genel</button>
          <button class="type-btn mtype-btn" data-row="${idx}" data-type="TG">⭐ TG</button>
        </div>
        <div class="form-row" style="margin-bottom:6px">
          <div>
            <label style="font-size:10px;color:var(--text-muted)">📦 Stok</label>
            <input type="date" class="form-input mrow-stock" data-row="${idx}">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-muted)">🎯 Uygulama</label>
            <input type="date" class="form-input mrow-app" data-row="${idx}">
          </div>
        </div>
        <div class="price-calc-row">
          <div class="price-calc-field">
            <span class="price-calc-label">Adet</span>
            <input type="number" class="form-input mrow-qty" data-row="${idx}" placeholder="0" min="1">
          </div>
          <span class="price-calc-times">×</span>
          <div class="price-calc-field">
            <span class="price-calc-label">Birim ₺</span>
            <input type="number" class="form-input mrow-unit" data-row="${idx}" placeholder="0">
          </div>
          <span class="price-calc-times">=</span>
          <div class="price-calc-field">
            <span class="price-calc-label">Toplam</span>
            <div class="price-total-display mrow-total" data-row="${idx}">—</div>
          </div>
        </div>
      </div>`;
  }

  function addRow() {
    const container = document.getElementById('multiExamRows');
    const div = document.createElement('div');
    div.innerHTML = buildRow(rowCount);
    const row = div.firstElementChild;
    container.appendChild(row);
    const idx = rowCount;
    rowCount++;

    // Type buttons
    row.querySelectorAll('.mtype-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        row.querySelectorAll('.mtype-btn').forEach(b => b.className = 'type-btn mtype-btn');
        btn.classList.add(`active-${btn.dataset.type.toLowerCase()}`);
      });
    });

    // Price calc
    row.querySelectorAll('.mrow-qty, .mrow-unit').forEach(inp => {
      inp.addEventListener('input', () => {
        const q = parseFloat(row.querySelector('.mrow-qty')?.value)||0;
        const u = parseFloat(row.querySelector('.mrow-unit')?.value)||0;
        const el = row.querySelector('.mrow-total');
        if (el) el.textContent = q*u > 0 ? (q*u).toLocaleString('tr-TR') + ' ₺' : '—';
      });
    });

    // Publisher auto-fill
    row.querySelector('.mrow-pub').addEventListener('change', () => {
      const sel = row.querySelector('.mrow-pub');
      const pubName = sel.options[sel.selectedIndex]?.dataset?.name||'';
      const no = row.querySelector('.mrow-no')?.value||'';
      if (pubName) row.querySelector('.mrow-name').value = no ? `${pubName} - ${no}` : pubName;
    });
    row.querySelector('.mrow-no').addEventListener('input', () => {
      const sel = row.querySelector('.mrow-pub');
      const pubName = sel.options[sel.selectedIndex]?.dataset?.name||'';
      const no = row.querySelector('.mrow-no').value;
      if (pubName) row.querySelector('.mrow-name').value = no ? `${pubName} - ${no}` : pubName;
    });

    // Cat change → auto-fill qty from school
    row.querySelectorAll('.mcat-cb').forEach(cb => {
      cb.addEventListener('change', () => {
        const schoolId = document.getElementById('multiSchool')?.value;
        if (!schoolId) return;
        const school = state.schools.find(s => s.id === schoolId);
        if (!school?.studentCounts) return;
        const selCats = [...row.querySelectorAll('.mcat-cb:checked')].map(c => c.value);
        const total = selCats.reduce((sum, id) => sum + (school.studentCounts[id]||0), 0);
        const qInp = row.querySelector('.mrow-qty');
        if (qInp && total > 0) {
          qInp.value = total;
          qInp.dispatchEvent(new Event('input'));
        }
      });
    });

    // Delete
    row.querySelector('.mrow-del').addEventListener('click', () => row.remove());
  }

  addRow(); // start with 1 row
  document.getElementById('btnAddRow').addEventListener('click', addRow);

  // When school changes, update all rows qty
  document.getElementById('multiSchool').addEventListener('change', () => {
    document.querySelectorAll('.multi-exam-row').forEach(row => {
      const schoolId = document.getElementById('multiSchool').value;
      if (!schoolId) return;
      const school = state.schools.find(s => s.id === schoolId);
      if (!school?.studentCounts) return;
      const selCats = [...row.querySelectorAll('.mcat-cb:checked')].map(c => c.value);
      const total = selCats.reduce((sum, id) => sum + (school.studentCounts[id]||0), 0);
      const qInp = row.querySelector('.mrow-qty');
      if (qInp && total > 0) { qInp.value = total; qInp.dispatchEvent(new Event('input')); }
    });
  });

  document.getElementById('saveMultiExam').addEventListener('click', async () => {
    const schoolId = document.getElementById('multiSchool')?.value;
    if (!schoolId) { toast('Okul seçin', 'error'); return; }
    const schoolName = state.schools.find(s => s.id === schoolId)?.name||'';
    const addToGcal = document.getElementById('multiGcal')?.checked;
    const periodId = document.getElementById('multiPeriod')?.value||'';
    const school = state.schools.find(s => s.id === schoolId);
    const sc2 = school?.studentCounts||{};

    const newExams = [];
    const rows = document.querySelectorAll('.multi-exam-row');
    if (!rows.length) { toast('En az bir deneme satırı ekleyin', 'error'); return; }

    for (const row of rows) {
      const name = row.querySelector('.mrow-name')?.value.trim();
      if (!name) { toast('Tüm deneme adları dolu olmalı', 'error'); return; }
      const selCats = [...row.querySelectorAll('.mcat-cb:checked')].map(cb => ({ id: cb.value, name: cb.dataset.name }));
      const typeBtn = row.querySelector('.mtype-btn.active-tarama, .mtype-btn.active-genel, .mtype-btn.active-tg');
      const type = typeBtn?.dataset?.type||'';
      const stockDate = row.querySelector('.mrow-stock')?.value||'';
      const applicationDate = row.querySelector('.mrow-app')?.value||'';
      const rowQty = Number(row.querySelector('.mrow-qty')?.value)||null;
      const unitPrice = Number(row.querySelector('.mrow-unit')?.value)||null;
      const publisherId = row.querySelector('.mrow-pub')?.value||'';
      const examNo = row.querySelector('.mrow-no')?.value||'';

      if (selCats.length > 1) {
        selCats.forEach(cat => {
          const cq = sc2[cat.id]||rowQty;
          newExams.push({ id:genId(), name, categoryId:cat.id, categoryIds:[cat.id], categoryNames:cat.name,
            type, price:cq&&unitPrice?cq*unitPrice:0, qty:cq, unitPrice, schoolId, schoolName,
            stockDate, applicationDate, publisherId, examNo, periodId,
            status:'ordered', applied:false, notes:[], gcalAdded:false, gcalEventIds:[] });
        });
      } else {
        newExams.push({ id:genId(), name,
          categoryId:selCats[0]?.id||'', categoryIds:selCats.map(c=>c.id), categoryNames:selCats.map(c=>c.name).join(', '),
          type, price:rowQty&&unitPrice?rowQty*unitPrice:0, qty:rowQty, unitPrice, schoolId, schoolName,
          stockDate, applicationDate, publisherId, examNo, periodId,
          status:'ordered', applied:false, notes:[], gcalAdded:false, gcalEventIds:[] });
      }
    }

    state.exams.push(...newExams);
    await saveData('exams');
    closeModal(); renderAll();
    if (addToGcal) {
      for (const e of state.exams.slice(-newExams.length)) {
        await addToGoogleCalendar(e); await new Promise(r=>setTimeout(r,300));
      }
      renderExamList();
    }
    toast(`📝 ${newExams.length} deneme eklendi`, 'success');
    triggerBadgeUpdate();
  });
}


// ===== GOOGLE CALENDAR =====
// Google OAuth disabled - using Apps Script instead
async function getGoogleToken() {
  return Promise.reject(new Error('Google Calendar entegrasyonu bu sürümde devre dışı'));
}

async function addToGoogleCalendar(exam) {
  try {
    const token = await getGoogleToken();
    const eventIds = [];

    async function createEvent(title, date, description) {
      if (!date) return null;
      const event = {
        summary: title,
        description,
        start: { date },
        end: { date },
        reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 24 * 60 }] }
      };
      const r = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d.id;
    }

    const publisher = state.publishers.find(p => p.id === exam.publisherId);
    const pubName = publisher?.name || exam.publisherName || '';
    const pubShort = pubName.replace(/ KURUMSAL DENEME \d{4}-\d{2,4}$/, '').replace(/ YAYINLARI$/, '').trim();
    const desc = `${exam.name}${pubShort ? ' | ' + pubShort : ''} | ${exam.schoolName || ''} | ${exam.categoryNames || ''} | ${exam.type || ''}`;

    if (exam.stockDate) {
      const id = await createEvent(`📦 Stok: ${exam.name}${pubShort ? ' - ' + pubShort : ''}`, exam.stockDate, desc);
      if (id) eventIds.push(id);
    }
    if (exam.applicationDate) {
      const id = await createEvent(`🎯 Uygulama: ${exam.name}${pubShort ? ' - ' + pubShort : ''}`, exam.applicationDate, desc);
      if (id) eventIds.push(id);
    }

    const idx = state.exams.findIndex(e => e.id === exam.id);
    if (idx !== -1) {
      state.exams[idx].gcalAdded = true;
      state.exams[idx].gcalEventIds = eventIds;
      await saveData('exams');
    }
    toast('📅 Google Takvim\'e eklendi', 'success');
    return true;
  } catch (err) {
    console.error('GCal error:', err);
    toast('⚠️ Google Takvim hatası: ' + err.message, 'error');
    return false;
  }
}

async function addSingleToGCal(examId) {
  const exam = state.exams.find(e => e.id === examId);
  if (!exam) return;
  if (exam.gcalAdded) {
    toast('Bu deneme zaten takvime eklenmiş', 'warning');
    return;
  }
  toast('📅 Takvime ekleniyor...', 'default', 1500);
  const ok = await addToGoogleCalendar(exam);
  if (ok) renderExamList();
}

// ===== EXPORT PDF =====
function exportPDF(school, exams, payments, debt) {
  const totalCharge = exams.reduce((sum, e) => sum + (Number(e.price)||0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount)||0), 0);

  const examRows = [...exams].sort((a,b)=>(a.applicationDate||'').localeCompare(b.applicationDate||'')).map(e => {
    const cats = (e.categoryIds||[e.categoryId]).map(id => { const c=getCatById(id); return c?.name||''; }).filter(Boolean).join(', ');
    const sc2 = STATUS_CONFIG[e.status||'ordered'];
    return `<tr>
      <td>${e.name}</td>
      <td>${cats}</td>
      <td>${e.type||''}</td>
      <td>${e.applicationDate ? formatDate(e.applicationDate) : ''}</td>
      <td>${e.qty||''}</td>
      <td>${e.unitPrice ? Number(e.unitPrice).toLocaleString('tr-TR') + ' ₺' : ''}</td>
      <td>${e.price ? Number(e.price).toLocaleString('tr-TR') + ' ₺' : ''}</td>
      <td><span style="color:${sc2.color}">${sc2.short}</span></td>
    </tr>`;
  }).join('');

  const paymentRows = [...payments].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(p =>
    `<tr>
      <td>${formatDate(p.date)}</td>
      <td>${p.note||''}</td>
      <td style="color:#059669;font-weight:700">+${Number(p.amount).toLocaleString('tr-TR')} ₺</td>
    </tr>`).join('');

  const contacts = (school.contacts||[]).map(c =>
    `<div>${c.name}${c.role ? ' (' + c.role + ')' : ''}: ${c.phone||''} ${c.email||''}</div>`).join('');

  const sc = school.studentCounts || {};
  const scHtml = Object.entries(sc).filter(([,v])=>v>0).map(([k,v]) => `${CLASS_LABELS[k]||k}: ${v}`).join(' | ');

  const html = `<!DOCTYPE html><html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1035; padding: 32px; }
  h1 { font-size: 22px; color: #6c3fff; margin-bottom: 4px; }
  .meta { color: #7c6fa0; font-size: 12px; margin-bottom: 24px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 12px; font-weight: 800; color: #6c3fff; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #ede9ff; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .summary-box { background: #f8f7ff; border-radius: 10px; padding: 12px; text-align: center; border: 1px solid #ede9ff; }
  .summary-box .label { font-size: 10px; color: #7c6fa0; font-weight: 700; text-transform: uppercase; }
  .summary-box .value { font-size: 20px; font-weight: 900; margin-top: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #6c3fff; color: white; padding: 7px 9px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  td { padding: 6px 9px; border-bottom: 1px solid #e5e1ff; }
  tr:nth-child(even) td { background: #f8f7ff; }
  .contacts { font-size: 11px; color: #7c6fa0; margin-top: 4px; }
  .footer { margin-top: 28px; font-size: 10px; color: #b0a4cc; text-align: right; border-top: 1px solid #ede9ff; padding-top: 10px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <h1>🏫 ${school.name}</h1>
  <div class="meta">Deneme Takip Sistemi • ${new Date().toLocaleDateString('tr-TR')}</div>
  ${contacts ? `<div class="contacts">${contacts}</div>` : ''}
  ${scHtml ? `<div style="font-size:11px;color:#7c6fa0;margin-top:4px">Öğrenci: ${scHtml}</div>` : ''}

  <div class="summary-grid" style="margin-top:16px">
    <div class="summary-box"><div class="label">Toplam Tutar</div><div class="value" style="color:#ef4444">${totalCharge.toLocaleString('tr-TR')} ₺</div></div>
    <div class="summary-box"><div class="label">Ödenen</div><div class="value" style="color:#10b981">${totalPaid.toLocaleString('tr-TR')} ₺</div></div>
    <div class="summary-box"><div class="label">Kalan Borç</div><div class="value" style="color:${debt>0?'#ef4444':debt<0?'#3b82f6':'#10b981'}">${debt.toLocaleString('tr-TR')} ₺</div></div>
  </div>

  <div class="section">
    <div class="section-title">📝 Denemeler (${exams.length})</div>
    <table>
      <thead><tr><th>Deneme</th><th>Kategori</th><th>Tür</th><th>Uygulama</th><th>Adet</th><th>Birim</th><th>Toplam</th><th>Durum</th></tr></thead>
      <tbody>${examRows}</tbody>
    </table>
  </div>

  ${payments.length > 0 ? `
  <div class="section">
    <div class="section-title">💳 Ödeme Geçmişi</div>
    <table>
      <thead><tr><th>Tarih</th><th>Not</th><th>Tutar</th></tr></thead>
      <tbody>${paymentRows}</tbody>
    </table>
  </div>` : ''}

  <div class="footer">Deneme Takip v3.0 • ${new Date().toLocaleString('tr-TR')}</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { toast('Pop-up engellendi. Tarayıcı ayarlarından izin verin.', 'error'); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

// ===== EXPORT EXCEL =====
function exportExcel(school, exams, payments, debt) {
  const totalCharge = exams.reduce((sum, e) => sum + (Number(e.price)||0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount)||0), 0);

  const sep = '\t';
  const nl = '\n';

  let csv = `DENEME TAKİP - ${school.name}${nl}`;
  csv += `Tarih: ${new Date().toLocaleDateString('tr-TR')}${nl}${nl}`;
  csv += `Toplam Tutar${sep}Ödenen${sep}Kalan Borç${nl}`;
  csv += `${totalCharge.toLocaleString('tr-TR')} ₺${sep}${totalPaid.toLocaleString('tr-TR')} ₺${sep}${debt.toLocaleString('tr-TR')} ₺${nl}${nl}`;

  csv += `DENEMELER${nl}`;
  csv += `Deneme Adı${sep}Kategori${sep}Tür${sep}Stok Tarihi${sep}Uygulama Tarihi${sep}Adet${sep}Birim Fiyat${sep}Toplam${sep}Durum${sep}Kargo No${nl}`;
  [...exams].sort((a,b)=>(a.applicationDate||'').localeCompare(b.applicationDate||'')).forEach(e => {
    const cats = (e.categoryIds||[e.categoryId]).map(id => { const c=getCatById(id); return c?.name||''; }).filter(Boolean).join(', ');
    const sc2 = STATUS_CONFIG[e.status||'ordered'];
    csv += `${e.name}${sep}${cats}${sep}${e.type||''}${sep}${e.stockDate ? formatDate(e.stockDate) : ''}${sep}${e.applicationDate ? formatDate(e.applicationDate) : ''}${sep}${e.qty||''}${sep}${e.unitPrice||''}${sep}${e.price||''}${sep}${sc2.label}${sep}${e.trackingNumber||''}${nl}`;
  });

  if (payments.length > 0) {
    csv += `${nl}ÖDEMELER${nl}`;
    csv += `Tarih${sep}Not${sep}Tutar${nl}`;
    [...payments].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).forEach(p => {
      csv += `${formatDate(p.date)}${sep}${p.note||''}${sep}${p.amount}${nl}`;
    });
  }

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${school.name}-deneme-takip-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast('📊 Excel dosyası indirildi', 'success');
}

// ===== BACKUP =====
async function exportBackup() {
  const data = {
    version: 3,
    exportedAt: new Date().toISOString(),
    exams: state.exams,
    schools: state.schools,
    categories: state.categories,
    payments: state.payments,
    publishers: state.publishers,
    periods: state.periods,
    settings: state.settings,
    catalogItems: state.catalogItems,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deneme-takip-yedek-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  state.settings.lastBackup = Date.now();
  await saveData('settings');
  toast('⬇️ Yedek alındı', 'success');
  renderSettings();
}

async function importBackup(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!confirm('Mevcut veriler YEDEĞİNİZDEKİ ile değiştirilecek. Emin misiniz?')) {
    e.target.value = ''; return;
  }
  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.exams) state.exams = data.exams;
      if (data.schools) state.schools = data.schools;
      if (data.categories && data.categories.length > 0) state.categories = data.categories;
      if (data.payments) state.payments = data.payments;
      if (data.publishers) state.publishers = data.publishers;
      if (data.periods) state.periods = data.periods;
      if (data.catalogItems) state.catalogItems = data.catalogItems;
      if (data.settings) state.settings = { ...state.settings, ...data.settings };
      await saveAll();
      renderAll();
      toast('✅ Yedek başarıyla geri yüklendi', 'success');
    } catch (err) {
      toast('❌ Dosya okunamadı: ' + err.message, 'error');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
}

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbweOcUOrks-e1Us_kNcdvwXfO_j7hOVXlSC1NFbbuET3Q33ZwJxJabpK5CVuvs2GmA/exec';

async function driveBackup() {
  try {
    toast('☁️ Drive\'a yükleniyor...', 'default', 3000);
    const data = {
      version: 3, exportedAt: new Date().toISOString(),
      exams: state.exams, schools: state.schools, categories: state.categories,
      payments: state.payments, publishers: state.publishers, periods: state.periods,
      settings: state.settings, catalogItems: state.catalogItems,
    };
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data),
    });
    // no-cors = opaque response, assume success if no exception
    state.settings.lastBackup = Date.now();
    await saveData('settings');
    renderSettings();
    toast('☁️ Drive\'a yedeklendi! ✅', 'success');
  } catch (err) {
    toast('❌ ' + err.message, 'error');
  }
}

async function driveRestore() {
  try {
    toast('☁️ Drive\'dan yükleniyor...', 'default', 3000);
    const data = await new Promise((resolve, reject) => {
      const cbName = 'driveRestoreCb_' + Date.now();
      const script = document.createElement('script');
      const timeout = setTimeout(() => {
        delete window[cbName];
        script.remove();
        reject(new Error('Zaman aşımı'));
      }, 20000);
      window[cbName] = (data) => {
        clearTimeout(timeout);
        delete window[cbName];
        script.remove();
        resolve(data);
      };
      script.src = APPS_SCRIPT_URL + '?callback=' + cbName;
      script.onerror = () => { clearTimeout(timeout); reject(new Error('Script yüklenemedi')); };
      document.head.appendChild(script);
    });
    if (!data || !data.exams) { toast('Drive\'da geçerli yedek bulunamadı', 'error'); return; }
    if (data.exams) state.exams = data.exams;
    if (data.schools) state.schools = data.schools;
    if (data.categories && data.categories.length) state.categories = data.categories;
    if (data.payments) state.payments = data.payments;
    if (data.publishers) state.publishers = data.publishers;
    if (data.periods) state.periods = data.periods;
    if (data.catalogItems) state.catalogItems = data.catalogItems;
    await saveAll();
    renderAll();
    toast('✅ Drive\'dan geri yüklendi!', 'success');
  } catch (err) {
    toast('❌ ' + err.message, 'error');
  }
}


// ===== MODAL HELPERS =====
function openModal(html) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  box.innerHTML = html;
  overlay.classList.remove('hidden');

  // Auto-wire close buttons
  const closeBtn = box.querySelector('#closeModal');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  const cancelBtn = box.querySelector('#cancelModal');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('modalBox').innerHTML = '';
}

// ===== HELPERS =====
function getCatById(id) {
  return state.categories.find(c => c.id === id);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function toDateStr(y, m, d) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}


// ============================================================
// ===== CATALOG VIEW (Deneme → Okul Takvimleri) =====
// ============================================================

let catalogView = 'list'; // 'list' | 'catalog'
let catalogSubView = 'exams'; // 'exams' | 'publishers'
let catalogSearch = '';
let catalogFilterCat = '';
let catalogFilterMonth = '';
let catalogPubFilter = ''; // publisher name filter when drilling into a publisher

function setupCatalogListeners() {
  // Layout toggle: card / table
  document.getElementById('btnLayoutCard')?.addEventListener('click', () => {
    document.getElementById('examList').classList.remove('table-mode');
    document.getElementById('btnLayoutCard').classList.add('active');
    document.getElementById('btnLayoutTable').classList.remove('active');
    localStorage.setItem('examLayout', 'card');
    renderExamList();
  });
  document.getElementById('btnLayoutTable')?.addEventListener('click', () => {
    document.getElementById('examList').classList.add('table-mode');
    document.getElementById('btnLayoutTable').classList.add('active');
    document.getElementById('btnLayoutCard').classList.remove('active');
    localStorage.setItem('examLayout', 'table');
    renderExamList();
  });
  // Restore saved layout
  if (localStorage.getItem('examLayout') === 'table') {
    document.getElementById('examList')?.classList.add('table-mode');
    document.getElementById('btnLayoutTable')?.classList.add('active');
    document.getElementById('btnLayoutCard')?.classList.remove('active');
  }
  document.getElementById('btnViewList').addEventListener('click', () => switchView('list'));
  document.getElementById('btnViewCatalog').addEventListener('click', () => switchView('catalog'));

  // Catalog sub-view toggle: Denemeler / Yayınevleri
  document.getElementById('btnCatalogByExam').addEventListener('click', () => switchCatalogView('exams'));
  document.getElementById('btnCatalogByPub').addEventListener('click', () => switchCatalogView('publishers'));

  const cs = document.getElementById('catalogSearch');
  const csc = document.getElementById('catalogSearchClear');
  if (cs) {
    cs.addEventListener('input', e => {
      catalogSearch = e.target.value;
      csc.classList.toggle('hidden', !e.target.value);
      if (catalogSubView === 'exams') renderCatalog();
      else renderPublisherGrid();
    });
  }
  if (csc) csc.addEventListener('click', () => {
    cs.value = ''; catalogSearch = '';
    csc.classList.add('hidden');
    if (catalogSubView === 'exams') renderCatalog();
    else renderPublisherGrid();
  });

  const catSel = document.getElementById('catalogFilterCat');
  if (catSel) catSel.addEventListener('change', e => {
    catalogFilterCat = e.target.value;
    if (catalogSubView === 'exams') renderCatalog();
    else renderPublisherGrid();
  });

  const monthSel = document.getElementById('catalogFilterMonth');
  if (monthSel) monthSel.addEventListener('change', e => {
    catalogFilterMonth = e.target.value;
    if (catalogSubView === 'exams') renderCatalog();
  });

  const importInput = document.getElementById('btnImportExcel');
  if (importInput) importInput.addEventListener('change', e => { if (e.target.files?.[0]) showImportWizard(e.target.files[0]); e.target.value = ''; });
}

function switchView(view) {
  catalogView = view;
  document.getElementById('listViewSection').classList.toggle('hidden', view !== 'list');
  document.getElementById('catalogViewSection').classList.toggle('hidden', view !== 'catalog');
  document.getElementById('btnViewList').classList.toggle('active', view === 'list');
  document.getElementById('btnViewCatalog').classList.toggle('active', view === 'catalog');
  if (view === 'catalog') {
    populateCatalogFilter();
    switchCatalogView(catalogSubView);
  }
}

function switchCatalogView(subView) {
  catalogSubView = subView;
  catalogPubFilter = '';
  document.getElementById('btnCatalogByExam').classList.toggle('active', subView === 'exams');
  document.getElementById('btnCatalogByPub').classList.toggle('active', subView === 'publishers');
  document.getElementById('catalogList').classList.toggle('hidden', subView !== 'exams');
  document.getElementById('publisherGrid').classList.toggle('hidden', subView !== 'publishers');
  document.getElementById('catalogFilterCat').style.display = subView === 'exams' ? '' : 'none';
  if (subView === 'exams') renderCatalog();
  else renderPublisherGrid();
}

function populateCatalogFilter() {
  const sel = document.getElementById('catalogFilterCat');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">Tüm Kategoriler</option>';
  state.categories.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.name;
    if (c.id === cur) o.selected = true;
    sel.appendChild(o);
  });
}

// Normalize Turkish chars for case-insensitive comparison
// Turkish-safe normalization: convert everything to ASCII equivalents for reliable comparison
// "YARIÇAP" → "yaricap", "İstanbul" → "istanbul", "Ş" → "s" etc.
function trNorm(str) {
  return (str || '').toString()
    .replace(/İ/g, 'I').replace(/ı/g, 'i')   // Turkish dotted/dotless I → Latin I
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c')
    .toLowerCase();
}

// Group exams by their catalog identity = publisher + name (+ examNo if present)
// Key rule: same publisher + same name → same catalog entry (one "product")
// Build catalog groups from catalogItems (imported templates) + exams (assigned)
// Each group = one catalog item + its assigned exams
function groupExamsByCatalog() {
  const groups = new Map();

  // 1. Start with catalogItems (imported templates, not yet in list)
  state.catalogItems.forEach(item => {
    const key = item.id; // catalog items have their own stable ID
    const pub = state.publishers.find(p => p.id === item.publisherId);
    groups.set(key, {
      key,
      catalogItemId: item.id,
      name: item.name,
      publisherId: item.publisherId || '',
      publisherName: pub?.name || item.publisherName || '',
      categoryIds: item.categoryIds?.length > 0 ? item.categoryIds : (item.categoryId ? [item.categoryId] : []),
      type: item.type || '',
      stockDate: item.stockDate || '',
      applicationDate: item.applicationDate || '',
      periodId: item.periodId || '',
      exams: [],       // assigned school-exams from state.exams
      fromCatalog: true,
    });
  });

  // 2. Also include exams NOT linked to any catalog item (manually added)
  state.exams.forEach(exam => {
    if (exam.catalogItemId && groups.has(exam.catalogItemId)) {
      // Linked to catalog item — attach
      groups.get(exam.catalogItemId).exams.push(exam);
    } else if (!exam.catalogItemId) {
      // Manually added exam — group by publisher+name (legacy behavior)
      const pubId  = exam.publisherId || '';
      const name   = (exam.name || '').trim();
      const key    = pubId ? `manual_${pubId}_${trNorm(name)}` : `manual_nopub_${trNorm(name)}`;
      if (!groups.has(key)) {
        const pub = state.publishers.find(p => p.id === pubId);
        groups.set(key, {
          key,
          catalogItemId: null,
          name,
          publisherId: pubId,
          publisherName: pub?.name || '',
          categoryIds: exam.categoryIds?.length > 0 ? exam.categoryIds : (exam.categoryId ? [exam.categoryId] : []),
          type: exam.type || '',
          stockDate: exam.stockDate || '',
          applicationDate: exam.applicationDate || '',
          periodId: exam.periodId || '',
          exams: [],
          fromCatalog: false,
        });
      }
      const g = groups.get(key);
      (exam.categoryIds?.length > 0 ? exam.categoryIds : (exam.categoryId ? [exam.categoryId] : [])).forEach(id => {
        if (!g.categoryIds.includes(id)) g.categoryIds.push(id);
      });
      if (!g.stockDate && exam.stockDate) g.stockDate = exam.stockDate;
      g.exams.push(exam);
    }
  });

  return Array.from(groups.values());
}

function renderCatalog() {
  const container = document.getElementById('catalogList');
  if (!container) return;

  let groups = groupExamsByCatalog();

  // Search
  if (catalogSearch) {
    const q = trNorm(catalogSearch);
    groups = groups.filter(g =>
      trNorm(g.name).includes(q) ||
      trNorm(g.publisherName).includes(q) ||
      g.categoryIds.some(id => { const c = getCatById(id); return c && trNorm(c.name).includes(q); }) ||
      trNorm(g.type).includes(q)
    );
  }

  // Category filter
  if (catalogFilterCat) {
    groups = groups.filter(g => g.categoryIds.includes(catalogFilterCat));
  }

  // Month filter
  if (catalogFilterMonth) {
    const [type, monthStr] = catalogFilterMonth.split('-');
    const month = parseInt(monthStr);
    groups = groups.filter(g => {
      const dateStr = type === 'stock' ? g.stockDate : g.applicationDate;
      if (!dateStr) return false;
      return new Date(dateStr).getMonth() + 1 === month;
    });
  }

  // Sort: publisher then name
  groups.sort((a, b) => {
    const pa = trNorm(a.publisherName), pb = trNorm(b.publisherName);
    if (pa !== pb) return pa.localeCompare(pb);
    return trNorm(a.name).localeCompare(trNorm(b.name));
  });

  if (groups.length === 0) {
    const msg = catalogSearch ? 'Arama sonucu bulunamadı' :
      '<b>Katalog boş.</b><br><span style="font-size:12px">📥 İçe Aktar ile Excel dosyanızı yükleyin.</span>';
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📚</div>${msg}</div>`;
    return;
  }

  container.innerHTML = '';
  groups.forEach(group => container.appendChild(buildCatalogCard(group)));
}

// Publisher grid: all publishers as tiles, click to filter exams by that publisher
function renderPublisherGrid() {
  const grid = document.getElementById('publisherGrid');
  if (!grid) return;

  if (catalogPubFilter) {
    renderPublisherDetail(catalogPubFilter);
    return;
  }

  // Fuzzy match: find canonical publisher key for any name
  function findPubKey(name, publisherId) {
    // Best: match by publisher ID directly
    if (publisherId) {
      for (const [key, pub] of pubMap) {
        if (pub.id === publisherId) return key;
      }
    }
    const norm = trNorm(name);
    // 1. Exact key match
    if (pubMap.has(norm)) return norm;
    // 2. Short name exact match
    for (const [key, pub] of pubMap) {
      if (pub.short && trNorm(pub.short) === norm) return key;
    }
    // 3. Norm contained in key (minimum 3 chars to avoid false positives)
    for (const [key] of pubMap) {
      if (norm.length >= 3 && key.includes(norm)) return key;
    }
    // 4. Key contained in norm (key minimum 3 chars)
    for (const [key] of pubMap) {
      if (key.length >= 3 && norm.includes(key)) return key;
    }
    return null;
  }

  // Build map from state.publishers (canonical)
  const pubMap = new Map();
  state.publishers.forEach(p => {
    const key = trNorm(p.name);
    if (!pubMap.has(key)) pubMap.set(key, { name: p.name, id: p.id, short: p.short || p.name, examCount: 0, assignedCount: 0 });
  });

  // Count catalog items per canonical publisher
  state.catalogItems.forEach(item => {
    const pubName = item.publisherName || state.publishers.find(p => p.id === item.publisherId)?.name || '';
    if (!pubName && !item.publisherId) return;
    const key = findPubKey(pubName, item.publisherId);
    if (key) { pubMap.get(key).examCount++; }
    else {
      // Orphan — add as its own entry
      const k = item.publisherId ? 'id_' + item.publisherId : trNorm(pubName);
      if (!pubMap.has(k)) pubMap.set(k, { name: pubName || '?', id: item.publisherId||'', short: pubName||'?', examCount: 1, assignedCount: 0 });
      else pubMap.get(k).examCount++;
    }
  });

  // Count assigned exams
  state.exams.forEach(exam => {
    const pubName = state.publishers.find(p => p.id === exam.publisherId)?.name || '';
    if (!pubName) return;
    const key = findPubKey(pubName, exam.publisherId);
    if (key && pubMap.has(key)) pubMap.get(key).assignedCount++;
  });

  let pubs = Array.from(pubMap.values());
  if (catalogSearch) {
    const q = trNorm(catalogSearch);
    pubs = pubs.filter(p => trNorm(p.name).includes(q) || trNorm(p.short||'').includes(q));
  }
  pubs.sort((a, b) => b.examCount - a.examCount || trNorm(a.name).localeCompare(trNorm(b.name)));

  if (pubs.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🏢</div>Yayınevi bulunamadı</div>`;
    return;
  }

  const colors = ['#6c3fff','#ff6b35','#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6',
                  '#06b6d4','#ec4899','#f97316','#84cc16','#14b8a6','#a855f7','#be123c'];
  grid.innerHTML = '';
  pubs.forEach((pub, i) => {
    const color = colors[i % colors.length];
    const displayName = pub.short && pub.short !== pub.name ? pub.short : pub.name;
    const initials = displayName.split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase().slice(0,3);
    const card = document.createElement('div');
    card.className = 'pub-card' + (pub.examCount > 0 ? ' has-exams' : '');
    card.style.borderTopColor = color;
    card.style.borderTopWidth = '3px';
    card.innerHTML = `
      <div class="pub-card-avatar" style="background:${color}">${initials}</div>
      <div class="pub-card-name">${displayName}</div>
      <div class="pub-card-count ${pub.examCount === 0 ? 'zero' : ''}">${pub.examCount > 0 ? pub.examCount + ' deneme' : 'boş'}</div>
      ${pub.assignedCount > 0 ? `<div style="font-size:9px;color:var(--success);font-weight:700">✅ ${pub.assignedCount} listede</div>` : ''}`;
    if (pub.examCount > 0) {
      card.addEventListener('click', () => { catalogPubFilter = pub.name; renderPublisherDetail(pub.name); });
    }
    grid.appendChild(card);
  });
}

function renderPublisherDetail(pubName) {
  const grid = document.getElementById('publisherGrid');
  if (!grid) return;

  // Switch grid to single-column layout for detail view
  grid.style.display = 'flex';
  grid.style.flexDirection = 'column';
  grid.style.gap = '8px';

  const normPub = trNorm(pubName);

  // Find the canonical publisher object for this pubName
  const canonicalPub = state.publishers.find(p =>
    trNorm(p.name) === normPub ||
    (p.short && trNorm(p.short) === normPub)
  );

  // Match a group to this publisher — use ID when possible, otherwise exact name match only
  function pubMatches(group) {
    // Best case: publisher ID matches directly
    if (canonicalPub && group.publisherId === canonicalPub.id) return true;

    const gNorm = trNorm(group.publisherName || '');

    // Exact normalized name match
    if (gNorm === normPub) return true;

    // Publisher short name exact match
    if (canonicalPub?.short && gNorm === trNorm(canonicalPub.short)) return true;

    // Canonical pub name contained in group's publisher name (or vice versa)
    if (canonicalPub) {
      const cnorm = trNorm(canonicalPub.name);
      if (gNorm === cnorm) return true;
      if (gNorm.includes(cnorm) && cnorm.length >= 3) return true;
      if (cnorm.includes(gNorm) && gNorm.length >= 3) return true;
    }

    // Last resort: group pub name contains our search name exactly
    if (gNorm.includes(normPub) && normPub.length >= 3) return true;
    if (normPub.includes(gNorm) && gNorm.length >= 3) return true;

    return false;
  }

  const items = groupExamsByCatalog().filter(g => pubMatches(g));

  // Display short name if available
  const pub = state.publishers.find(p => trNorm(p.name) === normPub);
  const displayName = pub?.short && pub.short !== pub.name ? pub.short : pubName;

  grid.innerHTML = `
    <div class="pub-detail-header">
      <button class="btn-back" id="btnBackToPubGrid">← Yayınevleri</button>
      <div class="pub-detail-title">${displayName}</div>
      <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${items.length} deneme</span>
    </div>
    <div id="pubDetailList" style="display:flex;flex-direction:column;gap:8px"></div>`;

  grid.classList.remove('hidden');
  document.getElementById('catalogList').classList.add('hidden');

  document.getElementById('btnBackToPubGrid').addEventListener('click', () => {
    catalogPubFilter = '';
    // Restore grid layout
    grid.style.display = '';
    grid.style.flexDirection = '';
    grid.style.gap = '';
    renderPublisherGrid();
  });

  const list = document.getElementById('pubDetailList');
  if (items.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div>Bu yayınevine ait deneme bulunamadı</div>`;
    return;
  }
  items.sort((a, b) => (a.stockDate||'').localeCompare(b.stockDate||''));
  items.forEach(group => list.appendChild(buildCatalogCard(group)));
}

function buildCatalogCard(group) {
  const assignedCount = group.exams.length;
  const appliedCount  = group.exams.filter(e => e.status === 'applied').length;
  const hasSchools    = assignedCount > 0;

  // Get short publisher name for display
  const pub = state.publishers.find(p => p.id === group.publisherId);
  const pubShort = pub?.short && pub.short !== pub.name ? pub.short : group.publisherName;

  const catBadges = group.categoryIds
    .map(id => { const c = getCatById(id); return c ? `<span class="badge" style="background:${c.color}22;color:${c.color};font-size:9px;padding:1px 5px">${c.name}</span>` : ''; })
    .join('');

  // School chips — compact
  const schoolChips = group.exams.slice(0, 3).map(e => {
    const school = state.schools.find(s => s.id === e.schoolId);
    const chipColor = school?.color || 'var(--primary)';
    const cls = e.status === 'applied' ? 'school-chip applied' :
                !e.applicationDate ? 'school-chip no-date' : 'school-chip';
    const dateStr = e.applicationDate ? formatDate(e.applicationDate) : 'tarih yok';
    const shortName = (e.schoolName || '?').replace(/ (ANADOLU|ORTAOKULU|LİSESİ|MESLEKİ|TEKNİK|İMAM|HATİP|FEN|ÖZEL).*/i, '');
    return `<span class="${cls}" style="background:${chipColor}22;color:${chipColor};border:1px solid ${chipColor}44">${shortName} • ${dateStr}</span>`;
  }).join('');
  const moreChips = group.exams.length > 3
    ? `<span class="school-chip" style="background:#f3f0ff;color:var(--primary)">+${group.exams.length - 3}</span>` : '';

  const hasAnswerKey = !!(group.catalogItemId && state.catalogItems.find(i => i.id === group.catalogItemId)?.answerKeyName);

  const card = document.createElement('div');
  card.className = 'catalog-card';
  card.style.borderLeftColor = hasSchools ? '#10b981' : '#d1d5db';
  if (!hasSchools) card.style.opacity = '0.82';

  card.innerHTML = `
    <div class="cc-top">
      <div class="cc-name">${group.name}</div>
      <div class="cc-badges">
        ${catBadges}
        ${group.type ? `<span class="badge badge-type-${group.type.toLowerCase()}" style="font-size:9px;padding:1px 5px">${group.type}</span>` : ''}
      </div>
    </div>
    <div class="cc-meta">
      ${pubShort ? `<span class="cc-pub">📚 ${pubShort}</span>` : ''}
      ${group.stockDate ? `<span class="cc-date">📦 ${formatDate(group.stockDate)}</span>` : ''}
      ${group.applicationDate ? `<span class="cc-date">🎯 ${formatDate(group.applicationDate)}</span>` : ''}
    </div>
    <div class="cc-status-row">
      ${hasSchools
        ? `<span class="cat-status-badge cat-status-listed">✅ ${assignedCount} okul • ${appliedCount} uygulandı</span>`
        : `<span class="cat-status-badge cat-status-catalog">📋 Katalogda</span>`}
      ${hasAnswerKey ? `<span class="cat-status-badge" style="background:#eff6ff;color:#1d4ed8">📄 AK</span>` : ''}
    </div>
    ${hasSchools ? `<div class="cc-chips">${schoolChips}${moreChips}</div>` : ''}
    <div class="cc-actions">
      ${hasSchools ? `<button class="btn-xs btn-edit btn-schedule">📅</button>` : ''}
      <button class="btn-xs btn-gcal btn-add-school-to-list">🏫 Okul Ekle</button>
      <button class="btn-xs btn-edit btn-bulk-add-schools" title="Birden fazla okul ekle">🏫+ Toplu</button>
      <button class="btn-xs btn-copy btn-upload-ak">📄 Cevap Anahtarı</button>
      <button class="btn-xs btn-copy btn-edit-catalog">✏️</button>
      ${group.fromCatalog ? `<button class="btn-xs btn-delete btn-delete-catalog">🗑️</button>` : ''}
    </div>`;

  if (hasSchools) {
    card.querySelector('.btn-schedule').addEventListener('click', e => { e.stopPropagation(); openScheduleModal(group); });
  }
  card.querySelector('.btn-add-school-to-list').addEventListener('click', e => { e.stopPropagation(); openAddSchoolToListModal(group); });
  card.querySelector('.btn-bulk-add-schools').addEventListener('click', e => { e.stopPropagation(); openBulkAddSchoolsModal(group); });
  card.querySelector('.btn-edit-catalog').addEventListener('click', e => { e.stopPropagation(); openCatalogItemEditModal(group); });
  card.querySelector('.btn-upload-ak').addEventListener('click', e => { e.stopPropagation(); openAnswerKeyModal(group); });
  card.addEventListener('click', () => { if (hasSchools) openScheduleModal(group); else openAddSchoolToListModal(group); });

  const delBtn = card.querySelector('.btn-delete-catalog');
  if (delBtn) {
    delBtn.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm(`"${group.name}" kataloğdan silinsin mi?\n(Listeye eklenmiş okullar etkilenmez)`)) return;
      state.catalogItems = state.catalogItems.filter(i => i.id !== group.catalogItemId);
      await saveData('catalogItems');
      renderCatalog();
      toast('🗑️ Katalog kaydı silindi', 'success');
    });
  }

  return card;
}

// Edit a catalog item template
function openCatalogItemEditModal(group) {
  const item = group.catalogItemId
    ? state.catalogItems.find(i => i.id === group.catalogItemId)
    : null;

  const catCheckboxes = state.categories.map(c =>
    `<label class="cat-checkbox-item" style="--cat-color:${c.color}">
      <input type="checkbox" class="cat-cb" value="${c.id}" data-name="${c.name}" data-color="${c.color}"
        ${group.categoryIds.includes(c.id) ? 'checked' : ''}>
      <span class="cat-cb-label">${c.name}</span>
    </label>`).join('');

  const pubOptions = state.publishers.map(p =>
    `<option value="${p.id}" ${group.publisherId === p.id ? 'selected' : ''}>${p.name}</option>`).join('');

  const html = `
    <div class="modal-title">✏️ Katalog Kaydını Düzenle <button class="modal-close" id="closeModal">×</button></div>
    <div class="form-group">
      <label class="form-label">Deneme Adı</label>
      <input type="text" id="ciName" class="form-input" value="${group.name}">
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">📚 Yayınevi</label>
        <select id="ciPub" class="form-select"><option value="">Seçin...</option>${pubOptions}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Türü</label>
        <div class="type-selector">
          <button class="type-btn ${group.type==='Tarama'?'active-tarama':''}" data-type="Tarama">📋 Tarama</button>
          <button class="type-btn ${group.type==='Genel'?'active-genel':''}" data-type="Genel">📘 Genel</button>
          <button class="type-btn ${group.type==='TG'?'active-tg':''}" data-type="TG">⭐ TG</button>
        </div>
        <input type="hidden" id="ciType" value="${group.type}">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Kategori</label>
      <div class="cat-checkboxes">${catCheckboxes}</div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">📦 Stok Tarihi</label>
        <input type="date" id="ciStock" class="form-input" value="${group.stockDate || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">🎯 Uygulama Tarihi</label>
        <input type="date" id="ciApp" class="form-input" value="${group.applicationDate || ''}">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">İptal</button>
      <button class="btn-primary" id="btnSaveCatalogItem">💾 Kaydet</button>
    </div>`;

  openModal(html);

  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.className = 'type-btn');
      btn.classList.add(`active-${btn.dataset.type.toLowerCase()}`);
      document.getElementById('ciType').value = btn.dataset.type;
    });
  });

  document.getElementById('btnSaveCatalogItem').addEventListener('click', async () => {
    const name  = document.getElementById('ciName').value.trim();
    if (!name) { toast('Ad boş olamaz', 'error'); return; }
    const catIds = [...document.querySelectorAll('.cat-cb:checked')].map(c => c.value);
    const type   = document.getElementById('ciType').value;
    const pubId  = document.getElementById('ciPub').value;
    const stock  = document.getElementById('ciStock').value;
    const app    = document.getElementById('ciApp').value;

    if (item) {
      // Update catalog item
      const idx = state.catalogItems.findIndex(i => i.id === item.id);
      if (idx !== -1) {
        const newPubName = state.publishers.find(p => p.id === pubId)?.name || state.catalogItems[idx].publisherName || '';
        state.catalogItems[idx] = {
          ...state.catalogItems[idx],
          name, categoryIds: catIds, categoryId: catIds[0] || '',
          categoryNames: catIds.map(id => getCatById(id)?.name || '').join(', '),
          type, publisherId: pubId, publisherName: newPubName, stockDate: stock, applicationDate: app,
        };
        await saveData('catalogItems');
      }
    }
    // Also update linked exams' template fields
    const updatedPubName = state.publishers.find(p => p.id === pubId)?.name || '';
    state.exams.forEach((exam, i) => {
      if (exam.catalogItemId === group.catalogItemId) {
        state.exams[i] = { ...state.exams[i], name, type, publisherId: pubId,
          publisherName: updatedPubName || exam.publisherName,
          categoryIds: catIds, categoryId: catIds[0] || '',
          categoryNames: catIds.map(id => getCatById(id)?.name || '').join(', '),
        };
      }
    });
    await saveData('exams');

    closeModal();
    renderAll();
    toast('✅ Güncellendi', 'success');
  });
}

// Add a school to a catalog item → creates actual exam in state.exams
function openAddSchoolToListModal(group) {
  const schoolOptions = state.schools
    .map(s => {
      const alreadyAdded = group.exams.some(e => e.schoolId === s.id);
      return `<option value="${s.id}" ${alreadyAdded ? 'disabled style="color:var(--text-muted)"' : ''}>${s.name}${alreadyAdded ? ' (zaten ekli)' : ''}</option>`;
    }).join('');

  const periodOptions = state.periods.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const catBadges = group.categoryIds.map(id => { const c = getCatById(id); return c ? `<span class="badge" style="background:${c.color}22;color:${c.color}">${c.name}</span>` : ''; }).join(' ');

  const html = `
    <div class="modal-title">🏫 Okul Ekle → Listeye Al <button class="modal-close" id="closeModal">×</button></div>

    <div style="background:var(--bg);border-radius:8px;padding:10px 12px;margin-bottom:12px">
      <div style="font-weight:800;font-size:13px;margin-bottom:4px">${group.name}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        ${catBadges}
        ${group.type ? `<span class="badge badge-type-${group.type.toLowerCase()}">${group.type}</span>` : ''}
        ${group.publisherName ? `<span style="font-size:11px;color:var(--text-muted)">📚 ${group.publisherName}</span>` : ''}
        ${group.stockDate ? `<span style="font-size:11px;color:var(--text-muted)">📦 ${formatDate(group.stockDate)}</span>` : ''}
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Okul <span style="color:var(--danger)">*</span></label>
      <select id="atSchool" class="form-select">
        <option value="">Okul seçin...</option>${schoolOptions}
      </select>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">📦 Stok Tarihi</label>
        <input type="date" id="atStock" class="form-input" value="${group.stockDate || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">🎯 Uygulama Tarihi</label>
        <input type="date" id="atApp" class="form-input" value="${group.applicationDate || ''}">
      </div>
    </div>

    <!-- Kategori bazlı adet tablosu -->
    <div class="form-group" id="catBreakdownSection" style="display:none">
      <label class="form-label">📊 Kategori Bazlı Adet</label>
      <div id="catBreakdownTable" class="cat-breakdown-table"></div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Toplam Adet <span style="font-size:10px;color:var(--text-muted)">(otomatik)</span></label>
        <input type="number" id="atQty" class="form-input" placeholder="0" min="1" style="font-weight:800;font-size:15px">
      </div>
      <div class="form-group">
        <label class="form-label">Birim Fiyat (₺)</label>
        <input type="number" id="atUnit" class="form-input" placeholder="0">
      </div>
    </div>
    <div id="atPriceTotal" style="display:none;text-align:right;font-size:13px;font-weight:800;color:var(--primary);margin-top:-8px;margin-bottom:10px"></div>

    ${state.periods.length > 0 ? `
    <div class="form-group">
      <label class="form-label">Dönem</label>
      <select id="atPeriod" class="form-select"><option value="">Seçme</option>${periodOptions}</select>
    </div>` : ''}
    <label class="gcal-toggle"><input type="checkbox" id="atGcal"> Google Takvim'e de ekle</label>
    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">İptal</button>
      <button class="btn-primary" id="btnAddToList">✅ Listeye Ekle</button>
    </div>`;

  openModal(html);

  // Build breakdown table for a school
  function buildBreakdown(school) {
    const sc = school?.studentCounts || {};
    const catBreakSection = document.getElementById('catBreakdownSection');
    const tableEl = document.getElementById('catBreakdownTable');

    // Only show breakdown if school has student counts for relevant categories
    const relevantCats = group.categoryIds.filter(id => id in sc || sc[id] > 0);
    const hasCounts = Object.keys(sc).some(k => sc[k] > 0);

    if (!hasCounts) {
      catBreakSection.style.display = 'none';
      return;
    }

    catBreakSection.style.display = '';
    const rows = group.categoryIds.map(id => {
      const cat = getCatById(id);
      const studentCount = sc[id] || 0;
      return `
        <div class="cat-breakdown-row" data-cat="${id}">
          <div class="cat-breakdown-label">
            <span class="badge" style="background:${cat?.color||'#aaa'}22;color:${cat?.color||'#aaa'}">${cat?.name || id}</span>
          </div>
          <div class="cat-breakdown-students">
            <span style="font-size:11px;color:var(--text-muted)">👨‍🎓 ${studentCount} öğrenci</span>
          </div>
          <div class="cat-breakdown-qty">
            <input type="number" class="input-sm cat-qty-input" data-cat="${id}"
              value="${studentCount}" min="0" style="width:72px;text-align:center;font-weight:700">
          </div>
        </div>`;
    }).join('');

    tableEl.innerHTML = rows + `
      <div class="cat-breakdown-total">
        <span style="font-weight:800">Toplam</span>
        <span id="catBreakdownSum" style="font-weight:900;color:var(--primary);font-size:15px">0</span>
        <span style="font-size:11px;color:var(--text-muted)">adet</span>
      </div>`;

    // Sync cat inputs → total qty
    function syncTotal() {
      const total = [...document.querySelectorAll('.cat-qty-input')]
        .reduce((sum, inp) => sum + (Number(inp.value) || 0), 0);
      document.getElementById('catBreakdownSum').textContent = total;
      document.getElementById('atQty').value = total || '';
      updatePriceTotal();
    }

    document.querySelectorAll('.cat-qty-input').forEach(inp => {
      inp.addEventListener('input', syncTotal);
    });
    syncTotal();
  }

  function updatePriceTotal() {
    const qty = Number(document.getElementById('atQty').value) || 0;
    const unit = Number(document.getElementById('atUnit').value) || 0;
    const el = document.getElementById('atPriceTotal');
    if (qty && unit) {
      el.style.display = '';
      el.textContent = `💰 ${qty} × ${unit.toLocaleString('tr-TR')} ₺ = ${(qty * unit).toLocaleString('tr-TR')} ₺`;
    } else {
      el.style.display = 'none';
    }
  }

  document.getElementById('atQty').addEventListener('input', updatePriceTotal);
  document.getElementById('atUnit').addEventListener('input', updatePriceTotal);

  document.getElementById('atSchool').addEventListener('change', e => {
    const school = state.schools.find(s => s.id === e.target.value);
    buildBreakdown(school);
    if (school?.studentCounts) {
      const total = group.categoryIds.reduce((sum, id) => sum + (school.studentCounts[id] || 0), 0);
      if (total > 0) document.getElementById('atQty').value = total;
      updatePriceTotal();
    }
  });

  document.getElementById('btnAddToList').addEventListener('click', async () => {
    const schoolId = document.getElementById('atSchool').value;
    if (!schoolId) { toast('Okul seçin', 'error'); return; }
    const school    = state.schools.find(s => s.id === schoolId);
    const qty       = Number(document.getElementById('atQty').value) || null;
    const unitPrice = Number(document.getElementById('atUnit').value) || null;
    const stockDate = document.getElementById('atStock').value || group.stockDate || '';
    const appDate   = document.getElementById('atApp').value || group.applicationDate || '';
    const periodId  = document.getElementById('atPeriod')?.value || group.periodId || '';
    const addGcal   = document.getElementById('atGcal').checked;

    // Collect per-category breakdown
    const categoryBreakdown = {};
    document.querySelectorAll('.cat-qty-input').forEach(inp => {
      const v = Number(inp.value) || 0;
      if (v > 0) categoryBreakdown[inp.dataset.cat] = v;
    });

    const newExam = {
      id: genId(),
      catalogItemId: group.catalogItemId || null,
      name: group.name,
      categoryId: group.categoryIds[0] || '',
      categoryIds: group.categoryIds,
      categoryNames: group.categoryIds.map(id => getCatById(id)?.name || '').join(', '),
      type: group.type,
      publisherId: group.publisherId,
      publisherName: group.publisherName || '',
      examNo: '',
      stockDate,
      applicationDate: appDate,
      periodId,
      schoolId: school.id,
      schoolName: school.name,
      price: qty && unitPrice ? qty * unitPrice : 0,
      qty, unitPrice,
      categoryBreakdown,
      trackingNumber: '',
      status: 'ordered', applied: false,
      notes: [], gcalAdded: false, gcalEventIds: [],
    };

    state.exams.push(newExam);
    await saveData('exams');

    if (addGcal) { closeModal(); await addToGoogleCalendar(newExam); }
    else closeModal();

    renderAll();
    toast(`✅ "${school.name}" listeye eklendi — ${qty || 0} adet`, 'success');
    triggerBadgeUpdate();
  });
}



// ===== SCHEDULE MODAL =====
function openScheduleModal(group) {
  const catBadges = group.categoryIds
    .map(id => { const c = getCatById(id); return c ? `<span class="badge" style="background:${c.color}22;color:${c.color};font-size:10px">${c.name}</span>` : ''; }).join(' ');

  function buildTable() {
    if (group.exams.length === 0) {
      return `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">
        Henüz okul atanmamış. "Okul Ekle" butonunu kullanın.
      </div>`;
    }

    const rows = [...group.exams]
      .sort((a, b) => (a.applicationDate || '').localeCompare(b.applicationDate || ''))
      .map(exam => {
        const sc = STATUS_CONFIG[exam.status || 'ordered'];
        return `<tr data-id="${exam.id}">
          <td style="font-weight:600;color:var(--text)">${exam.schoolName || '<span style="color:var(--text-muted)">—</span>'}</td>
          <td><input type="date" class="input-date sched-stock" data-id="${exam.id}" value="${exam.stockDate || ''}"></td>
          <td><input type="date" class="input-date sched-app" data-id="${exam.id}" value="${exam.applicationDate || ''}"></td>
          <td style="text-align:center">
            <span class="status-badge" style="background:${sc.color}22;color:${sc.color};font-size:10px;padding:3px 7px;border-radius:10px">${sc.short}</span>
          </td>
          <td style="text-align:center">
            <button class="btn-xs btn-delete sched-del" data-id="${exam.id}" style="padding:2px 7px">🗑️</button>
          </td>
        </tr>`;
      }).join('');

    return `<div style="overflow-x:auto">
      <table class="schedule-table">
        <thead>
          <tr>
            <th>Okul</th>
            <th>Stok Tarihi</th>
            <th>Uygulama Tarihi</th>
            <th style="text-align:center">Durum</th>
            <th style="text-align:center">Sil</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  }

  const schoolOptions = state.schools
    .filter(s => !group.exams.some(e => e.schoolId === s.id))
    .map(s => `<option value="${s.id}">${s.name}</option>`).join('');

  const html = `
    <div class="modal-title">
      📅 Okul Takvimleri — ${group.name}
      <button class="modal-close" id="closeModal">×</button>
    </div>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      ${catBadges}
      ${group.type ? `<span class="badge badge-type-${group.type.toLowerCase()}">${group.type}</span>` : ''}
      ${group.publisherName ? `<span style="font-size:11px;color:var(--text-muted)">📚 ${group.publisherName}</span>` : ''}
      ${group.stockDate ? `<span style="font-size:11px;color:var(--text-muted)">📦 Stok: ${formatDate(group.stockDate)}</span>` : ''}
    </div>

    <div id="scheduleTableContainer">${buildTable()}</div>

    ${state.schools.filter(s => !group.exams.some(e => e.schoolId === s.id)).length > 0 ? `
    <div class="add-school-row" style="margin-top:10px">
      <select id="newSchedSchool" class="filter-select" style="flex:1">
        <option value="">Okul seçin...</option>${schoolOptions}
      </select>
      <input type="date" id="newSchedStock" class="input-sm" style="width:140px" placeholder="Stok">
      <input type="date" id="newSchedApp" class="input-sm" style="width:140px" placeholder="Uygulama">
      <button class="btn-success btn-sm" id="btnAddSchedSchool">+ Ekle</button>
    </div>` : `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;text-align:center">Tüm okullar bu denemeye atanmış.</div>`}

    <div class="modal-footer" style="margin-top:12px">
      <button class="btn-secondary" id="cancelModal">Kapat</button>
      <button class="btn-primary" id="btnSaveSchedule">💾 Tarihleri Kaydet</button>
    </div>`;

  openModal(html);

  // Date change listeners — auto save on change
  attachScheduleListeners(group);

  // Add school to schedule
  const addBtn = document.getElementById('btnAddSchedSchool');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const schoolId = document.getElementById('newSchedSchool')?.value;
      if (!schoolId) { toast('Okul seçin', 'error'); return; }
      const school = state.schools.find(s => s.id === schoolId);
      if (!school) return;

      const stockDate = document.getElementById('newSchedStock')?.value || '';
      const appDate = document.getElementById('newSchedApp')?.value || '';

      // Create new exam record for this school (copy from group template)
      const template = group.exams[0];
      const newExam = {
        id: genId(),
        name: group.name,
        categoryId: template?.categoryId || group.categoryIds[0] || '',
        categoryIds: group.categoryIds,
        categoryNames: group.categoryIds.map(id => getCatById(id)?.name || '').join(', '),
        type: group.type,
        publisherId: group.publisherId,
      publisherName: group.publisherName || '',
        examNo: template?.examNo || '',
        stockDate: stockDate || group.stockDate || '',
        applicationDate: appDate,
        periodId: template?.periodId || '',
        schoolId: school.id,
        schoolName: school.name,
        price: 0, qty: null, unitPrice: null,
        status: 'ordered', applied: false,
        notes: [], gcalAdded: false, gcalEventIds: [],
        trackingNumber: ''
      };

      state.exams.push(newExam);
      await saveData('exams');
      toast(`🏫 ${school.name} eklendi`, 'success');

      // Refresh group data and reopen
      const updatedGroups = groupExamsByCatalog();
      const updatedGroup = updatedGroups.find(g => g.key === group.key) ||
                           updatedGroups.find(g => trNorm(g.name) === trNorm(group.name) && g.publisherId === group.publisherId);
      if (updatedGroup) {
        group.exams = updatedGroup.exams;
        openScheduleModal(group);
      }
      renderCatalog();
    });
  }

  // Save all date changes
  document.getElementById('btnSaveSchedule').addEventListener('click', async () => {
    let changed = false;
    document.querySelectorAll('.sched-stock').forEach(inp => {
      const idx = state.exams.findIndex(e => e.id === inp.dataset.id);
      if (idx !== -1 && state.exams[idx].stockDate !== inp.value) {
        state.exams[idx].stockDate = inp.value; changed = true;
      }
    });
    document.querySelectorAll('.sched-app').forEach(inp => {
      const idx = state.exams.findIndex(e => e.id === inp.dataset.id);
      if (idx !== -1 && state.exams[idx].applicationDate !== inp.value) {
        state.exams[idx].applicationDate = inp.value; changed = true;
      }
    });
    if (changed) {
      await saveData('exams');
      renderCalendar();
      renderExamList();
      renderCatalog();
      toast('📅 Tarihler kaydedildi', 'success');
    }
    closeModal();
  });
}

function attachScheduleListeners(group) {
  // Delete button
  document.querySelectorAll('.sched-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Bu okulun atamasını kaldırmak istiyor musunuz?')) return;
      const examId = btn.dataset.id;
      const idx = state.exams.findIndex(e => e.id === examId);
      if (idx !== -1) {
        pushHistory(`"${state.exams[idx].schoolName}" – "${group.name}" ataması kaldırıldı`, 'DELETE_EXAM', state.exams[idx]);
        state.exams.splice(idx, 1);
        await saveData('exams');
      }
      const updatedGroups = groupExamsByCatalog();
      const updatedGroup = updatedGroups.find(g => g.key === group.key) ||
                           updatedGroups.find(g => trNorm(g.name) === trNorm(group.name) && g.publisherId === group.publisherId);
      if (updatedGroup) { group.exams = updatedGroup.exams; }
      else { group.exams = []; }
      openScheduleModal(group);
      renderCatalog();
      toast('🗑️ Okul ataması kaldırıldı', 'success');
    });
  });
}

// Quick-add a school to an exam group (simplified)


// ============================================================
// ===== EXCEL / CSV IMPORT =====
// ============================================================

// Turkish month names → month number
const TR_MONTHS = {
  'ocak':1,'şubat':2,'mart':3,'nisan':4,'mayıs':5,'haziran':6,
  'temmuz':7,'ağustos':8,'eylül':9,'ekim':10,'kasım':11,'aralık':12
};

// Parse any date format including Turkish long dates and ranges
function parseDateSmart(str) {
  if (!str) return '';
  str = str.trim();

  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // MM/DD/YYYY (US format like "7/14/2025")
  const usDate = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usDate) return `${usDate[3]}-${usDate[1].padStart(2,'0')}-${usDate[2].padStart(2,'0')}`;

  // DD.MM.YYYY or DD-MM-YYYY (European)
  const dotDate = str.match(/^(\d{1,2})[.](\d{1,2})[.](\d{4})$/);
  if (dotDate) return `${dotDate[3]}-${dotDate[2].padStart(2,'0')}-${dotDate[1].padStart(2,'0')}`;

  // Normalize Turkish chars BEFORE toLowerCase (İ → i must happen first)
  const lower = str
    .replace(/İ/g, 'i').replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü').replace(/Ş/g, 'ş')
    .replace(/Ö/g, 'ö').replace(/Ç/g, 'ç')
    .toLowerCase();

  // Turkish long format: "Pazartesi, Temmuz 07, 2025" or "Cuma, Ağustos 01, 2025"
  // Pattern: [dayname,] MONTH DAY, YEAR
  const trLong = lower.match(/(?:[a-zğüşıöç]+,?\s+)?([a-zğüşıöç]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (trLong) {
    const month = TR_MONTHS[trLong[1]];
    if (month) return `${trLong[3]}-${String(month).padStart(2,'0')}-${trLong[2].padStart(2,'0')}`;
  }

  // Range same month: "8-11 AĞUSTOS 2025" → take start day
  const rangeSameMonth = lower.match(/^(\d{1,2})[-–]\d{1,2}\s+([a-zğüşıöç]+)\s+(\d{4})$/);
  if (rangeSameMonth) {
    const month = TR_MONTHS[rangeSameMonth[2]];
    if (month) return `${rangeSameMonth[3]}-${String(month).padStart(2,'0')}-${rangeSameMonth[1].padStart(2,'0')}`;
  }

  // Cross-month range: "29 AĞUSTOS-1 EYLÜL 2025" → take start
  const rangeCrossMonth = lower.match(/^(\d{1,2})\s+([a-zğüşıöç]+)[-–]\d{1,2}\s+[a-zğüşıöç]+\s+(\d{4})$/);
  if (rangeCrossMonth) {
    const month = TR_MONTHS[rangeCrossMonth[2]];
    if (month) return `${rangeCrossMonth[3]}-${String(month).padStart(2,'0')}-${rangeCrossMonth[1].padStart(2,'0')}`;
  }

  // Day + Turkish month + year: "07 Temmuz 2025"
  const trShort = lower.match(/^(\d{1,2})\s+([a-zğüşıöç]+)\s+(\d{4})$/);
  if (trShort) {
    const month = TR_MONTHS[trShort[2]];
    if (month) return `${trShort[3]}-${String(month).padStart(2,'0')}-${trShort[1].padStart(2,'0')}`;
  }

  return '';
}

// Map DÜZEY column to one or more category IDs
// Examples: "TYT" → ['TYT'], "AYT" → ['AYT'], "TYT-AYT" → ['TYT','AYT'],
//           "9-10-11. SINIF" → ['S9','S10','S11'], "TYT AYT" → ['TYT','AYT']
function mapDuzeyToCategories(str) {
  if (!str) return [];
  const s = str.toUpperCase().trim();
  const result = [];

  // TYT-AYT combo
  if (s.includes('TYT') && s.includes('AYT')) {
    result.push('TYT', 'AYT');
    return result;
  }
  if (s === 'TYT') return ['TYT'];
  if (s === 'AYT') return ['AYT'];

  // Sınıf patterns: "9-10-11. SINIF", "9. SINIF", "5-6. SINIF" etc.
  const sinifMatches = s.matchAll(/(\d{1,2})/g);
  for (const m of sinifMatches) {
    const n = parseInt(m[1]);
    if (n >= 5 && n <= 12) result.push(`S${n}`);
  }
  if (result.length > 0) return result;

  // Fallback: try to match against existing categories by name
  const found = state.categories.find(c =>
    c.name.toUpperCase() === s || c.id.toUpperCase() === s
  );
  if (found) return [found.id];

  return [];
}

// Map KAPSAM / DENEME TÜRÜ to our type field
function mapKapsamToType(kapsam, denemeTuru) {
  const k = (kapsam || '').toUpperCase().trim();
  const d = (denemeTuru || '').toUpperCase().trim();
  if (k.includes('TARAMA') || d.includes('TARAMA')) return 'Tarama';
  if (k === 'TG' || d === 'TG') return 'TG';
  if (d.includes('TÜRKİYE') || d.includes('TURKIYE')) return 'TG';
  if (k.includes('GENEL') || d.includes('TAKVİM') || d.includes('KULÜB')) return 'Genel';
  return 'Genel';
}

function showImportWizard(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  if (ext === 'xlsx' || ext === 'xls') {
    reader.readAsArrayBuffer(file);
    reader.onload = e => parseXLSX(e.target.result, file.name); // parseXLSX is async, fire & forget is fine
  } else {
    reader.readAsText(file, 'UTF-8');
    reader.onload = e => {
      const text = e.target.result;
      const firstLine = text.split('\n')[0];
      const sep = firstLine.includes('\t') ? '\t' :
                  firstLine.includes(';') ? ';' : ',';
      const rows = parseCSVText(text, sep);
      openImportWizardModal(rows, file.name);
    };
  }
}

function parseCSVText(text, sep = ',') {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    // Handle quoted fields
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; }
      else if (line[i] === sep && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += line[i]; }
    }
    result.push(cur.trim());
    return result;
  });
}

// XLSX parsing is handled by xlsx-parser.js (loaded before popup.js)
// Thin wrapper that calls xlsxToRows() from xlsx-parser.js
async function parseXLSX(buffer, filename) {
  try {
    const rows = await xlsxToRows(buffer);
    if (!rows || rows.length < 2) {
      toast('Dosyada veri bulunamadı.', 'error', 4000);
      return;
    }
    openImportWizardModal(rows, filename);
  } catch (err) {
    console.error('XLSX error:', err);
    toast('XLSX okunamadı: ' + err.message, 'error', 5000);
  }
}

// ===== IMPORT WIZARD MODAL =====
function openImportWizardModal(rows, filename) {
  if (!rows || rows.length < 2) {
    toast('Dosyada yeterli veri bulunamadı (en az 1 başlık + 1 veri satırı)', 'error');
    return;
  }

  const headers = rows[0].map((h, i) => ({ label: (h || `Sütun ${i+1}`).trim(), index: i }));
  const dataRows = rows.slice(1).filter(r => r.some(v => v?.toString().trim()));

  // --- Auto-detect columns by exact Turkish header names first, then fuzzy ---
  function findCol(candidates) {
    // Exact match first
    let idx = headers.findIndex(h => candidates.some(c => h.label.toUpperCase() === c.toUpperCase()));
    if (idx >= 0) return idx;
    // Partial match
    idx = headers.findIndex(h => candidates.some(c => h.label.toUpperCase().includes(c.toUpperCase()) || c.toUpperCase().includes(h.label.toUpperCase())));
    return idx >= 0 ? idx : '';
  }

  const autoMap = {
    stockDate: findCol(['STOK TARİHİ','STOK','STOCK']),
    appDate:   findCol(['UYGULAMA TARİHİ','UYGULAMA','APPLICATION','APP']),
    publisher: findCol(['YAYINEVİ','YAYINCI','PUBLISHER','YAYINEVI']),
    examType:  findCol(['DENEME TÜRÜ','DENEME TURU','EXAM TYPE','TÜR','TUR']),
    category:  findCol(['DÜZEY','DUZEY','KATEGORİ','KATEGORI','LEVEL','SINIF']),
    name:      findCol(['DENEME ADI','DENEME ISMI','ADI','NAME','BASLIK','BAŞLIK']),
    scope:     findCol(['KAPSAM','SCOPE','TİP','TIP','TYPE']),
    price:     findCol(['FİYAT','FIYAT','PRICE','ÜCRET','UCRET','TUTAR']),
  };

  // Build column selector HTML
  function colSelect(fieldKey, label, required = false) {
    const val = autoMap[fieldKey];
    const detected = val !== '' ? `<span style="color:#10b981;font-size:9px;margin-left:4px">✓ otomatik</span>` : '';
    return `
      <div class="col-map-label">${label}${required ? ' <span style="color:#ef4444">*</span>' : ''}${detected}</div>
      <select class="col-map-select col-map" data-field="${fieldKey}">
        <option value="">— Seçme —</option>
        ${headers.map(h => `<option value="${h.index}" ${h.index === val ? 'selected' : ''}>${h.label}</option>`).join('')}
      </select>`;
  }

  // Preview table (first 5 rows)
  const previewHead = headers.map(h => `<th>${h.label}</th>`).join('');
  const previewRows = dataRows.slice(0, 5).map(r =>
    `<tr>${headers.map(h => `<td>${r[h.index] || ''}</td>`).join('')}</tr>`
  ).join('');

  const periodOptions = state.periods.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  // Count how many columns were auto-detected
  const detectedCount = Object.values(autoMap).filter(v => v !== '').length;

  const html = `
    <div class="modal-title">📥 Excel/CSV İçe Aktar <button class="modal-close" id="closeModal">×</button></div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">
      📄 <b>${filename}</b> — ${dataRows.length} satır, ${headers.length} sütun
      ${detectedCount > 0 ? `<span style="color:#10b981;margin-left:8px">✓ ${detectedCount} sütun otomatik tanındı</span>` : ''}
    </div>

    <div class="section-title" style="margin-bottom:8px">1️⃣ Sütun Eşleştirme</div>
    <div class="col-map-grid">
      ${colSelect('stockDate',  '📦 Stok Tarihi', true)}
      ${colSelect('appDate',    '🎯 Uygulama Tarihi')}
      ${colSelect('publisher',  '📚 Yayınevi', true)}
      ${colSelect('name',       '📝 Deneme Adı', true)}
      ${colSelect('category',   '🗂️ Düzey / Kategori')}
      ${colSelect('examType',   '📋 Deneme Türü')}
      ${colSelect('scope',      '🏷️ Kapsam (Genel/Tarama)')}
      ${colSelect('price',      '💰 Fiyat')}
    </div>

    ${state.periods.length > 0 ? `
    <div class="form-group" style="margin-top:10px">
      <label class="form-label">🗓️ Tüm denemeleri bu döneme ekle</label>
      <select id="importPeriod" class="form-select"><option value="">Dönem seçme</option>${periodOptions}</select>
    </div>` : ''}

    <div class="section-title" style="margin-top:12px;margin-bottom:6px">2️⃣ Önizleme — İlk 5 satır</div>
    <div style="overflow-x:auto;max-height:140px;border:1px solid var(--border);border-radius:8px">
      <table class="import-preview-table">
        <thead><tr>${previewHead}</tr></thead>
        <tbody>${previewRows}</tbody>
      </table>
    </div>

    <div id="importSummary" style="margin-top:10px;padding:8px 12px;background:var(--bg);border-radius:8px;font-size:12px;color:var(--text-muted);text-align:center">
      ${dataRows.length} satır içe aktarılacak
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">İptal</button>
      <button class="btn-primary" id="btnDoImport">📥 ${dataRows.length} Denemeyi Aktar</button>
    </div>`;

  openModal(html);

  // Live preview update
  document.querySelectorAll('.col-map').forEach(sel => sel.addEventListener('change', updateSummary));

  function getMapping() {
    const m = {};
    document.querySelectorAll('.col-map').forEach(sel => {
      m[sel.dataset.field] = sel.value !== '' ? parseInt(sel.value) : null;
    });
    return m;
  }

  function getVal(row, mapping, field) {
    const idx = mapping[field];
    return (idx !== null && idx !== undefined) ? (row[idx] || '').toString().trim() : '';
  }

  function updateSummary() {
    const mapping = getMapping();
    let valid = 0, stockParsed = 0, appParsed = 0;
    dataRows.forEach(r => {
      const n = getVal(r, mapping, 'name');
      const p = getVal(r, mapping, 'publisher');
      const s = getVal(r, mapping, 'stockDate');
      if (!n && !p) return;
      valid++;
      if (s && parseDateSmart(s)) stockParsed++;
      const a = getVal(r, mapping, 'appDate');
      if (a && parseDateSmart(a)) appParsed++;
    });
    const el = document.getElementById('importSummary');
    if (el) el.innerHTML = `
      <b style="color:var(--primary)">${valid}</b> deneme aktarılacak &nbsp;•&nbsp;
      <b style="color:#f59e0b">${stockParsed}</b> stok tarihi &nbsp;•&nbsp;
      <b style="color:#8b5cf6">${appParsed}</b> uygulama tarihi
      ${valid < dataRows.length ? `<span style="color:var(--text-muted)"> (${dataRows.length - valid} boş satır atlanacak)</span>` : ''}`;
  }
  updateSummary();

  // Map publisher name to existing or create new
  async function resolvePublisher(name, cache) {
    if (!name) return null;
    const norm = trNorm(name.trim());
    if (cache[norm]) return cache[norm];

    // Priority 1: exact match on publisher's short field
    let found = state.publishers.find(p => p.short && trNorm(p.short) === norm);

    // Priority 2: exact full name match
    if (!found) found = state.publishers.find(p => trNorm(p.name) === norm);

    // Priority 3: norm is contained in publisher name (any length)
    if (!found) found = state.publishers.find(p => trNorm(p.name).includes(norm));

    // Priority 4: publisher name (or short) is contained in norm
    if (!found) found = state.publishers.find(p =>
      (p.short && norm.includes(trNorm(p.short)) && trNorm(p.short).length >= 2) ||
      (norm.includes(trNorm(p.name)) && trNorm(p.name).length >= 3)
    );

    // Priority 5: significant word overlap — only for words >= 4 chars, need 2+ matches
    if (!found) {
      const normWords = new Set(norm.split(/\s+/).filter(w => w.length >= 4));
      if (normWords.size > 0) {
        found = state.publishers.find(p => {
          const pWords = new Set([
            ...trNorm(p.short || '').split(/\s+/).filter(w => w.length >= 4),
            ...trNorm(p.name).split(/\s+/).filter(w => w.length >= 4),
          ]);
          const overlap = [...normWords].filter(w => pWords.has(w));
          return overlap.length >= 2; // Need at least 2 significant words to match
        });
      }
    }

    if (found) { cache[norm] = found.id; return found.id; }

    // Not found — create new publisher with the name as-is
    const newPub = { id: genId(), name: name.trim(), short: name.trim(), phone: '', email: '' };
    state.publishers.push(newPub);
    await saveData('publishers');
    cache[norm] = newPub.id;
    return newPub.id;
  }

  document.getElementById('btnDoImport').addEventListener('click', async () => {
    const mapping = getMapping();
    const periodId = document.getElementById('importPeriod')?.value || '';
    const btn = document.getElementById('btnDoImport');
    btn.disabled = true;
    btn.textContent = '⏳ Aktarılıyor...';

    const newExams = [];
    const pubCache = {};
    let skipped = 0;

    for (const row of dataRows) {
      const pubName    = getVal(row, mapping, 'publisher');
      const nameRaw    = getVal(row, mapping, 'name');
      const stockRaw   = getVal(row, mapping, 'stockDate');
      const appRaw     = getVal(row, mapping, 'appDate');
      const categoryRaw= getVal(row, mapping, 'category');
      const examTypeRaw= getVal(row, mapping, 'examType');
      const scopeRaw   = getVal(row, mapping, 'scope');
      const priceRaw   = getVal(row, mapping, 'price');

      // Skip completely empty rows
      if (!pubName && !nameRaw && !stockRaw) { skipped++; continue; }

      // Name: use DENEME ADI column, fallback to publisher name
      const name = nameRaw || pubName || 'İsimsiz Deneme';

      // Publisher
      const publisherId = await resolvePublisher(pubName, pubCache);

      // Categories from DÜZEY column
      const categoryIds = mapDuzeyToCategories(categoryRaw);
      const categoryId = categoryIds[0] || '';
      const cat = getCatById(categoryId);
      const categoryNames = categoryIds.map(id => getCatById(id)?.name || id).join(', ');

      // Dates
      const stockDate = parseDateSmart(stockRaw);
      const applicationDate = parseDateSmart(appRaw);

      // Type from KAPSAM + DENEME TÜRÜ
      const type = mapKapsamToType(scopeRaw, examTypeRaw);

      // Price
      const price = parseFloat((priceRaw || '').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

      newExams.push({
        id: genId(),
        name,
        categoryId,
        categoryIds: categoryIds.length > 0 ? categoryIds : [],
        categoryNames,
        type,
        stockDate, applicationDate,
        publisherId: publisherId || '',
        publisherName: pubName || '',   // Store name directly — critical for search
        examNo: '',
        periodId,
        importSource: { examType: examTypeRaw, scope: scopeRaw, duzey: categoryRaw }
      });
    }

    if (!newExams.length) {
      toast('Aktarılacak geçerli satır bulunamadı', 'error');
      btn.disabled = false; btn.textContent = '📥 Aktar';
      return;
    }

    // Save to catalogItems — NOT to exams (user assigns schools manually from catalog)
    state.catalogItems.push(...newExams);
    await saveData('catalogItems');
    closeModal();
    renderAll();
    switchView('catalog');

    const withStock = newExams.filter(e => e.stockDate).length;
    const withApp   = newExams.filter(e => e.applicationDate).length;
    toast(`📚 ${newExams.length} deneme kataloğa eklendi • ${withStock} stok tarihi • ${withApp} uygulama tarihi\nListeye eklemek için katalogdan okul atayın.`, 'success', 6000);
  });
}


// ============================================================
// ===== CEVAP ANAHTARI & WHATSAPP =====
// ============================================================

function openAnswerKeyModal(group) {
  const item = group.catalogItemId
    ? state.catalogItems.find(i => i.id === group.catalogItemId)
    : null;

  const hasAK = !!(item?.answerKeyData);
  const akName = item?.answerKeyName || '';

  // Schools assigned to this exam with contacts that have phone numbers
  const assignedExams = group.exams;
  const schoolsWithPhones = assignedExams.map(exam => {
    const school = state.schools.find(s => s.id === exam.schoolId);
    if (!school) return null;
    const contacts = (school.contacts || []).filter(c => c.phone?.trim());
    return { school, exam, contacts };
  }).filter(Boolean);

  const html = `
    <div class="modal-title">📄 Cevap Anahtarı — ${group.name} <button class="modal-close" id="closeModal">×</button></div>

    <div class="form-group">
      <label class="form-label">PDF Yükle</label>
      ${hasAK ? `
      <div class="ak-file-info" id="akFileInfo">
        <span style="font-size:18px">📄</span>
        <span class="ak-file-name">${akName}</span>
        <button class="btn-xs btn-delete" id="btnRemoveAK" style="padding:2px 7px">✕ Kaldır</button>
      </div>` : `
      <div class="ak-drop-zone" id="akDropZone">
        <div style="font-size:24px;margin-bottom:6px">📄</div>
        <div>PDF dosyasını buraya sürükleyin veya tıklayın</div>
        <div style="font-size:10px;margin-top:4px;opacity:0.7">Maksimum 5MB</div>
        <input type="file" id="akFileInput" accept=".pdf,image/*" style="display:none">
      </div>`}
    </div>

    ${hasAK && assignedExams.length > 0 ? `
    <div class="form-group">
      <label class="form-label">📱 WhatsApp ile Gönder</label>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">
        Cevap anahtarını atanmış okul yetkililerine WhatsApp'tan gönderin.
      </div>
      <div id="waSchoolList">
        ${schoolsWithPhones.length === 0
          ? `<div style="color:var(--text-muted);font-size:12px;padding:8px;background:var(--bg);border-radius:8px">
              ⚠️ Bu denemeye atanmış okullarda telefon numarası kayıtlı yetkili yok.<br>
              <span style="font-size:10px">Okullar → Okul Düzenle → Yetkili Ekle bölümünden ekleyebilirsiniz.</span>
            </div>`
          : schoolsWithPhones.map(({ school, exam, contacts }) => `
            <div class="wa-school-row">
              <div style="flex:1;min-width:0">
                <div class="wa-school-name" style="color:${school.color||'var(--primary)'}">
                  🏫 ${school.name}
                </div>
                <div class="wa-contacts">
                  ${contacts.map(c => `${c.name}${c.role ? ' (' + c.role + ')' : ''}: <b>${c.phone}</b>`).join(' • ')}
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:4px">
                ${contacts.map(c => `
                  <button class="btn-whatsapp btn-send-wa"
                    data-phone="${c.phone.replace(/\D/g,'')}"
                    data-school="${school.name}"
                    data-exam="${group.name}"
                    data-contact="${c.name}">
                    <span>📱</span> ${c.name}
                  </button>`).join('')}
              </div>
            </div>`).join('')}
      </div>
    </div>` : ''}

    ${hasAK && assignedExams.length > 0 && schoolsWithPhones.length > 0 ? `
    <div style="margin-top:8px">
      <button class="btn-whatsapp" id="btnSendAllWA" style="width:100%;justify-content:center">
        📱 Tüm Okullara WhatsApp Gönder (${schoolsWithPhones.reduce((s,x)=>s+x.contacts.length,0)} kişi)
      </button>
    </div>` : ''}

    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">Kapat</button>
      ${hasAK ? `<a href="${item.answerKeyData}" download="${akName}" class="btn-primary" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px">⬇️ İndir</a>` : ''}
    </div>`;

  openModal(html);

  // Drop zone and file input
  if (!hasAK) {
    const dropZone = document.getElementById('akDropZone');
    const fileInput = document.getElementById('akFileInput');

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleAKUpload(file, group, item);
    });
    fileInput.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) handleAKUpload(file, group, item);
    });
  }

  // Remove answer key
  const removeBtn = document.getElementById('btnRemoveAK');
  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      if (!confirm('Cevap anahtarı kaldırılsın mı?')) return;
      if (item) {
        const idx = state.catalogItems.findIndex(i => i.id === item.id);
        if (idx !== -1) {
          delete state.catalogItems[idx].answerKeyData;
          delete state.catalogItems[idx].answerKeyName;
          await saveData('catalogItems');
        }
      }
      closeModal();
      renderCatalog();
      toast('🗑️ Cevap anahtarı kaldırıldı', 'success');
    });
  }

  // Individual WhatsApp send buttons
  document.querySelectorAll('.btn-send-wa').forEach(btn => {
    btn.addEventListener('click', () => {
      const phone = btn.dataset.phone;
      const msg = buildWAMessage(btn.dataset.exam, btn.dataset.school, item);
      sendWhatsApp(phone, msg);
    });
  });

  // Send all
  const sendAllBtn = document.getElementById('btnSendAllWA');
  if (sendAllBtn) {
    sendAllBtn.addEventListener('click', () => {
      let count = 0;
      schoolsWithPhones.forEach(({ school, contacts }) => {
        contacts.forEach(c => {
          const phone = c.phone.replace(/\D/g, '');
          const msg = buildWAMessage(group.name, school.name, item);
          setTimeout(() => sendWhatsApp(phone, msg), count * 800);
          count++;
        });
      });
      toast(`📱 ${count} kişiye WhatsApp açılıyor...`, 'success', 4000);
    });
  }
}

async function handleAKUpload(file, group, item) {
  if (file.size > 5 * 1024 * 1024) {
    toast('Dosya 5MB\'den büyük olamaz', 'error');
    return;
  }
  toast('⏳ Yükleniyor...', 'default', 2000);
  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = e.target.result; // base64 data URL

    if (item) {
      const idx = state.catalogItems.findIndex(i => i.id === item.id);
      if (idx !== -1) {
        state.catalogItems[idx].answerKeyData = data;
        state.catalogItems[idx].answerKeyName = file.name;
        await saveData('catalogItems');
      }
    }
    closeModal();
    // Reopen with updated data
    const updatedGroups = groupExamsByCatalog();
    const updatedGroup = updatedGroups.find(g => g.key === group.key) || group;
    openAnswerKeyModal(updatedGroup);
    renderCatalog();
    toast('✅ Cevap anahtarı yüklendi', 'success');
  };
  reader.readAsDataURL(file);
}

function buildWAMessage(examName, schoolName, item) {
  const ak = item?.answerKeyName || '';
  let msg = `Merhaba,\n\n*${examName}* deneme cevap anahtarı ektedir.`;
  if (schoolName) msg += `\n\n🏫 ${schoolName}`;
  if (ak) msg += `\n📄 ${ak}`;
  msg += '\n\nİyi çalışmalar! 📚';
  return msg;
}

function sendWhatsApp(phone, message) {
  // Normalize phone: remove spaces, dashes, parens. Add country code if needed.
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = '90' + p.slice(1); // Turkey: 0xxx → 90xxx
  if (!p.startsWith('9') && p.length === 10) p = '90' + p; // 5xxx → 905xxx
  const url = `https://wa.me/${p}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

// ============================================================
// ===== 1. TAKVİMDE OKUL FİLTRESİ =====
// ============================================================
// Handled by adding schoolFilter to state and buildEventMap

// ============================================================
// ===== 2. DÖNEM BAZLI RAPOR =====
// ============================================================

function renderPeriodReport(content) {
  const periodOptions = state.periods.map(p =>
    `<option value="${p.id}" ${p.isActive ? 'selected' : ''}>${p.name}</option>`
  ).join('');

  if (!state.periods.length) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">🗓️</div>
      Henüz dönem tanımlanmamış.<br><span style="font-size:11px">Ayarlar → Dönem Yönetimi'nden ekleyin.</span></div>`;
    return;
  }

  const activePeriod = state.periods.find(p => p.isActive) || state.periods[0];
  const selId = activePeriod?.id || '';

  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <div class="section-title" style="margin:0">Dönem Raporu</div>
      <select id="periodReportSel" class="filter-select" style="flex:1;min-width:180px">
        ${periodOptions}
      </select>
    </div>
    <div id="periodReportBody"></div>`;

  function renderBody(periodId) {
    const period = state.periods.find(p => p.id === periodId);
    const exams = state.exams.filter(e => e.periodId === periodId);
    const body = document.getElementById('periodReportBody');
    if (!body) return;

    if (!exams.length) {
      body.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:16px;text-align:center">
        Bu dönemde henüz deneme yok.</div>`;
      return;
    }

    const total = exams.length;
    const applied = exams.filter(e => e.status === 'applied').length;
    const totalQty = exams.reduce((s,e) => s+(Number(e.qty)||0), 0);
    const totalRevenue = exams.reduce((s,e) => s+(Number(e.price)||0), 0);
    const totalPaid = state.payments
      .filter(p => exams.some(e => e.schoolId === p.schoolId))
      .reduce((s,p) => s+(Number(p.amount)||0), 0);

    // School breakdown
    const schoolMap = new Map();
    exams.forEach(e => {
      if (!e.schoolId) return;
      if (!schoolMap.has(e.schoolId)) schoolMap.set(e.schoolId, { name: e.schoolName||'?', examCount: 0, qty: 0, revenue: 0 });
      const s = schoolMap.get(e.schoolId);
      s.examCount++;
      s.qty += Number(e.qty)||0;
      s.revenue += Number(e.price)||0;
    });

    // Publisher breakdown
    const pubMap = new Map();
    exams.forEach(e => {
      const pub = state.publishers.find(p => p.id === e.publisherId);
      const pubName = pub?.short || pub?.name || 'Diğer';
      if (!pubMap.has(pubName)) pubMap.set(pubName, { count: 0, qty: 0 });
      pubMap.get(pubName).count++;
      pubMap.get(pubName).qty += Number(e.qty)||0;
    });

    body.innerHTML = `
      <div class="stats-grid" style="margin-bottom:14px">
        <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Toplam Deneme</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--success)">${applied}</div><div class="stat-label">Uygulandı</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--info)">${totalQty.toLocaleString('tr-TR')}</div><div class="stat-label">Toplam Adet</div></div>
        <div class="stat-card"><div class="stat-value" style="color:var(--primary);font-size:18px">${totalRevenue.toLocaleString('tr-TR')} ₺</div><div class="stat-label">Toplam Tutar</div></div>
      </div>

      <div class="stats-section">
        <div class="section-title">🏫 Okul Bazlı</div>
        <div style="overflow-x:auto">
          <table class="month-table">
            <thead><tr>
              <th>Okul</th>
              <th style="text-align:center">Deneme</th>
              <th style="text-align:center">Adet</th>
              <th style="text-align:right">Tutar</th>
            </tr></thead>
            <tbody>
              ${[...schoolMap.values()].sort((a,b)=>b.revenue-a.revenue).map(s=>`<tr>
                <td style="font-weight:600">${s.name}</td>
                <td style="text-align:center">${s.examCount}</td>
                <td style="text-align:center">${s.qty.toLocaleString('tr-TR')}</td>
                <td style="text-align:right;font-weight:700">${s.revenue.toLocaleString('tr-TR')} ₺</td>
              </tr>`).join('')}
              <tr style="background:var(--primary-light);font-weight:800">
                <td>TOPLAM</td>
                <td style="text-align:center">${total}</td>
                <td style="text-align:center">${totalQty.toLocaleString('tr-TR')}</td>
                <td style="text-align:right">${totalRevenue.toLocaleString('tr-TR')} ₺</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="stats-section">
        <div class="section-title">📚 Yayınevi Bazlı</div>
        <div style="overflow-x:auto">
          <table class="month-table">
            <thead><tr>
              <th>Yayınevi</th>
              <th style="text-align:center">Deneme Sayısı</th>
              <th style="text-align:center">Toplam Adet</th>
            </tr></thead>
            <tbody>
              ${[...pubMap.entries()].sort((a,b)=>b[1].count-a[1].count).map(([name,v])=>`<tr>
                <td style="font-weight:600">${name}</td>
                <td style="text-align:center">${v.count}</td>
                <td style="text-align:center">${v.qty.toLocaleString('tr-TR')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="export-row" style="margin-top:10px">
        <button class="btn-secondary" id="btnExportPeriodPDF" style="font-size:11px">📄 PDF İndir</button>
        <button class="btn-secondary" id="btnExportPeriodExcel" style="font-size:11px">📊 Excel İndir</button>
      </div>`;

    document.getElementById('btnExportPeriodPDF')?.addEventListener('click', () => exportPeriodPDF(period, exams));
    document.getElementById('btnExportPeriodExcel')?.addEventListener('click', () => exportPeriodExcel(period, exams));
  }

  renderBody(selId);
  document.getElementById('periodReportSel')?.addEventListener('change', e => renderBody(e.target.value));
}

function exportPeriodPDF(period, exams) {
  const rows = [...exams].sort((a,b)=>(a.applicationDate||'').localeCompare(b.applicationDate||'')).map(e => {
    const sc2 = STATUS_CONFIG[e.status||'ordered'];
    return `<tr>
      <td>${e.name}</td>
      <td>${e.schoolName||''}</td>
      <td>${e.applicationDate ? formatDate(e.applicationDate) : ''}</td>
      <td>${e.qty||''}</td>
      <td>${e.price ? Number(e.price).toLocaleString('tr-TR')+' ₺' : ''}</td>
      <td style="color:${sc2.color}">${sc2.label}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
  <style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px}
  h1{color:#6c3fff;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:16px}
  th{background:#6c3fff;color:white;padding:7px 10px;text-align:left;font-size:10px}
  td{padding:6px 10px;border-bottom:1px solid #e5e1ff}tr:nth-child(even)td{background:#f8f7ff}
  @media print{body{padding:12px}}</style></head><body>
  <h1>${period?.name || 'Dönem'} — Deneme Raporu</h1>
  <div style="color:#7c6fa0;font-size:11px;margin-bottom:16px">Tarih: ${new Date().toLocaleDateString('tr-TR')}</div>
  <table><thead><tr><th>Deneme</th><th>Okul</th><th>Uygulama</th><th>Adet</th><th>Tutar</th><th>Durum</th></tr></thead>
  <tbody>${rows}</tbody></table>
  </body></html>`;
  const w = window.open('','_blank');
  if (!w) { toast('Pop-up engellendi', 'error'); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

function exportPeriodExcel(period, exams) {
  const sep = '\t', nl = '\n';
  let csv = `${period?.name || 'Dönem'} — Deneme Raporu${nl}`;
  csv += `Tarih: ${new Date().toLocaleDateString('tr-TR')}${nl}${nl}`;
  csv += `Deneme${sep}Yayınevi${sep}Okul${sep}Stok Tarihi${sep}Uygulama Tarihi${sep}Adet${sep}Birim Fiyat${sep}Toplam${sep}Durum${nl}`;
  [...exams].sort((a,b)=>(a.applicationDate||'').localeCompare(b.applicationDate||'')).forEach(e => {
    const pub = state.publishers.find(p=>p.id===e.publisherId);
    const sc2 = STATUS_CONFIG[e.status||'ordered'];
    csv += `${e.name}${sep}${pub?.short||pub?.name||''}${sep}${e.schoolName||''}${sep}${e.stockDate?formatDate(e.stockDate):''}${sep}${e.applicationDate?formatDate(e.applicationDate):''}${sep}${e.qty||''}${sep}${e.unitPrice||''}${sep}${e.price||''}${sep}${sc2.label}${nl}`;
  });
  const BOM = '\uFEFF';
  const blob = new Blob([BOM+csv], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(period?.name||'donem').replace(/\s+/g,'-')}-raporu.txt`;
  a.click();
  URL.revokeObjectURL(url);
  toast('📊 Excel indirildi', 'success');
}

// ============================================================
// ===== 3. GENEL EXPORT (tüm denemeler) =====
// ============================================================

function exportAllExamsPDF() {
  const exams = [...state.exams].sort((a,b)=>(a.applicationDate||'').localeCompare(b.applicationDate||''));
  const rows = exams.map(e => {
    const sc2 = STATUS_CONFIG[e.status||'ordered'];
    const pub = state.publishers.find(p=>p.id===e.publisherId);
    return `<tr>
      <td>${e.name}</td>
      <td>${pub?.short||pub?.name||''}</td>
      <td>${e.schoolName||''}</td>
      <td>${e.applicationDate ? formatDate(e.applicationDate) : ''}</td>
      <td>${e.qty||''}</td>
      <td>${e.price ? Number(e.price).toLocaleString('tr-TR')+' ₺' : ''}</td>
      <td style="color:${sc2.color}">${sc2.label}</td>
    </tr>`;
  }).join('');

  const totalRevenue = exams.reduce((s,e)=>s+Number(e.price||0),0);
  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8">
  <style>body{font-family:Arial,sans-serif;padding:24px;font-size:11px}
  h1{color:#6c3fff}table{width:100%;border-collapse:collapse;margin-top:16px}
  th{background:#6c3fff;color:white;padding:6px 9px;text-align:left;font-size:10px}
  td{padding:5px 9px;border-bottom:1px solid #e5e1ff}tr:nth-child(even)td{background:#f8f7ff}
  .total{font-weight:800;background:#ede9ff!important}
  @media print{body{padding:8px}}</style></head><body>
  <h1>📚 Deneme Takip — Tüm Denemeler</h1>
  <div style="color:#7c6fa0;font-size:11px;margin-bottom:4px">Tarih: ${new Date().toLocaleDateString('tr-TR')} • Toplam: ${exams.length} deneme • Tutar: ${totalRevenue.toLocaleString('tr-TR')} ₺</div>
  <table><thead><tr><th>Deneme</th><th>Yayınevi</th><th>Okul</th><th>Uygulama</th><th>Adet</th><th>Tutar</th><th>Durum</th></tr></thead>
  <tbody>${rows}<tr class="total"><td colspan="4">TOPLAM</td><td>${exams.reduce((s,e)=>s+Number(e.qty||0),0).toLocaleString('tr-TR')}</td><td>${totalRevenue.toLocaleString('tr-TR')} ₺</td><td></td></tr></tbody></table>
  </body></html>`;
  const w = window.open('','_blank');
  if (!w) { toast('Pop-up engellendi', 'error'); return; }
  w.document.write(html); w.document.close();
  setTimeout(()=>w.print(),600);
}

function exportAllExamsExcel() {
  const exams = [...state.exams].sort((a,b)=>(a.applicationDate||'').localeCompare(b.applicationDate||''));
  const sep='\t', nl='\n';
  let csv = `Deneme Takip — Tüm Denemeler${nl}Tarih: ${new Date().toLocaleDateString('tr-TR')}${nl}${nl}`;
  csv += `Deneme${sep}Yayınevi${sep}Okul${sep}Kategori${sep}Tür${sep}Stok Tarihi${sep}Uygulama Tarihi${sep}Adet${sep}Birim Fiyat${sep}Toplam${sep}Durum${nl}`;
  exams.forEach(e => {
    const pub = state.publishers.find(p=>p.id===e.publisherId);
    const cats = (e.categoryIds||[]).map(id=>getCatById(id)?.name||'').filter(Boolean).join('+');
    const sc2 = STATUS_CONFIG[e.status||'ordered'];
    csv += `${e.name}${sep}${pub?.short||pub?.name||''}${sep}${e.schoolName||''}${sep}${cats}${sep}${e.type||''}${sep}${e.stockDate?formatDate(e.stockDate):''}${sep}${e.applicationDate?formatDate(e.applicationDate):''}${sep}${e.qty||''}${sep}${e.unitPrice||''}${sep}${e.price||''}${sep}${sc2.label}${nl}`;
  });
  const BOM='\uFEFF';
  const blob=new Blob([BOM+csv],{type:'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`deneme-takip-tum-${new Date().toISOString().split('T')[0]}.txt`;
  a.click(); URL.revokeObjectURL(url);
  toast('📊 Excel indirildi','success');
}

// ============================================================
// ===== 4. DENEME SONUÇ GİRİŞİ =====
// ============================================================

function openExamResultModal(examId) {
  const exam = state.exams.find(e => e.id === examId);
  if (!exam) return;
  const result = exam.result || {};

  const html = `
    <div class="modal-title">📊 Deneme Sonuçları — ${exam.name} <button class="modal-close" id="closeModal">×</button></div>
    <div style="background:var(--bg);border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:11px;color:var(--text-muted)">
      🏫 ${exam.schoolName || '—'} &nbsp;•&nbsp; 🎯 ${exam.applicationDate ? formatDate(exam.applicationDate) : '—'}
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">👥 Giren Öğrenci Sayısı</label>
        <input type="number" id="resStudents" class="form-input" min="0" placeholder="0" value="${result.studentCount||''}">
      </div>
      <div class="form-group">
        <label class="form-label">📋 Dağıtılan Kitapçık</label>
        <input type="number" id="resBooks" class="form-input" min="0" placeholder="0" value="${result.booksDistributed||exam.qty||''}">
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">📅 Gerçek Uygulama Tarihi</label>
        <input type="date" id="resActualDate" class="form-input" value="${result.actualDate||exam.applicationDate||''}">
      </div>
      <div class="form-group">
        <label class="form-label">⏱️ Uygulama Süresi</label>
        <select id="resDuration" class="form-select">
          <option value="">Seçin...</option>
          <option value="90dk" ${result.duration==='90dk'?'selected':''}>90 dakika (TYT)</option>
          <option value="180dk" ${result.duration==='180dk'?'selected':''}>180 dakika (AYT)</option>
          <option value="40dk" ${result.duration==='40dk'?'selected':''}>40 dakika (Sınıf)</option>
          <option value="diger" ${result.duration==='diger'?'selected':''}>Diğer</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">✅ Sorunsuz Tamamlandı mı?</label>
      <div style="display:flex;gap:8px">
        <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
          <input type="radio" name="resSmooth" value="yes" ${result.smooth!==false?'checked':''} style="accent-color:var(--primary)"> Evet
        </label>
        <label style="display:flex;align-items:center;gap:5px;font-size:12px;cursor:pointer">
          <input type="radio" name="resSmooth" value="no" ${result.smooth===false?'checked':''} style="accent-color:var(--danger)"> Hayır, sorun yaşandı
        </label>
      </div>
    </div>

    <div class="form-group" id="resProblemSection" style="${result.smooth===false?'':'display:none'}">
      <label class="form-label">⚠️ Sorun Açıklaması</label>
      <textarea id="resProblem" class="form-textarea" rows="2" placeholder="Yaşanan sorunları açıklayın...">${result.problem||''}</textarea>
    </div>

    <div class="form-group">
      <label class="form-label">📝 Genel Not</label>
      <textarea id="resNote" class="form-textarea" rows="2" placeholder="Denemeyle ilgili genel notlar...">${result.note||''}</textarea>
    </div>

    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">İptal</button>
      <button class="btn-primary" id="btnSaveResult">💾 Sonucu Kaydet</button>
    </div>`;

  openModal(html);

  // Show/hide problem section
  document.querySelectorAll('input[name="resSmooth"]').forEach(r => {
    r.addEventListener('change', () => {
      document.getElementById('resProblemSection').style.display =
        r.value === 'no' && r.checked ? '' : 'none';
    });
  });

  document.getElementById('btnSaveResult').addEventListener('click', async () => {
    const smooth = document.querySelector('input[name="resSmooth"]:checked')?.value !== 'no';
    const result = {
      studentCount: Number(document.getElementById('resStudents').value) || null,
      booksDistributed: Number(document.getElementById('resBooks').value) || null,
      actualDate: document.getElementById('resActualDate').value || '',
      duration: document.getElementById('resDuration').value || '',
      smooth,
      problem: smooth ? '' : document.getElementById('resProblem').value.trim(),
      note: document.getElementById('resNote').value.trim(),
      recordedAt: Date.now(),
    };

    const idx = state.exams.findIndex(e => e.id === examId);
    if (idx !== -1) {
      state.exams[idx].result = result;
      // If actual date filled, also update applicationDate
      if (result.actualDate) state.exams[idx].applicationDate = result.actualDate;
      await saveData('exams');
    }
    closeModal();
    renderExamList();
    toast('📊 Sonuç kaydedildi', 'success');
  });
}

// ============================================================
// ===== 5. KATALOGDAN TOPLU OKUL EKLEME =====
// ============================================================

function openBulkAddSchoolsModal(group) {
  const periodOptions = state.periods.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  const catBadges = group.categoryIds.map(id => {
    const c = getCatById(id);
    return c ? `<span class="badge" style="background:${c.color}22;color:${c.color}">${c.name}</span>` : '';
  }).join(' ');

  // Schools not yet added to this exam
  const alreadyAdded = new Set(group.exams.map(e => e.schoolId));
  const available = state.schools.filter(s => !alreadyAdded.has(s.id));

  if (available.length === 0) {
    toast('Tüm okullar bu denemeye zaten eklenmiş', 'warning');
    return;
  }

  const schoolRows = available.map(s => {
    // Calculate auto qty from student counts
    const sc = s.studentCounts || {};
    const autoQty = group.categoryIds.reduce((sum, id) => sum + (sc[id] || 0), 0);
    return `
      <div class="bulk-add-school-row" data-school="${s.id}">
        <label class="bulk-school-check-label">
          <input type="checkbox" class="bas-cb" value="${s.id}" data-name="${s.name}" data-autoqty="${autoQty}">
          <span style="color:${s.color||'var(--primary)'}">🏫 ${s.name}</span>
          ${autoQty > 0 ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px">(${autoQty} öğrenci)</span>` : ''}
        </label>
        <div class="bas-details hidden" id="bas_${s.id}" style="padding-left:24px;margin-top:4px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <div>
            <label style="font-size:10px;color:var(--text-muted)">Stok</label>
            <input type="date" class="input-sm bas-stock" data-school="${s.id}" value="${group.stockDate||''}">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-muted)">Uygulama</label>
            <input type="date" class="input-sm bas-app" data-school="${s.id}" value="${group.applicationDate||''}">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-muted)">Adet</label>
            <input type="number" class="input-sm bas-qty" data-school="${s.id}" value="${autoQty||''}" style="width:64px">
          </div>
          <div>
            <label style="font-size:10px;color:var(--text-muted)">Birim ₺</label>
            <input type="number" class="input-sm bas-unit" data-school="${s.id}" style="width:72px" placeholder="0">
          </div>
        </div>
      </div>`;
  }).join('');

  const html = `
    <div class="modal-title">🏫 Toplu Okul Ekle → Listeye <button class="modal-close" id="closeModal">×</button></div>
    <div style="background:var(--bg);border-radius:8px;padding:10px 12px;margin-bottom:12px">
      <div style="font-weight:800;font-size:13px;margin-bottom:4px">${group.name}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">${catBadges}
        ${group.publisherName ? `<span style="font-size:11px;color:var(--text-muted)">📚 ${group.publisherName}</span>` : ''}
      </div>
    </div>

    <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
      <button class="btn-xs btn-edit" id="btnSelectAllSchools">Tümünü Seç</button>
      <button class="btn-xs btn-secondary" id="btnDeselectAllSchools">Temizle</button>
      <span id="basSelectedCount" style="font-size:11px;color:var(--text-muted);align-self:center">0 okul seçili</span>
    </div>

    <div style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;padding:8px;background:var(--bg);border-radius:var(--radius-sm);border:1.5px solid var(--border)">
      ${schoolRows}
    </div>

    ${state.periods.length > 0 ? `
    <div class="form-group" style="margin-top:10px">
      <label class="form-label">🗓️ Dönem (tüm seçilenlere uygulanır)</label>
      <select id="basPeriod" class="form-select"><option value="">Seçme</option>${periodOptions}</select>
    </div>` : ''}

    <div class="modal-footer">
      <button class="btn-secondary" id="cancelModal">İptal</button>
      <button class="btn-primary" id="btnSaveBulkAdd">✅ Seçili Okulları Listeye Ekle</button>
    </div>`;

  openModal(html);

  function updateCount() {
    const count = document.querySelectorAll('.bas-cb:checked').length;
    document.getElementById('basSelectedCount').textContent = `${count} okul seçili`;
    document.getElementById('btnSaveBulkAdd').textContent = count > 0
      ? `✅ ${count} Okulu Listeye Ekle` : '✅ Seçili Okulları Listeye Ekle';
  }

  // Toggle detail row on checkbox
  document.querySelectorAll('.bas-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const detail = document.getElementById(`bas_${cb.value}`);
      if (detail) detail.style.display = cb.checked ? 'flex' : 'none';
      updateCount();
    });
  });

  document.getElementById('btnSelectAllSchools').addEventListener('click', () => {
    document.querySelectorAll('.bas-cb').forEach(cb => {
      cb.checked = true;
      const detail = document.getElementById(`bas_${cb.value}`);
      if (detail) detail.style.display = 'flex';
    });
    updateCount();
  });
  document.getElementById('btnDeselectAllSchools').addEventListener('click', () => {
    document.querySelectorAll('.bas-cb').forEach(cb => {
      cb.checked = false;
      const detail = document.getElementById(`bas_${cb.value}`);
      if (detail) detail.style.display = 'none';
    });
    updateCount();
  });

  document.getElementById('btnSaveBulkAdd').addEventListener('click', async () => {
    const selected = [...document.querySelectorAll('.bas-cb:checked')];
    if (!selected.length) { toast('En az bir okul seçin', 'error'); return; }
    const periodId = document.getElementById('basPeriod')?.value || group.periodId || '';
    const newExams = [];

    for (const cb of selected) {
      const schoolId = cb.value;
      const school = state.schools.find(s => s.id === schoolId);
      if (!school) continue;
      const sc = school.studentCounts || {};
      const qty = Number(document.querySelector(`.bas-qty[data-school="${schoolId}"]`)?.value) || null;
      const unit = Number(document.querySelector(`.bas-unit[data-school="${schoolId}"]`)?.value) || null;
      const stockDate = document.querySelector(`.bas-stock[data-school="${schoolId}"]`)?.value || group.stockDate || '';
      const appDate = document.querySelector(`.bas-app[data-school="${schoolId}"]`)?.value || group.applicationDate || '';

      // Build category breakdown
      const categoryBreakdown = {};
      group.categoryIds.forEach(id => { if (sc[id] > 0) categoryBreakdown[id] = sc[id]; });

      newExams.push({
        id: genId(),
        catalogItemId: group.catalogItemId || null,
        name: group.name,
        categoryId: group.categoryIds[0] || '',
        categoryIds: group.categoryIds,
        categoryNames: group.categoryIds.map(id => getCatById(id)?.name || '').join(', '),
        type: group.type,
        publisherId: group.publisherId,
      publisherName: group.publisherName || '',
        examNo: '',
        stockDate, applicationDate: appDate,
        periodId,
        schoolId: school.id, schoolName: school.name,
        price: qty && unit ? qty * unit : 0,
        qty, unitPrice: unit,
        categoryBreakdown,
        trackingNumber: '',
        status: 'ordered', applied: false,
        notes: [], gcalAdded: false, gcalEventIds: [],
      });
    }

    state.exams.push(...newExams);
    await saveData('exams');
    closeModal();
    renderAll();
    toast(`✅ ${newExams.length} okul listeye eklendi`, 'success');
    triggerBadgeUpdate();
  });
}

// ============================================================
// ===== 6. KATALOG DÜZENLEME → LİSTEYİ GÜNCELLE =====
// Already partially handled in openCatalogItemEditModal
// ============================================================

// ============================================================
// ===== 7. DÖNEM BAŞI SİHİRBAZI =====
// ============================================================

function openPeriodWizard() {
  // Step 1: Select or create period
  // Step 2: Select catalog items to include  
  // Step 3: Select schools for each
  // Step 4: Confirm and create

  const periodOptions = state.periods.map(p =>
    `<option value="${p.id}" ${p.isActive?'selected':''}>${p.name}</option>`).join('');

  const html = `
    <div class="modal-title">🗓️ Dönem Başı Planlama Sihirbazı <button class="modal-close" id="closeModal">×</button></div>

    <div class="wizard-steps">
      <div class="wizard-step active" id="wStep1">
        <div class="wizard-step-num">1</div>
        <div class="wizard-step-label">Dönem Seç</div>
      </div>
      <div class="wizard-step" id="wStep2">
        <div class="wizard-step-num">2</div>
        <div class="wizard-step-label">Denemeler</div>
      </div>
      <div class="wizard-step" id="wStep3">
        <div class="wizard-step-num">3</div>
        <div class="wizard-step-label">Okullar</div>
      </div>
      <div class="wizard-step" id="wStep4">
        <div class="wizard-step-num">4</div>
        <div class="wizard-step-label">Özet</div>
      </div>
    </div>

    <div id="wizardContent"></div>

    <div class="modal-footer" id="wizardFooter">
      <button class="btn-secondary" id="cancelModal">İptal</button>
      <button class="btn-primary" id="btnWizardNext">İleri →</button>
    </div>`;

  openModal(html);

  let wizardState = { periodId: '', selectedCatalogIds: new Set(), selectedSchoolIds: new Set(), unitPrice: 0 };
  let currentStep = 1;

  function goToStep(step) {
    currentStep = step;
    document.querySelectorAll('.wizard-step').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === step);
      el.classList.toggle('done', i + 1 < step);
    });
    const btn = document.getElementById('btnWizardNext');
    if (btn) btn.textContent = step === 4 ? '✅ Planlama Başlat' : 'İleri →';
    renderWizardStep(step);
  }

  function renderWizardStep(step) {
    const c = document.getElementById('wizardContent');
    if (!c) return;

    if (step === 1) {
      c.innerHTML = `
        <div class="form-group">
          <label class="form-label">Hangi dönem için planlama yapıyorsunuz?</label>
          ${state.periods.length > 0 ? `
          <select id="wizPeriod" class="form-select">${periodOptions}</select>` : ''}
          <div style="margin-top:10px;font-size:12px;color:var(--text-muted)">veya yeni dönem ekleyin:</div>
          <div style="display:flex;gap:6px;margin-top:6px">
            <input type="text" id="wizNewPeriod" class="input-sm" placeholder="2025-2026 2.Dönem" style="flex:1">
            <button class="btn-sm btn-success" id="btnWizAddPeriod">Ekle</button>
          </div>
        </div>`;

      if (wizardState.periodId && document.getElementById('wizPeriod')) {
        document.getElementById('wizPeriod').value = wizardState.periodId;
      }
      document.getElementById('btnWizAddPeriod')?.addEventListener('click', async () => {
        const name = document.getElementById('wizNewPeriod')?.value.trim();
        if (!name) return;
        const newP = { id: genId(), name, isActive: false, startDate: '', endDate: '' };
        state.periods.push(newP);
        await saveData('periods');
        wizardState.periodId = newP.id;
        toast('📅 Dönem eklendi', 'success');
        renderSettings();
        populateFilters();
        goToStep(2);
      });
    }

    else if (step === 2) {
      const cats = [...new Set(state.catalogItems.flatMap(i => i.categoryIds || []))];
      const catFilter = `<select id="wizCatFilter" class="filter-select">
        <option value="">Tüm Kategoriler</option>
        ${cats.map(id => { const c=getCatById(id); return c?`<option value="${id}">${c.name}</option>`:''; }).join('')}
      </select>`;

      const items = state.catalogItems.map(item => {
        const pub = state.publishers.find(p=>p.id===item.publisherId);
        const pubName = pub?.short || pub?.name || item.publisherName || '';
        const catBadges = (item.categoryIds||[]).map(id=>{const c=getCatById(id);return c?`<span class="badge" style="background:${c.color}22;color:${c.color};font-size:9px">${c.name}</span>`:''}).join('');
        const checked = wizardState.selectedCatalogIds.has(item.id);
        return `
          <div class="wiz-item-row wiz-cat-row" data-cats="${(item.categoryIds||[]).join(',')}">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1">
              <input type="checkbox" class="wiz-catalog-cb" value="${item.id}" ${checked?'checked':''} style="accent-color:var(--primary)">
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:12px">${item.name}</div>
                <div style="font-size:10px;color:var(--text-muted)">${pubName} ${item.stockDate?'• 📦 '+formatDate(item.stockDate):''}</div>
                <div style="margin-top:2px">${catBadges}</div>
              </div>
            </label>
          </div>`;
      }).join('');

      c.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          ${catFilter}
          <button class="btn-xs btn-edit" id="btnWizSelAll">Tümünü Seç</button>
          <span id="wizSelCount" style="font-size:11px;color:var(--text-muted);align-self:center">${wizardState.selectedCatalogIds.size} seçili</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;max-height:280px;overflow-y:auto;background:var(--bg);border:1.5px solid var(--border);border-radius:var(--radius-sm);padding:8px">
          ${items || '<div style="color:var(--text-muted);font-size:12px;padding:8px">Katalog boş. Önce Excel dosyanızı içe aktarın.</div>'}
        </div>`;

      document.querySelectorAll('.wiz-catalog-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          if (cb.checked) wizardState.selectedCatalogIds.add(cb.value);
          else wizardState.selectedCatalogIds.delete(cb.value);
          const el = document.getElementById('wizSelCount');
          if (el) el.textContent = `${wizardState.selectedCatalogIds.size} seçili`;
        });
      });
      document.getElementById('btnWizSelAll')?.addEventListener('click', () => {
        document.querySelectorAll('.wiz-catalog-cb:not([disabled])').forEach(cb => {
          cb.checked = true; wizardState.selectedCatalogIds.add(cb.value);
        });
        const el = document.getElementById('wizSelCount');
        if (el) el.textContent = `${wizardState.selectedCatalogIds.size} seçili`;
      });
      document.getElementById('wizCatFilter')?.addEventListener('change', e => {
        const catId = e.target.value;
        document.querySelectorAll('.wiz-cat-row').forEach(row => {
          const rowCats = row.dataset.cats.split(',');
          row.style.display = (!catId || rowCats.includes(catId)) ? '' : 'none';
        });
      });
    }

    else if (step === 3) {
      const schoolRows = state.schools.map(s => {
        const checked = wizardState.selectedSchoolIds.has(s.id);
        return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px;background:var(--bg);border-radius:6px;border:1px solid var(--border)">
          <input type="checkbox" class="wiz-school-cb" value="${s.id}" ${checked?'checked':''} style="accent-color:${s.color||'var(--primary)'}">
          <span style="font-weight:700;color:${s.color||'var(--text)'}">${s.name}</span>
        </label>`;
      }).join('');

      c.innerHTML = `
        <div style="margin-bottom:8px;font-size:12px;color:var(--text-muted)">
          Seçili <b>${wizardState.selectedCatalogIds.size}</b> denemeyi hangi okullara ekleyeyim?
        </div>
        <div style="display:flex;gap:6px;margin-bottom:8px">
          <button class="btn-xs btn-edit" id="btnWizSchoolAll">Tümünü Seç</button>
          <button class="btn-xs btn-secondary" id="btnWizSchoolNone">Temizle</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:220px;overflow-y:auto">
          ${schoolRows || '<div style="color:var(--text-muted);font-size:12px">Okul eklenmemiş.</div>'}
        </div>
        <div class="form-group" style="margin-top:12px">
          <label class="form-label">💰 Birim Fiyat (₺) — tüm denemeler için</label>
          <input type="number" id="wizUnitPrice" class="form-input" placeholder="0 (boş bırakabilirsiniz)" value="${wizardState.unitPrice||''}">
        </div>`;

      document.querySelectorAll('.wiz-school-cb').forEach(cb => {
        cb.addEventListener('change', () => {
          if (cb.checked) wizardState.selectedSchoolIds.add(cb.value);
          else wizardState.selectedSchoolIds.delete(cb.value);
        });
      });
      document.getElementById('btnWizSchoolAll')?.addEventListener('click', () => {
        document.querySelectorAll('.wiz-school-cb').forEach(cb => { cb.checked=true; wizardState.selectedSchoolIds.add(cb.value); });
      });
      document.getElementById('btnWizSchoolNone')?.addEventListener('click', () => {
        document.querySelectorAll('.wiz-school-cb').forEach(cb => { cb.checked=false; wizardState.selectedSchoolIds.delete(cb.value); });
      });
    }

    else if (step === 4) {
      const period = state.periods.find(p=>p.id===wizardState.periodId);
      const totalExams = wizardState.selectedCatalogIds.size * wizardState.selectedSchoolIds.size;
      c.innerHTML = `
        <div style="background:var(--primary-light);border-radius:var(--radius-sm);padding:14px;margin-bottom:12px">
          <div style="font-weight:800;font-size:14px;color:var(--primary);margin-bottom:8px">📋 Özet</div>
          <div style="font-size:12px;display:flex;flex-direction:column;gap:5px">
            <div>🗓️ Dönem: <b>${period?.name||'—'}</b></div>
            <div>📚 Deneme sayısı: <b>${wizardState.selectedCatalogIds.size}</b></div>
            <div>🏫 Okul sayısı: <b>${wizardState.selectedSchoolIds.size}</b></div>
            <div style="margin-top:4px;padding-top:8px;border-top:1px solid var(--border)">
              ➡️ Toplam <b style="color:var(--primary);font-size:15px">${totalExams}</b> kayıt listeye eklenecek
            </div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--text-muted)">
          Her deneme her okul için ayrı bir kayıt oluşturur. Öğrenci sayıları varsa adetler otomatik atanır.
          Uygulama tarihleri kataloğunuzdaki tarihlerden gelir — sonradan düzenleyebilirsiniz.
        </div>`;
    }
  }

  goToStep(1);

  document.getElementById('btnWizardNext')?.addEventListener('click', async () => {
    if (currentStep === 1) {
      const sel = document.getElementById('wizPeriod');
      wizardState.periodId = sel?.value || '';
      if (!wizardState.periodId) { toast('Dönem seçin veya yeni dönem ekleyin', 'error'); return; }
      goToStep(2);
    } else if (currentStep === 2) {
      if (!wizardState.selectedCatalogIds.size) { toast('En az bir deneme seçin', 'error'); return; }
      goToStep(3);
    } else if (currentStep === 3) {
      wizardState.unitPrice = Number(document.getElementById('wizUnitPrice')?.value) || 0;
      if (!wizardState.selectedSchoolIds.size) { toast('En az bir okul seçin', 'error'); return; }
      goToStep(4);
    } else if (currentStep === 4) {
      // Execute: create all exam records
      const newExams = [];
      for (const catalogId of wizardState.selectedCatalogIds) {
        const item = state.catalogItems.find(i => i.id === catalogId);
        if (!item) continue;
        for (const schoolId of wizardState.selectedSchoolIds) {
          const school = state.schools.find(s => s.id === schoolId);
          if (!school) continue;
          const sc = school.studentCounts || {};
          const catIds = item.categoryIds || [];
          const autoQty = catIds.reduce((sum,id) => sum+(sc[id]||0), 0);
          const qty = autoQty || null;
          const categoryBreakdown = {};
          catIds.forEach(id => { if (sc[id]>0) categoryBreakdown[id] = sc[id]; });

          newExams.push({
            id: genId(),
            catalogItemId: item.id,
            name: item.name,
            categoryId: catIds[0]||'',
            categoryIds: catIds,
            categoryNames: catIds.map(id=>getCatById(id)?.name||'').join(', '),
            type: item.type||'',
            publisherId: item.publisherId||'',
            publisherName: item.publisherName||'',
            examNo: '',
            stockDate: item.stockDate||'',
            applicationDate: item.applicationDate||'',
            periodId: wizardState.periodId,
            schoolId: school.id, schoolName: school.name,
            price: qty && wizardState.unitPrice ? qty*wizardState.unitPrice : 0,
            qty, unitPrice: wizardState.unitPrice||null,
            categoryBreakdown,
            trackingNumber: '',
            status: 'ordered', applied: false,
            notes: [], gcalAdded: false, gcalEventIds: [],
          });
        }
      }
      state.exams.push(...newExams);
      await saveData('exams');
      closeModal();
      renderAll();
      toast(`🎉 ${newExams.length} deneme listeye eklendi!`, 'success', 5000);
      triggerBadgeUpdate();
    }
  });
}

