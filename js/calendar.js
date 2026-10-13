/**
 * calendar.js - مبدل تقویم‌های هجری خورشیدی (شمسی)، میلادی، هجری قمری و سال‌های تاریخی (قبل و بعد از میلاد)
 * کاملاً مستقل، آفلاین و بدون وابستگی خارجی (بدون نیاز به فیلترشکن)
 */

const Calendar = (() => {
  // نام ماه‌های تقویم‌های مختلف
  const MONTHS_JALALI = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];

  const MONTHS_GREGORIAN = [
    'ژانویه (January)', 'فوریه (February)', 'مارس (March)', 'آوریل (April)',
    'مه (May)', 'ژوئن (June)', 'ژوئیه (July)', 'اوت (August)',
    'سپتامبر (September)', 'اکتبر (October)', 'نوامبر (November)', 'دسامبر (December)'
  ];

  const MONTHS_HIJRI = [
    'محرم', 'صفر', 'ربیع‌الاول', 'ربیع‌الثانی', 'جمادی‌الاول', 'جمادی‌الثانی',
    'رجب', 'شعبان', 'رمضان', 'شوال', 'ذیقعده', 'ذیحجه'
  ];

  // تبدیل هجری خورشیدی (شمسی) به میلادی
  function jalaliToGregorian(jy, jm, jd) {
    jy = parseInt(jy, 10);
    jm = parseInt(jm, 10);
    jd = parseInt(jd, 10);
    if (isNaN(jy) || isNaN(jm) || isNaN(jd)) return null;

    let gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;

    let days = (365 * jy) + ((parseInt(jy / 33, 10)) * 8) + (parseInt(((jy % 33) + 3) / 4, 10)) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : (((jm - 7) * 30) + 186));
    gy += 400 * (parseInt(days / 146097, 10));
    days %= 146097;

    if (days > 36524) {
      gy += 100 * (parseInt(--days / 36524, 10));
      days %= 36524;
      if (days >= 365) days++;
    }

    gy += 4 * (parseInt(days / 1461, 10));
    days %= 1461;

    if (days > 365) {
      gy += parseInt((days - 1) / 365, 10);
      days = (days - 1) % 365;
    }

    let gd = days + 1;
    let sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm;
    for (gm = 0; gm < 13; gm++) {
      let v = sal_a[gm];
      if (gd <= v) break;
      gd -= v;
    }
    return { year: gy, month: gm, day: gd };
  }

  // تبدیل میلادی به هجری خورشیدی (شمسی)
  function gregorianToJalali(gy, gm, gd) {
    gy = parseInt(gy, 10);
    gm = parseInt(gm, 10);
    gd = parseInt(gd, 10);
    if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return null;

    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    let gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + (parseInt((gy2 + 3) / 4, 10)) - (parseInt((gy2 + 99) / 100, 10)) + (parseInt((gy2 + 399) / 400, 10)) - 80 + gd + g_d_m[gm - 1];

    jy += 33 * (parseInt(days / 12053, 10));
    days %= 12053;
    jy += 4 * (parseInt(days / 1461, 10));
    days %= 1461;

    if (days > 365) {
      jy += parseInt((days - 1) / 365, 10);
      days = (days - 1) % 365;
    }

    let jm = (days < 186) ? 1 + parseInt(days / 31, 10) : 7 + parseInt((days - 186) / 30, 10);
    let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return { year: jy, month: jm, day: jd };
  }

  // میلادی به روز ژولینی
  function gregorianToJdn(year, month, day) {
    let a = Math.floor((14 - month) / 12);
    let y = year + 4800 - a;
    let m = month + 12 * a - 3;
    return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  }

  // روز ژولینی به میلادی
  function jdnToGregorian(jd) {
    let l = jd + 68569;
    let n = Math.floor((4 * l) / 146097);
    l = l - Math.floor((146097 * n + 3) / 4);
    let i = Math.floor((4000 * (l + 1)) / 1461001);
    l = l - Math.floor((1461 * i) / 4) + 31;
    let j = Math.floor((80 * l) / 2447);
    let day = l - Math.floor((2447 * j) / 80);
    l = Math.floor(j / 11);
    let month = j + 2 - 12 * l;
    let year = 100 * (n - 49) + i + l;
    return { year, month, day };
  }

  // میلادی به هجری قمری (الگوریتم کویتی دقیق)
  function gregorianToHijri(gy, gm, gd) {
    gy = parseInt(gy, 10);
    gm = parseInt(gm, 10);
    gd = parseInt(gd, 10);
    if (isNaN(gy) || isNaN(gm) || isNaN(gd)) return null;

    let jd = gregorianToJdn(gy, gm, gd);
    let l = jd - 1948440 + 10632;
    let n = Math.floor((l - 1) / 10631);
    l = l - 10631 * n + 354;
    let j = (Math.floor((10985 - l) / 5316)) * (Math.floor((50 * l) / 17719)) + (Math.floor(l / 5670)) * (Math.floor((43 * l) / 15238));
    l = l - (Math.floor((30 - j) / 15)) * (Math.floor((17719 * j) / 50)) - (Math.floor(j / 16)) * (Math.floor((15238 * j) / 43)) + 29;
    let m = Math.floor((24 * l) / 709);
    let d = l - Math.floor((709 * m) / 24);
    let y = 30 * n + j - 30;
    return { year: y, month: m, day: d };
  }

  // هجری قمری به میلادی
  function hijriToGregorian(hy, hm, hd) {
    hy = parseInt(hy, 10);
    hm = parseInt(hm, 10);
    hd = parseInt(hd, 10);
    if (isNaN(hy) || isNaN(hm) || isNaN(hd)) return null;

    let k = Math.floor((11 * hy + 3) / 30) + 354 * hy + 30 * hm - Math.floor((hm - 1) / 2) + hd + 1948440 - 385;
    return jdnToGregorian(k);
  }

  // تبدیل همه‌جانبه از هر تقویمی به تقویم‌های دیگر
  function convertDate(sourceSystem, year, month = 1, day = 1) {
    year = parseInt(year, 10);
    month = parseInt(month, 10) || 1;
    day = parseInt(day, 10) || 1;

    let gDate;
    if (sourceSystem === 'jalali') {
      gDate = jalaliToGregorian(year, month, day);
    } else if (sourceSystem === 'hijri') {
      gDate = hijriToGregorian(year, month, day);
    } else {
      gDate = { year, month, day };
    }

    if (!gDate) return null;

    const jDate = gregorianToJalali(gDate.year, gDate.month, gDate.day);
    const hDate = gregorianToHijri(gDate.year, gDate.month, gDate.day);

    return {
      jalali: jDate,
      gregorian: gDate,
      hijri: hDate
    };
  }

  // قالب‌بندی تاریخ جهت نمایش
  function formatDateString(dateRecord) {
    if (!dateRecord) return 'ثبت نشده';

    // اگر شخصیت تاریخی با ق.م یا ب.م باشد
    if (dateRecord.isHistorical) {
      const eraLabel = dateRecord.era === 'BC' ? 'قبل از میلاد (ق.م)' : 'بعد از میلاد (ب.م)';
      let str = `${Math.abs(dateRecord.year)} ${eraLabel}`;
      if (dateRecord.month) {
        str += ` - ماه ${dateRecord.month}`;
      }
      if (dateRecord.day) {
        str += `، روز ${dateRecord.day}`;
      }
      return str;
    }

    // تقویم معمولی
    const system = dateRecord.preferredCalendar || 'jalali';
    const y = dateRecord.year;
    const m = dateRecord.month || 1;
    const d = dateRecord.day || 1;

    if (!y) return 'ثبت نشده';

    if (system === 'jalali') {
      const mName = MONTHS_JALALI[m - 1] || '';
      return `${d} ${mName} ${y} خورشیدی`;
    } else if (system === 'gregorian') {
      const mName = MONTHS_GREGORIAN[m - 1] || '';
      return `${d} ${mName} ${y} میلادی`;
    } else if (system === 'hijri') {
      const mName = MONTHS_HIJRI[m - 1] || '';
      return `${d} ${mName} ${y} قمری`;
    }

    return `${y}/${m}/${d}`;
  }

  // محاسبه سن هوشمند (هم برای افراد عادی و هم تاریخی)
  function computeAge(birth, death, isDeceased) {
    if (!birth || !birth.year) return null;

    // افراد تاریخی
    if (birth.isHistorical) {
      const birthYear = birth.era === 'BC' ? -Math.abs(birth.year) : Math.abs(birth.year);
      let targetYear;

      if (isDeceased && death && death.year) {
        targetYear = death.era === 'BC' ? -Math.abs(death.year) : Math.abs(death.year);
      } else {
        // اگر هنوز زنده فرض شده (غیرمحتمل برای باستان) یا تاریخ وفات ثبت نشده
        return null;
      }

      // محاسبه تفاوت سال با در نظر گرفتن نبودن سال صفر
      let diff;
      if (birthYear < 0 && targetYear > 0) {
        diff = targetYear - birthYear - 1;
      } else {
        diff = targetYear - birthYear;
      }

      return diff >= 0 ? diff : null;
    }

    // افراد معمولی
    const currentYearJalali = 1405; // تاریخ روز در تقویم شمسی
    const currentYearGregorian = new Date().getFullYear();

    let birthGYear = birth.year;
    if (birth.preferredCalendar === 'jalali') {
      const converted = jalaliToGregorian(birth.year, birth.month || 1, birth.day || 1);
      if (converted) birthGYear = converted.year;
    } else if (birth.preferredCalendar === 'hijri') {
      const converted = hijriToGregorian(birth.year, birth.month || 1, birth.day || 1);
      if (converted) birthGYear = converted.year;
    }

    let endGYear = currentYearGregorian;
    if (isDeceased && death && death.year) {
      endGYear = death.year;
      if (death.preferredCalendar === 'jalali') {
        const converted = jalaliToGregorian(death.year, death.month || 1, death.day || 1);
        if (converted) endGYear = converted.year;
      } else if (death.preferredCalendar === 'hijri') {
        const converted = hijriToGregorian(death.year, death.month || 1, death.day || 1);
        if (converted) endGYear = converted.year;
      }
    }

    const age = endGYear - birthGYear;
    return age >= 0 && age <= 140 ? age : (age > 140 ? age : null);
  }

  return {
    MONTHS_JALALI,
    MONTHS_GREGORIAN,
    MONTHS_HIJRI,
    jalaliToGregorian,
    gregorianToJalali,
    hijriToGregorian,
    gregorianToHijri,
    convertDate,
    formatDateString,
    computeAge
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Calendar;
}
