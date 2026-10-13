/**
 * storage.js - مدیریت ذخیره‌سازی محلی (LocalStorage)، چند خاندانی (نامحدود)،
 * حذف کل خاندان، بدون پیش‌فرض اولیه و حفظ لحظه‌ای آخرین تغییرات
 */

const Storage = (() => {
  const STORAGE_KEY = 'shajareh_nameh_state_v2';

  // وضعیت اولیه خالی (بدون هیچ پیش‌فرض تحمیلی، مطابق دستور کاربر)
  const defaultState = {
    activeClanId: null,
    clans: {},
    settings: {
      theme: 'light',
      calendarPreference: 'jalali'
    }
  };

  let state = loadState();

  // بارگذاری از حافظه مرورگر
  function loadState() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('خطا در خواندن LocalStorage:', e);
    }
    return JSON.parse(JSON.stringify(defaultState));
  }

  // ذخیره خودکار وضعیت در LocalStorage
  function saveState() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch (e) {
      console.error('خطا در نوشتن در LocalStorage:', e);
    }
  }

  // ایجاد شناسه یکتا
  function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  // دریافت تمام خاندان‌ها
  function getClans() {
    return Object.values(state.clans || {});
  }

  // دریافت خاندان فعال
  function getActiveClan() {
    if (!state.activeClanId || !state.clans[state.activeClanId]) {
      const clanIds = Object.keys(state.clans || {});
      if (clanIds.length > 0) {
        state.activeClanId = clanIds[0];
        saveState();
      } else {
        return null;
      }
    }
    return state.clans[state.activeClanId];
  }

  // تغییر خاندان فعال
  function setActiveClan(clanId) {
    if (state.clans[clanId]) {
      state.activeClanId = clanId;
      saveState();
      return true;
    }
    return false;
  }

  // ایجاد خاندان جدید (امکان ایجاد بی‌نهایت خاندان)
  function createClan(name, description = '', emblem = '🌿') {
    const clanId = generateId('clan');
    const newClan = {
      id: clanId,
      name: (name || 'خاندان جدید').trim(),
      description: (description || '').trim(),
      emblem: emblem || '🌿',
      createdAt: new Date().toISOString(),
      focalPersonId: null,
      members: {}
    };

    if (!state.clans) state.clans = {};
    state.clans[clanId] = newClan;
    state.activeClanId = clanId;
    saveState();
    return newClan;
  }

  // حذف کامل یک خاندان (قابلیت حذف کل خاندان مطابق درخواست کاربر)
  function deleteClan(clanId) {
    if (!state.clans || !state.clans[clanId]) return false;

    delete state.clans[clanId];
    const remainingClanIds = Object.keys(state.clans);
    state.activeClanId = remainingClanIds.length > 0 ? remainingClanIds[0] : null;
    saveState();
    return true;
  }

  // ویرایش اطلاعات یک خاندان
  function updateClan(clanId, updates) {
    if (!state.clans || !state.clans[clanId]) return null;
    Object.assign(state.clans[clanId], updates);
    saveState();
    return state.clans[clanId];
  }

  // تنظیم فرد محوری
  function setFocalPerson(personId) {
    const clan = getActiveClan();
    if (!clan) return false;
    if (personId && !clan.members[personId]) return false;

    clan.focalPersonId = personId;
    saveState();
    return true;
  }

  // دریافت فرد محوری فعلی
  function getFocalPerson() {
    const clan = getActiveClan();
    if (!clan || !clan.focalPersonId) return null;
    return clan.members[clan.focalPersonId] || null;
  }

  // افزودن یا ویرایش عضو در خاندان فعال
  function saveMember(memberData) {
    const clan = getActiveClan();
    if (!clan) return null;

    let id = memberData.id;
    const isNew = !id;

    if (isNew) {
      id = generateId('person');
      memberData.id = id;
      memberData.createdAt = new Date().toISOString();
    }

    // مقادیر پیش‌فرض ساختار عضو
    const member = {
      id,
      firstName: (memberData.firstName || '').trim(),
      lastName: (memberData.lastName || '').trim(),
      gender: memberData.gender || 'male', // male | female | other
      isDeceased: Boolean(memberData.isDeceased),
      isHistorical: Boolean(memberData.isHistorical),
      birthDate: memberData.birthDate || { preferredCalendar: 'jalali', year: null, month: 1, day: 1 },
      deathDate: memberData.deathDate || { preferredCalendar: 'jalali', year: null, month: 1, day: 1 },
      age: memberData.age || null,
      photo: memberData.photo || null, // Base64 یا آدرس عکس
      fatherId: memberData.fatherId || null,
      motherId: memberData.motherId || null,
      spouseIds: Array.isArray(memberData.spouseIds) ? [...new Set(memberData.spouseIds)] : [],
      childIds: Array.isArray(memberData.childIds) ? [...new Set(memberData.childIds)] : [],
      // بخش توضیحات اضافه (علایق، فیلم، صوت، عکس)
      extraDetails: {
        interests: Array.isArray(memberData.extraDetails?.interests) ? memberData.extraDetails.interests : [],
        video: memberData.extraDetails?.video || null,
        audio: memberData.extraDetails?.audio || null,
        galleryPhotos: Array.isArray(memberData.extraDetails?.galleryPhotos) ? memberData.extraDetails.galleryPhotos : [],
        biography: memberData.extraDetails?.biography || ''
      },
      updatedAt: new Date().toISOString()
    };

    if (!clan.members) clan.members = {};
    clan.members[id] = member;

    // اگر اولین عضو خاندان باشد، خودکار فرد محوری شود
    if (Object.keys(clan.members).length === 1 || !clan.focalPersonId) {
      clan.focalPersonId = id;
    }

    saveState();
    return member;
  }

  // حذف یک عضو از خاندان فعال
  function deleteMember(memberId) {
    const clan = getActiveClan();
    if (!clan || !clan.members || !clan.members[memberId]) return false;

    // حذف پیوندها در سایر اعضا
    Object.values(clan.members).forEach(m => {
      if (m.fatherId === memberId) m.fatherId = null;
      if (m.motherId === memberId) m.motherId = null;
      if (m.spouseIds) m.spouseIds = m.spouseIds.filter(id => id !== memberId);
      if (m.childIds) m.childIds = m.childIds.filter(id => id !== memberId);
    });

    delete clan.members[memberId];

    if (clan.focalPersonId === memberId) {
      const remainingIds = Object.keys(clan.members);
      clan.focalPersonId = remainingIds.length > 0 ? remainingIds[0] : null;
    }

    saveState();
    return true;
  }

  // پیوند دو عضو به یکدیگر
  function linkRelation(personId, relationType, relativeId) {
    const clan = getActiveClan();
    if (!clan || !clan.members[personId] || !clan.members[relativeId]) return false;

    const person = clan.members[personId];
    const relative = clan.members[relativeId];

    if (relationType === 'father') {
      person.fatherId = relativeId;
      if (!relative.childIds) relative.childIds = [];
      if (!relative.childIds.includes(personId)) relative.childIds.push(personId);
    } else if (relationType === 'mother') {
      person.motherId = relativeId;
      if (!relative.childIds) relative.childIds = [];
      if (!relative.childIds.includes(personId)) relative.childIds.push(personId);
    } else if (relationType === 'spouse') {
      if (!person.spouseIds) person.spouseIds = [];
      if (!relative.spouseIds) relative.spouseIds = [];
      if (!person.spouseIds.includes(relativeId)) person.spouseIds.push(relativeId);
      if (!relative.spouseIds.includes(personId)) relative.spouseIds.push(personId);
    } else if (relationType === 'child') {
      if (!person.childIds) person.childIds = [];
      if (!person.childIds.includes(relativeId)) person.childIds.push(relativeId);
      if (person.gender === 'female') {
        relative.motherId = personId;
      } else {
        relative.fatherId = personId;
      }
    } else if (relationType === 'brother' || relationType === 'sister') {
      // برای خواهر یا برادر، اگر والدینی دارند پیوند داده شود، در غیر این صورت والدین مشترک برقرار شود
      if (person.fatherId && !relative.fatherId) relative.fatherId = person.fatherId;
      if (person.motherId && !relative.motherId) relative.motherId = person.motherId;
      if (relative.fatherId && !person.fatherId) person.fatherId = relative.fatherId;
      if (relative.motherId && !person.motherId) person.motherId = relative.motherId;

      if (person.fatherId && clan.members[person.fatherId]) {
        const f = clan.members[person.fatherId];
        if (!f.childIds) f.childIds = [];
        if (!f.childIds.includes(relativeId)) f.childIds.push(relativeId);
        if (!f.childIds.includes(personId)) f.childIds.push(personId);
      }
    }

    saveState();
    return true;
  }

  // حذف پیوند بین دو عضو
  function unlinkRelation(personId, relationType, relativeId) {
    const clan = getActiveClan();
    if (!clan || !clan.members[personId]) return false;

    const person = clan.members[personId];
    const relative = relativeId && clan.members[relativeId] ? clan.members[relativeId] : null;

    if (relationType === 'father' && person.fatherId === relativeId) {
      person.fatherId = null;
      if (relative && relative.childIds) {
        relative.childIds = relative.childIds.filter(id => id !== personId);
      }
    } else if (relationType === 'mother' && person.motherId === relativeId) {
      person.motherId = null;
      if (relative && relative.childIds) {
        relative.childIds = relative.childIds.filter(id => id !== personId);
      }
    } else if (relationType === 'spouse') {
      if (person.spouseIds) {
        person.spouseIds = person.spouseIds.filter(id => id !== relativeId);
      }
      if (relative && relative.spouseIds) {
        relative.spouseIds = relative.spouseIds.filter(id => id !== personId);
      }
    } else if (relationType === 'child') {
      if (person.childIds) {
        person.childIds = person.childIds.filter(id => id !== relativeId);
      }
      if (relative) {
        if (relative.fatherId === personId) relative.fatherId = null;
        if (relative.motherId === personId) relative.motherId = null;
      }
    } else if (relationType === 'sibling') {
      // قطع پیوند والدینی مشترک
      if (relative) {
        if (relative.fatherId === person.fatherId && person.fatherId) relative.fatherId = null;
        if (relative.motherId === person.motherId && person.motherId) relative.motherId = null;
      }
    }

    saveState();
    return true;
  }

  // بارگذاری داده نمونه آزمایشی جامع (برای تست آسان روابط پیچیده، عروس، داماد، جاری، باجناق و ازدواج فامیلی)
  function loadDemoData() {
    const demoClanId = 'clan_demo_alavi';
    const demoClan = {
      id: demoClanId,
      name: 'خاندان نمونه بزرگ علوی',
      description: 'شجره‌نامه نمونه جهت بررسی روابط پیچیده، عروس، داماد، جاری، باجناق، نوه و ازدواج فامیلی',
      emblem: '👑',
      createdAt: new Date().toISOString(),
      focalPersonId: 'ali',
      members: {
        // پدربزرگ و مادربزرگ
        hossein: {
          id: 'hossein',
          firstName: 'حاج حسین',
          lastName: 'علوی',
          gender: 'male',
          isDeceased: true,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1305, month: 2, day: 10 },
          deathDate: { preferredCalendar: 'jalali', year: 1385, month: 7, day: 15 },
          age: 80,
          photo: null,
          fatherId: null,
          motherId: null,
          spouseIds: ['fatemeh'],
          childIds: ['ali', 'reza', 'maryam'],
          extraDetails: { interests: ['شعر و ادبیات', 'باغبانی و گلکاری'], video: null, audio: null, galleryPhotos: [], biography: 'بزرگ خاندان علوی، متدین و معتمد محله' }
        },
        fatemeh: {
          id: 'fatemeh',
          firstName: 'حاجیه فاطمه',
          lastName: 'محمدی',
          gender: 'female',
          isDeceased: true,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1310, month: 5, day: 20 },
          deathDate: { preferredCalendar: 'jalali', year: 1392, month: 11, day: 4 },
          age: 82,
          photo: null,
          fatherId: null,
          motherId: null,
          spouseIds: ['hossein'],
          childIds: ['ali', 'reza', 'maryam'],
          extraDetails: { interests: ['آشپزی سنتی', 'صنایع دستی'], video: null, audio: null, galleryPhotos: [], biography: 'مادر مهربان و فداکار خاندان' }
        },

        // عموی دیگر (برای ایجاد دختر عمو)
        hasan: {
          id: 'hasan',
          firstName: 'حسن',
          lastName: 'علوی',
          gender: 'male',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1335, month: 3, day: 1 },
          deathDate: null,
          age: 70,
          photo: null,
          fatherId: null, // برادر حسین (برای تست عمو و دخترعمو)
          motherId: null,
          spouseIds: ['parvin'],
          childIds: ['zahra'], // زهرا دختر حسن است
          extraDetails: { interests: ['خوشنویسی', 'مطالعه کتاب'], video: null, audio: null, galleryPhotos: [], biography: 'استاد خوشنویسی و فرهنگ ایرانی' }
        },
        parvin: {
          id: 'parvin',
          firstName: 'پروین',
          lastName: 'یزدانی',
          gender: 'female',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1340, month: 6, day: 12 },
          deathDate: null,
          age: 65,
          photo: null,
          fatherId: null,
          motherId: null,
          spouseIds: ['hasan'],
          childIds: ['zahra'],
          extraDetails: { interests: ['نقاشی و هنر'], video: null, audio: null, galleryPhotos: [], biography: 'معلم بازنشسته ادبیات' }
        },

        // فرد محوری: علی
        ali: {
          id: 'ali',
          firstName: 'علی',
          lastName: 'علوی',
          gender: 'male',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1342, month: 8, day: 15 },
          deathDate: null,
          age: 63,
          photo: null,
          fatherId: 'hossein',
          motherId: 'fatemeh',
          spouseIds: ['zahra'], // همسرش زهرا دختر عمویش است!
          childIds: ['mohammad', 'sara'],
          extraDetails: { interests: ['کوهنوردی و طبیعت', 'عکاسی', 'تاریخ و کهن‌شناسی'], video: null, audio: null, galleryPhotos: [], biography: 'مهندس ارشد عمران و پژوهشگر تاریخ خانوادگی' }
        },

        // همسر علی: زهرا (دختر حسن، ازدواج فامیلی - دختر عمو)
        zahra: {
          id: 'zahra',
          firstName: 'زهرا',
          lastName: 'علوی',
          gender: 'female',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1345, month: 4, day: 22 },
          deathDate: null,
          age: 60,
          photo: null,
          fatherId: 'hasan', // خط نسب پدری به حسن متصل است!
          motherId: 'parvin',
          spouseIds: ['ali'],
          childIds: ['mohammad', 'sara'],
          extraDetails: { interests: ['موسیقی سنتی', 'شعر و ادبیات'], video: null, audio: null, galleryPhotos: [], biography: 'پزشک عمومی و عضو هیئت علمی دانشگاه' }
        },

        // برادر علی: رضا
        reza: {
          id: 'reza',
          firstName: 'رضا',
          lastName: 'علوی',
          gender: 'male',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1348, month: 1, day: 10 },
          deathDate: null,
          age: 57,
          photo: null,
          fatherId: 'hossein',
          motherId: 'fatemeh',
          spouseIds: ['mina'],
          childIds: ['sina'],
          extraDetails: { interests: ['ورزش و تناسب اندام', 'سفر و گردشگری'], video: null, audio: null, galleryPhotos: [], biography: 'مترجم زبان‌های باستانی' }
        },

        // همسر رضا: مینا (نسبت به زهرا = جاری)
        mina: {
          id: 'mina',
          firstName: 'مینا',
          lastName: 'کریمیان',
          gender: 'female',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1352, month: 9, day: 18 },
          deathDate: null,
          age: 53,
          photo: null,
          fatherId: null,
          motherId: null,
          spouseIds: ['reza'],
          childIds: ['sina'],
          extraDetails: { interests: ['طراحی دکوراسیون', 'باغبانی و گلکاری'], video: null, audio: null, galleryPhotos: [], biography: 'مهندس معمار' }
        },

        // خواهر علی: مریم
        maryam: {
          id: 'maryam',
          firstName: 'مریم',
          lastName: 'علوی',
          gender: 'female',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1355, month: 12, day: 5 },
          deathDate: null,
          age: 50,
          photo: null,
          fatherId: 'hossein',
          motherId: 'fatemeh',
          spouseIds: ['hamid'],
          childIds: ['yalda'],
          extraDetails: { interests: ['نقاشی و هنر', 'مطالعه کتاب'], video: null, audio: null, galleryPhotos: [], biography: 'پژوهشگر تاریخ معاصر' }
        },
        hamid: {
          id: 'hamid',
          firstName: 'حمید',
          lastName: 'دانشفر',
          gender: 'male',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1350, month: 3, day: 14 },
          deathDate: null,
          age: 55,
          photo: null,
          fatherId: null,
          motherId: null,
          spouseIds: ['maryam'],
          childIds: ['yalda'],
          extraDetails: { interests: ['علم و فناوری'], video: null, audio: null, galleryPhotos: [], biography: 'استاد جامعه‌شناسی' }
        },

        // پسر علی: محمد
        mohammad: {
          id: 'mohammad',
          firstName: 'محمد',
          lastName: 'علوی',
          gender: 'male',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1368, month: 2, day: 16 },
          deathDate: null,
          age: 37,
          photo: null,
          fatherId: 'ali',
          motherId: 'zahra',
          spouseIds: ['neda'],
          childIds: ['kian'],
          extraDetails: { interests: ['علم و فناوری', 'نجوم'], video: null, audio: null, galleryPhotos: [], biography: 'توسعه‌دهنده نرم‌افزار و هوش مصنوعی' }
        },

        // عروس علی (همسر محمد): ندا
        // [بررسی ویژه با مدل GPT-6-SOL-MAX]
        neda: {
          id: 'neda',
          firstName: 'ندا',
          lastName: 'شفیعی',
          gender: 'female',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1371, month: 6, day: 9 },
          deathDate: null,
          age: 34,
          photo: null,
          fatherId: null,
          motherId: null,
          spouseIds: ['mohammad'],
          childIds: ['kian'],
          extraDetails: { interests: ['عکاسی', 'سفر و گردشگری'], video: null, audio: null, galleryPhotos: [], biography: 'طراح رابط کاربری و گرافیست' }
        },

        // دختر علی: سارا
        sara: {
          id: 'sara',
          firstName: 'سارا',
          lastName: 'علوی',
          gender: 'female',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1373, month: 10, day: 25 },
          deathDate: null,
          age: 32,
          photo: null,
          fatherId: 'ali',
          motherId: 'zahra',
          spouseIds: ['babak'],
          childIds: ['dorsa'],
          extraDetails: { interests: ['موسیقی سنتی', 'شعر و ادبیات'], video: null, audio: null, galleryPhotos: [], biography: 'نوازنده تار و مدرس موسیقی' }
        },

        // داماد علی (همسر سارا): بابک
        // [بررسی ویژه با مدل GPT-6-SOL-MAX]
        babak: {
          id: 'babak',
          firstName: 'بابک',
          lastName: 'روشن',
          gender: 'male',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1370, month: 8, day: 3 },
          deathDate: null,
          age: 35,
          photo: null,
          fatherId: null,
          motherId: null,
          spouseIds: ['sara'],
          childIds: ['dorsa'],
          extraDetails: { interests: ['ورزش و تناسب اندام', 'کوهنوردی و طبیعت'], video: null, audio: null, galleryPhotos: [], biography: 'پژوهشگر علوم زیستی' }
        },

        // نوه‌ها:
        // نوه پسری علی: کیان (پسر محمد و ندا)
        kian: {
          id: 'kian',
          firstName: 'کیان',
          lastName: 'علوی',
          gender: 'male',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1398, month: 5, day: 12 },
          deathDate: null,
          age: 7,
          photo: null,
          fatherId: 'mohammad',
          motherId: 'neda',
          spouseIds: [],
          childIds: [],
          extraDetails: { interests: ['علم و فناوری', 'نقاشی و هنر'], video: null, audio: null, galleryPhotos: [], biography: 'دانش‌آموز پرانرژی و علاقه‌مند به روباتیک' }
        },

        // نوه دختری علی: درسا (دختر سارا و بابک)
        dorsa: {
          id: 'dorsa',
          firstName: 'درسا',
          lastName: 'روشن',
          gender: 'female',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1400, month: 11, day: 20 },
          deathDate: null,
          age: 5,
          photo: null,
          fatherId: 'babak',
          motherId: 'sara',
          spouseIds: [],
          childIds: [],
          extraDetails: { interests: ['نقاشی و هنر', 'موسیقی سنتی'], video: null, audio: null, galleryPhotos: [], biography: 'نوه شیرین‌زبان خاندان علوی' }
        },

        // برادرزاده علی: سینا (پسر برادرش رضا)
        sina: {
          id: 'sina',
          firstName: 'سینا',
          lastName: 'علوی',
          gender: 'male',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1380, month: 7, day: 14 },
          deathDate: null,
          age: 25,
          photo: null,
          fatherId: 'reza',
          motherId: 'mina',
          spouseIds: [],
          childIds: [],
          extraDetails: { interests: ['علم و فناوری', 'عکاسی'], video: null, audio: null, galleryPhotos: [], biography: 'دانشجوی هوش مصنوعی' }
        },

        // خواهرزاده علی: یلدا (دختر خواهرش مریم)
        yalda: {
          id: 'yalda',
          firstName: 'یلدا',
          lastName: 'دانشفر',
          gender: 'female',
          isDeceased: false,
          isHistorical: false,
          birthDate: { preferredCalendar: 'jalali', year: 1383, month: 9, day: 30 },
          deathDate: null,
          age: 22,
          photo: null,
          fatherId: 'hamid',
          motherId: 'maryam',
          spouseIds: [],
          childIds: [],
          extraDetails: { interests: ['شعر و ادبیات', 'خوشنویسی'], video: null, audio: null, galleryPhotos: [], biography: 'دانشجوی ادبیات فارسی' }
        },

        // شخصیت تاریخی نمونه: کوروش بزرگ (جهت بررسی ویژگی تاریخ قبل از میلاد ق.م)
        cyrus: {
          id: 'cyrus',
          firstName: 'کوروش',
          lastName: 'بزرگ (هخامنشی)',
          gender: 'male',
          isDeceased: true,
          isHistorical: true,
          birthDate: { isHistorical: true, era: 'BC', year: 550, month: 1, day: 1 },
          deathDate: { isHistorical: true, era: 'BC', year: 530, month: 1, day: 1 },
          age: 20,
          photo: null,
          fatherId: null,
          motherId: null,
          spouseIds: [],
          childIds: [],
          extraDetails: { interests: ['تاریخ و کهن‌شناسی', 'فلسفه و عرفان'], video: null, audio: null, galleryPhotos: [], biography: 'بنیان‌گذار شاهنشاهی کهن ایران و نویسنده نخستین منشور حقوق بشر جهان' }
        }
      }
    };

    if (!state.clans) state.clans = {};
    state.clans[demoClanId] = demoClan;
    state.activeClanId = demoClanId;
    saveState();
    return demoClan;
  }

  // خروجی و پشتیبان‌گیری به صورت فایل JSON
  function exportData() {
    return JSON.stringify(state, null, 2);
  }

  // وارد کردن داده از فایل JSON
  function importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === 'object') {
        state = parsed;
        saveState();
        return true;
      }
    } catch (e) {
      console.error('خطا در بارگذاری JSON:', e);
    }
    return false;
  }

  return {
    getClans,
    getActiveClan,
    setActiveClan,
    createClan,
    deleteClan,
    updateClan,
    setFocalPerson,
    getFocalPerson,
    saveMember,
    deleteMember,
    linkRelation,
    unlinkRelation,
    loadDemoData,
    exportData,
    importData,
    saveState
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Storage;
}
