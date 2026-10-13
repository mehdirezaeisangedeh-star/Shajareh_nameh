/**
 * test-app.js - آزمون جامع تمام نیازمندی‌های درخواستی کاربر
 */

// شبیه‌سازی LocalStorage در محیط Node.js
global.localStorage = {
  store: {},
  getItem(k) { return this.store[k] || null; },
  setItem(k, v) { this.store[k] = v; },
  removeItem(k) { delete this.store[k]; },
  clear() { this.store = {}; }
};

const Calendar = require('./js/calendar.js');
const Kinship = require('./js/kinship.js');
const Storage = require('./js/storage.js');
const AIDebugger = require('./js/ai-debugger.js');
const fs = require('fs');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failCount++;
  }
}

console.log('========================================================');
console.log('شروع آزمون جامع سامانه شجره‌نامه هوشمند خانوادگی');
console.log('========================================================\n');

// ۱. آزمون تقویم‌ها و افراد تاریخی
console.log('--- آزمون ۱: تقویم‌های شمسی، میلادی، قمری و افراد تاریخی ---');
const dateConv = Calendar.convertDate('jalali', 1403, 1, 1);
assert(dateConv.gregorian.year === 2024 && dateConv.gregorian.month === 3 && dateConv.gregorian.day === 20,
  'تبدیل دقیق ۱ فروردین ۱۴۰۳ خورشیدی به ۲۰ مارس ۲۰۲۴ میلادی');

const hijriConv = Calendar.convertDate('hijri', 1445, 9, 10);
assert(hijriConv.gregorian.year === 2024 && hijriConv.gregorian.month === 3 && hijriConv.gregorian.day === 20,
  'تبدیل دقیق ۱۰ رمضان ۱۴۴۵ قمری به ۲۰ مارس ۲۰۲۴ میلادی');

const cyrusAge = Calendar.computeAge(
  { isHistorical: true, era: 'BC', year: 550 },
  { isHistorical: true, era: 'BC', year: 530 },
  true
);
assert(cyrusAge === 20, 'محاسبه دقیق سن شخصیت تاریخی کوروش بزرگ از ۵۵۰ ق.م تا ۵۳۰ ق.م (۲۰ سال)');

// ۲. آزمون روابط خویشاوندی و فرد محوری (عروس، داماد، جاری، باجناق، نوه و ...)
console.log('\n--- آزمون ۲: موتور روابط خویشاوندی بر اساس فرد محور ---');
const demoClan = Storage.loadDemoData();
const members = demoClan.members;

// علی فرد محوری است
const aliToNeda = Kinship.calculateKinship('ali', 'neda', members);
assert(aliToNeda.category === 'daughter_in_law' && aliToNeda.label.includes('عروس'),
  'محاسبه نسبت عروس: ندا همسر پسر علی (محمد) است -> عروس (زنِ پسر)');

const aliToBabak = Kinship.calculateKinship('ali', 'babak', members);
assert(aliToBabak.category === 'son_in_law' && aliToBabak.label.includes('داماد'),
  'محاسبه نسبت داماد: بابک همسر دختر علی (سارا) است -> داماد (شوهرِ دختر)');

const aliToKian = Kinship.calculateKinship('ali', 'kian', members);
assert(aliToKian.category === 'grandchild' && aliToKian.label.includes('نوه'),
  'محاسبه نسبت نوه: کیان فرزند پسر علی است -> نوه (نوه پسری)');

const aliToDorsa = Kinship.calculateKinship('ali', 'dorsa', members);
assert(aliToDorsa.category === 'grandchild' && aliToDorsa.label.includes('نوه'),
  'محاسبه نسبت نوه: درسا فرزند دختر علی است -> نوه (نوه دختری)');

const aliToSina = Kinship.calculateKinship('ali', 'sina', members);
assert(aliToSina.category === 'niece_nephew' && aliToSina.label.includes('برادرزاده'),
  'محاسبه نسبت برادرزاده: سینا فرزند برادر علی (رضا) است');

const aliToYalda = Kinship.calculateKinship('ali', 'yalda', members);
assert(aliToYalda.category === 'niece_nephew' && aliToYalda.label.includes('خواهرزاده'),
  'محاسبه نسبت خواهرزاده: یلدا فرزند خواهر علی (مریم) است');

const aliToHossein = Kinship.calculateKinship('ali', 'hossein', members);
assert(aliToHossein.category === 'parent' && aliToHossein.label === 'پدر',
  'محاسبه نسبت پدر: حسین پدر علی است');

const aliToFatemeh = Kinship.calculateKinship('ali', 'fatemeh', members);
assert(aliToFatemeh.category === 'parent' && aliToFatemeh.label === 'مادر',
  'محاسبه نسبت مادر: فاطمه مادر علی است');

const aliToReza = Kinship.calculateKinship('ali', 'reza', members);
assert(aliToReza.category === 'sibling' && aliToReza.label.includes('برادر'),
  'محاسبه نسبت برادر: رضا برادر علی است');

const aliToMina = Kinship.calculateKinship('ali', 'mina', members);
assert(aliToMina.category === 'sibling_in_law' && aliToMina.label.includes('زن داداش'),
  'محاسبه نسبت زن داداش: مینا همسر برادر علی است');

const aliToHamid = Kinship.calculateKinship('ali', 'hamid', members);
assert(aliToHamid.category === 'sibling_in_law' && aliToHamid.label.includes('شوهر خواهر'),
  'محاسبه نسبت شوهر خواهر: حمید همسر خواهر علی است');

// آزمون جاری: زهرا و مینا (همسران دو برادر: علی و رضا)
const zahraToMina = Kinship.calculateKinship('zahra', 'mina', members);
assert(zahraToMina.category === 'jari' && zahraToMina.label === 'جاری',
  'محاسبه نسبت جاری: زن دو تا برادر نسبت به هم جاری هستند (زهرا و مینا)');

// آزمون باجناق: شوهر دو خواهر
const testBajenaghClan = {
  hassan: { id: 'hassan', firstName: 'حسن', gender: 'male', spouseIds: ['ziba'], childIds: [] },
  sadegh: { id: 'sadegh', firstName: 'صادق', gender: 'male', spouseIds: ['shiva'], childIds: [] },
  ziba: { id: 'ziba', firstName: 'زیبا', gender: 'female', fatherId: 'f1', motherId: 'm1', spouseIds: ['hassan'], childIds: [] },
  shiva: { id: 'shiva', firstName: 'شیوا', gender: 'female', fatherId: 'f1', motherId: 'm1', spouseIds: ['sadegh'], childIds: [] },
  f1: { id: 'f1', firstName: 'پدر', gender: 'male', childIds: ['ziba', 'shiva'] },
  m1: { id: 'm1', firstName: 'مادر', gender: 'female', childIds: ['ziba', 'shiva'] }
};
const bajenaghRes = Kinship.calculateKinship('hassan', 'sadegh', testBajenaghClan);
assert(bajenaghRes.category === 'bajenagh' && bajenaghRes.label === 'باجناق',
  'محاسبه نسبت باجناق: شوهر دو خواهر نسبت به هم باجناق هستند (حسن و صادق)');

// ۳. آزمون قانون خروج اعضای دارای پیوند از لیست در دسترس (Mutual Exclusion)
console.log('\n--- آزمون ۳: قانون خروج اعضای دارای پیوند از لیست در دسترس ---');
const candidatesForFather = Kinship.getEligibleCandidates('ali', 'father', members);
const canFatherIncludeHossein = candidatesForFather.some(m => m.id === 'hossein');
const canFatherIncludeFatemeh = candidatesForFather.some(m => m.id === 'fatemeh');
const canFatherIncludeSara = candidatesForFather.some(m => m.id === 'sara');
assert(!canFatherIncludeHossein, 'حسین که هم‌اکنون پدر علی است از لیست کاندیداهای جدید خارج شده است');
assert(!canFatherIncludeFatemeh, 'فاطمه که مادر علی است نمی‌تواند پدر شود');
assert(!canFatherIncludeSara, 'سارا که فرزند علی است نمی‌تواند پدر شود');

const candidatesForSpouse = Kinship.getEligibleCandidates('ali', 'spouse', members);
const canSpouseIncludeZahra = candidatesForSpouse.some(m => m.id === 'zahra');
const canSpouseIncludeSara = candidatesForSpouse.some(m => m.id === 'sara');
const canSpouseIncludeMales = candidatesForSpouse.some(m => m.gender === 'male');
assert(!canSpouseIncludeZahra, 'زهرا که همسر فعلی است از لیست انتخاب مجدد خارج است');
assert(!canSpouseIncludeSara, 'فرزند علی از لیست همسر خارج است');
assert(!canSpouseIncludeMales, 'تمام مردان از لیست همسر مرد (با فیلتر پیش‌فرض جنسیت) خارج هستند');

// ۴. آزمون هوش مصنوعی و مدل GPT-6-SOL-MAX
console.log('\n--- آزمون ۴: هوش مصنوعی و مدل GPT-6-SOL-MAX ---');
const aiAnalysis = AIDebugger.analyzeClan(demoClan);
assert(aiAnalysis.model === 'GPT-6-SOL-MAX', 'بررسی نام مدل هوش مصنوعی: GPT-6-SOL-MAX');
assert(aiAnalysis.gpt6BrideGroomReport.length > 0, `شناسایی موفق ${aiAnalysis.gpt6BrideGroomReport.length} رابطه عروس و داماد`);

const brideGroomPrompt = AIDebugger.processUserInstruction(
  'فقط با مدل gpt-6-sol-max، نسبت عروس و داماد را چک کن ببین اگر نیست اضافه کن',
  demoClan
);
assert(brideGroomPrompt.executedAction !== null, 'اجرای موفق دستور العمل کاربر در هوش مصنوعی');
assert(brideGroomPrompt.logSteps.some(l => l.includes('GPT-6-SOL-MAX')), 'ثبت فرآیند استدلال هوش مصنوعی با برچسب GPT-6-SOL-MAX');

// ۵. آزمون چند خاندانی و حذف کل خاندان
console.log('\n--- آزمون ۵: قابلیت بی‌نهایت خاندان و حذف کل خاندان ---');
const initialClansCount = Storage.getClans().length;
const newClan = Storage.createClan('خاندان دوم تست', 'توضیحات تست');
assert(newClan && newClan.id, 'ایجاد موفق خاندان جدید (امکان ایجاد بی‌نهایت خاندان)');
assert(Storage.getClans().length === initialClansCount + 1, 'افزایش تعداد خاندان‌ها');

const deleted = Storage.deleteClan(newClan.id);
assert(deleted === true, 'حذف موفق کل خاندان جدید (قابلیت حذف کل خاندان)');
assert(Storage.getClans().length === initialClansCount, 'بازگشت تعداد خاندان‌ها به حالت قبل');

// ۶. آزمون استقلال کامل از فیلترشکن (Zero CDN Dependencies)
console.log('\n--- آزمون ۶: استقلال کامل از فیلترشکن و وب خارجی ---');
const htmlContent = fs.readFileSync('./index.html', 'utf8');
const hasGoogleFonts = htmlContent.includes('fonts.googleapis.com');
const hasFontAwesomeCdn = htmlContent.includes('cdnjs.cloudflare.com') || htmlContent.includes('fontawesome');
const hasUnpkg = htmlContent.includes('unpkg.com');
assert(!hasGoogleFonts, 'عدم استفاده از Google Fonts (فیلتر یا کند در ایران)');
assert(!hasFontAwesomeCdn, 'عدم استفاده از CDN FontAwesome');
assert(!hasUnpkg, 'عدم استفاده از Unpkg');

console.log('\n========================================================');
console.log(`پایان آزمون‌ها: ${passCount} موفق | ${failCount} ناموفق`);
console.log('========================================================');

if (failCount > 0) {
  process.exit(1);
}
