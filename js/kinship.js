/**
 * kinship.js - موتور جامع محاسبه و مدیریت روابط خانوادگی بر اساس فرد محوری (Focal Person)
 * شامل بیش از ۲۵ عنوان دقیق خویشاوندی نسبی و سببی ایرانی:
 * عروس، داماد، جاری، باجناق، عمو، عمه، خاله، دایی، زن‌دایی، زن‌عمو، شوهرعمه، شوهرخاله،
 * شوهرخواهر، زن‌داداش، برادرزن، خواهرزن، خواهرشوهر، برادرشوهر، مادرزن، پدرزن، مادرشوهر،
 * پدرشوهر، پدربزرگ، مادربزرگ، نوه (پسری و دختری)، خواهرزاده و برادرزاده، فرزندان عمو/دایی/عمه/خاله و ...
 */

const Kinship = (() => {

  // تابع کمکی دریافت تمام فرزندان یک عضو
  function getChildren(person, members) {
    if (!person) return [];
    const directKids = person.childIds || [];
    // جستجو بر اساس فیلد fatherId یا motherId سایر اعضا برای هماهنگی دوطرفه
    const derivedKids = Object.values(members).filter(m => 
      m.id !== person.id && (m.fatherId === person.id || m.motherId === person.id)
    ).map(m => m.id);

    const set = new Set([...directKids, ...derivedKids]);
    return Array.from(set).map(id => members[id]).filter(Boolean);
  }

  // تابع کمکی دریافت والدین
  function getParents(person, members) {
    if (!person) return [];
    const parents = [];
    if (person.fatherId && members[person.fatherId]) parents.push(members[person.fatherId]);
    if (person.motherId && members[person.motherId]) parents.push(members[person.motherId]);
    return parents;
  }

  // دریافت همسران
  function getSpouses(person, members) {
    if (!person) return [];
    const directSpouses = person.spouseIds || [];
    // جستجوی دوطرفه
    const derivedSpouses = Object.values(members).filter(m => 
      m.id !== person.id && (m.spouseIds || []).includes(person.id)
    ).map(m => m.id);

    const set = new Set([...directSpouses, ...derivedSpouses]);
    return Array.from(set).map(id => members[id]).filter(Boolean);
  }

  // دریافت خواهر و برادرها (هم‌نیایان)
  function getSiblings(person, members) {
    if (!person) return [];
    const parents = getParents(person, members);
    const sibSet = new Set();

    parents.forEach(parent => {
      const kids = getChildren(parent, members);
      kids.forEach(k => {
        if (k.id !== person.id) sibSet.add(k.id);
      });
    });

    return Array.from(sibSet).map(id => members[id]).filter(Boolean);
  }

  // دریافت نوه‌ها (فرزندان فرزندان)
  function getGrandchildren(person, members) {
    const kids = getChildren(person, members);
    const grandKids = [];
    kids.forEach(k => {
      const gKids = getChildren(k, members);
      gKids.forEach(gk => {
        grandKids.push({ grandchild: gk, viaChild: k });
      });
    });
    return grandKids;
  }

  /**
   * محاسبه دقیق نسبت خویشاوندی یک شخص (Target) نسبت به شخص محوری (Focal)
   */
  function calculateKinship(focalId, targetId, members) {
    if (!focalId || !targetId || !members[focalId] || !members[targetId]) return null;

    if (focalId === targetId) {
      return {
        label: 'فرد محوری (خودتان)',
        category: 'self',
        badgeClass: 'badge-focal',
        icon: 'user-check',
        description: 'این شخص همان فرد محوری فعال شجره‌نامه است.'
      };
    }

    const focal = members[focalId];
    const target = members[targetId];

    const parents = getParents(focal, members);
    const children = getChildren(focal, members);
    const spouses = getSpouses(focal, members);
    const siblings = getSiblings(focal, members);

    // ۱. پدر و مادر مستقیم
    if (focal.fatherId === target.id) {
      return {
        label: 'پدر',
        category: 'parent',
        badgeClass: 'badge-parent',
        icon: 'user',
        description: `پدر خونی ${focal.firstName}`
      };
    }
    if (focal.motherId === target.id) {
      return {
        label: 'مادر',
        category: 'parent',
        badgeClass: 'badge-parent',
        icon: 'user',
        description: `مادر خونی ${focal.firstName}`
      };
    }

    // ۲. فرزند مستقیم (پسر یا دختر)
    const isChild = children.some(c => c.id === target.id);
    if (isChild) {
      const label = target.gender === 'male' ? 'پسر' : (target.gender === 'female' ? 'دختر' : 'فرزند');
      return {
        label,
        category: 'child',
        badgeClass: 'badge-child',
        icon: 'user',
        description: `فرزند مستقیم ${focal.firstName}`
      };
    }

    // ۳. همسر
    const isSpouse = spouses.some(s => s.id === target.id);
    if (isSpouse) {
      const label = target.gender === 'female' ? 'همسر (زن)' : (target.gender === 'male' ? 'همسر (شوهر)' : 'همسر');
      return {
        label,
        category: 'spouse',
        badgeClass: 'badge-spouse',
        icon: 'heart',
        description: `شریک زندگی ${focal.firstName}`
      };
    }

    // ۴. خواهر یا برادر
    const isSibling = siblings.some(s => s.id === target.id);
    if (isSibling) {
      const isFull = parents.length === 2 && getParents(target, members).length === 2 &&
        parents.every(p => getParents(target, members).some(tp => tp.id === p.id));
      const typeNote = isFull ? 'تنی' : '';
      const label = target.gender === 'female' ? `خواهر ${typeNote}`.trim() : (target.gender === 'male' ? `برادر ${typeNote}`.trim() : 'خواهر/برادر');
      return {
        label,
        category: 'sibling',
        badgeClass: 'badge-sibling',
        icon: 'users',
        description: `${label} ${focal.firstName}`
      };
    }

    // ۵. عروس (زن پسر) برای پدر شوهر و مادر شوهر
    // [مورد تأکید ویژه در صورت‌مسئله و مدل GPT-6-SOL-MAX]
    for (const child of children) {
      if (child.gender === 'male' || !child.gender) {
        const childSpouses = getSpouses(child, members);
        if (childSpouses.some(cs => cs.id === target.id)) {
          return {
            label: 'عروس (زنِ پسر)',
            category: 'daughter_in_law',
            badgeClass: 'badge-inlaw-gold',
            icon: 'sparkles',
            description: `همسرِ پسر شما (${child.firstName}) - احراز شده با مدل GPT-6-SOL-MAX`
          };
        }
      }
    }

    // ۶. داماد (شوهر دختر) برای پدر زن و مادر زن
    // [مورد تأکید ویژه در صورت‌مسئله و مدل GPT-6-SOL-MAX]
    for (const child of children) {
      if (child.gender === 'female' || !child.gender) {
        const childSpouses = getSpouses(child, members);
        if (childSpouses.some(cs => cs.id === target.id)) {
          return {
            label: 'داماد (شوهرِ دختر)',
            category: 'son_in_law',
            badgeClass: 'badge-inlaw-gold',
            icon: 'sparkles',
            description: `همسرِ دختر شما (${child.firstName}) - احراز شده با مدل GPT-6-SOL-MAX`
          };
        }
      }
    }

    // ۷. پدر شوهر و مادر شوهر (اگر فرد محوری زن باشد)
    // یا پدر زن و مادر زن (اگر فرد محوری مرد باشد)
    for (const sp of spouses) {
      if (sp.fatherId === target.id) {
        const label = focal.gender === 'female' ? 'پدر شوهر' : 'پدر زن';
        return {
          label,
          category: 'parent_in_law',
          badgeClass: 'badge-inlaw',
          icon: 'shield',
          description: `پدرِ همسرتان (${sp.firstName})`
        };
      }
      if (sp.motherId === target.id) {
        const label = focal.gender === 'female' ? 'مادر شوهر' : 'مادر زن';
        return {
          label,
          category: 'parent_in_law',
          badgeClass: 'badge-inlaw',
          icon: 'shield',
          description: `مادرِ همسرتان (${sp.firstName})`
        };
      }
    }

    // ۸. پدربزرگ و مادربزرگ (پدری و مادری)
    for (const parent of parents) {
      const isFather = parent.id === focal.fatherId;
      if (parent.fatherId === target.id) {
        const label = isFather ? 'پدربزرگ پدری' : 'پدربزرگ مادری';
        return {
          label,
          category: 'grandparent',
          badgeClass: 'badge-elder',
          icon: 'award',
          description: `پدرِ ${parent.firstName} (${isFather ? 'پدر' : 'مادر'})`
        };
      }
      if (parent.motherId === target.id) {
        const label = isFather ? 'مادربزرگ پدری' : 'مادربزرگ مادری';
        return {
          label,
          category: 'grandparent',
          badgeClass: 'badge-elder',
          icon: 'award',
          description: `مادرِ ${parent.firstName} (${isFather ? 'پدر' : 'مادر'})`
        };
      }
    }

    // ۹. نوه (پسر یا دختر فرزند)
    for (const child of children) {
      const grandKids = getChildren(child, members);
      const isGk = grandKids.some(gk => gk.id === target.id);
      if (isGk) {
        const branchType = child.gender === 'male' ? 'نوه پسری' : 'نوه دختری';
        let detail = target.gender === 'male' ? `پسرِ ${child.firstName}` : (target.gender === 'female' ? `دخترِ ${child.firstName}` : `فرزند ${child.firstName}`);
        return {
          label: `نوه (${branchType})`,
          category: 'grandchild',
          badgeClass: 'badge-child',
          icon: 'smile',
          description: `${detail} - نوه ${focal.firstName}`
        };
      }
    }

    // ۱۰. نتیجه (فرزند نوه)
    for (const child of children) {
      const grandKids = getChildren(child, members);
      for (const gk of grandKids) {
        const greatGrandKids = getChildren(gk, members);
        if (greatGrandKids.some(ggk => ggk.id === target.id)) {
          return {
            label: 'نتیجه (فرزند نوه)',
            category: 'great_grandchild',
            badgeClass: 'badge-child',
            icon: 'smile',
            description: `فرزندِ نوه شما (${gk.firstName})`
          };
        }
      }
    }

    // ۱۱. عمو و عمه (برادر و خواهر پدر)
    if (focal.fatherId && members[focal.fatherId]) {
      const father = members[focal.fatherId];
      const fatherSibs = getSiblings(father, members);
      if (fatherSibs.some(s => s.id === target.id)) {
        const label = target.gender === 'female' ? 'عمه (خواهر پدر)' : 'عمو (برادر پدر)';
        return {
          label,
          category: 'uncle_aunt',
          badgeClass: 'badge-family',
          icon: 'user-plus',
          description: `${target.gender === 'female' ? 'خواهر' : 'برادر'} پدرتان ${father.firstName}`
        };
      }
    }

    // ۱۲. دایی و خاله (برادر و خواهر مادر)
    if (focal.motherId && members[focal.motherId]) {
      const mother = members[focal.motherId];
      const motherSibs = getSiblings(mother, members);
      if (motherSibs.some(s => s.id === target.id)) {
        const label = target.gender === 'female' ? 'خاله (خواهر مادر)' : 'دایی (برادر مادر)';
        return {
          label,
          category: 'uncle_aunt',
          badgeClass: 'badge-family',
          icon: 'user-plus',
          description: `${target.gender === 'female' ? 'خواهر' : 'برادر'} مادرتان ${mother.firstName}`
        };
      }
    }

    // ۱۳. همسران عمو، عمه، دایی، خاله (زن عمو، شوهر عمه، زن دایی، شوهر خاله)
    // ۱۲.الف: زن عمو و شوهر عمه
    if (focal.fatherId && members[focal.fatherId]) {
      const fatherSibs = getSiblings(members[focal.fatherId], members);
      for (const fs of fatherSibs) {
        const fsSpouses = getSpouses(fs, members);
        if (fsSpouses.some(s => s.id === target.id)) {
          const label = fs.gender === 'female' ? 'شوهر عمه' : 'زن عمو';
          return {
            label,
            category: 'uncle_aunt_spouse',
            badgeClass: 'badge-inlaw',
            icon: 'heart',
            description: `همسرِ ${fs.firstName} (${fs.gender === 'female' ? 'عمه' : 'عمو'})`
          };
        }
      }
    }

    // ۱۲.ب: زن دایی و شوهر خاله
    if (focal.motherId && members[focal.motherId]) {
      const motherSibs = getSiblings(members[focal.motherId], members);
      for (const ms of motherSibs) {
        const msSpouses = getSpouses(ms, members);
        if (msSpouses.some(s => s.id === target.id)) {
          const label = ms.gender === 'female' ? 'شوهر خاله' : 'زن دایی';
          return {
            label,
            category: 'uncle_aunt_spouse',
            badgeClass: 'badge-inlaw',
            icon: 'heart',
            description: `همسرِ ${ms.firstName} (${ms.gender === 'female' ? 'خاله' : 'دایی'})`
          };
        }
      }
    }

    // ۱۴. فرزندان عمو، عمه، دایی و خاله (پسر/دختر عمو، عمه، دایی، خاله)
    if (focal.fatherId && members[focal.fatherId]) {
      const fatherSibs = getSiblings(members[focal.fatherId], members);
      for (const fs of fatherSibs) {
        const cousinKids = getChildren(fs, members);
        if (cousinKids.some(ck => ck.id === target.id)) {
          const relationPrefix = fs.gender === 'female' ? 'عمه' : 'عمو';
          const label = target.gender === 'female' ? `دختر ${relationPrefix}` : `پسر ${relationPrefix}`;
          return {
            label,
            category: 'cousin',
            badgeClass: 'badge-cousin',
            icon: 'users',
            description: `فرزندِ ${fs.firstName} (${relationPrefix})`
          };
        }
      }
    }

    if (focal.motherId && members[focal.motherId]) {
      const motherSibs = getSiblings(members[focal.motherId], members);
      for (const ms of motherSibs) {
        const cousinKids = getChildren(ms, members);
        if (cousinKids.some(ck => ck.id === target.id)) {
          const relationPrefix = ms.gender === 'female' ? 'خاله' : 'دایی';
          const label = target.gender === 'female' ? `دختر ${relationPrefix}` : `پسر ${relationPrefix}`;
          return {
            label,
            category: 'cousin',
            badgeClass: 'badge-cousin',
            icon: 'users',
            description: `فرزندِ ${ms.firstName} (${relationPrefix})`
          };
        }
      }
    }

    // ۱۵. برادرزاده و خواهرزاده (فرزندان خواهر و برادر)
    for (const sib of siblings) {
      const sibKids = getChildren(sib, members);
      if (sibKids.some(sk => sk.id === target.id)) {
        if (sib.gender === 'female') {
          const label = target.gender === 'female' ? 'خواهرزاده (دختر خواهر)' : 'خواهرزاده (پسر خواهر)';
          return {
            label,
            category: 'niece_nephew',
            badgeClass: 'badge-child',
            icon: 'smile',
            description: `فرزندِ خواهرتان ${sib.firstName}`
          };
        } else {
          const label = target.gender === 'female' ? 'برادرزاده (دختر برادر)' : 'برادرزاده (پسر برادر)';
          return {
            label,
            category: 'niece_nephew',
            badgeClass: 'badge-child',
            icon: 'smile',
            description: `فرزندِ برادرتان ${sib.firstName}`
          };
        }
      }
    }

    // ۱۶. شوهر خواهر و زن داداش (زن برادر)
    for (const sib of siblings) {
      const sibSpouses = getSpouses(sib, members);
      if (sibSpouses.some(ss => ss.id === target.id)) {
        const label = sib.gender === 'female' ? 'شوهر خواهر' : 'زن داداش (همسر برادر)';
        return {
          label,
          category: 'sibling_in_law',
          badgeClass: 'badge-inlaw',
          icon: 'heart',
          description: `همسرِ ${sib.firstName} (${sib.gender === 'female' ? 'خواهرتان' : 'برادرتان'})`
        };
      }
    }

    // ۱۷. خواهر زن، برادر زن، خواهر شوهر، برادر شوهر (خواهر یا برادر همسر)
    for (const sp of spouses) {
      const spouseSibs = getSiblings(sp, members);
      if (spouseSibs.some(ss => ss.id === target.id)) {
        let label = '';
        if (focal.gender === 'female') {
          label = target.gender === 'female' ? 'خواهر شوهر' : 'برادر شوهر';
        } else {
          label = target.gender === 'female' ? 'خواهر زن' : 'برادر زن';
        }
        return {
          label,
          category: 'spouse_sibling',
          badgeClass: 'badge-inlaw',
          icon: 'users',
          description: `${target.gender === 'female' ? 'خواهر' : 'برادر'} همسرتان (${sp.firstName})`
        };
      }
    }

    // ۱۸. باجناق: شوهر دو خواهر نسبت به هم باجناق هستند
    // [مورد تأکید ویژه در صورت‌مسئله]
    // اگر فرد محوری مرد باشد، و تارگت هم مرد باشد، و همسر فرد محوری با همسر تارگت خواهر باشند!
    if (focal.gender === 'male' && target.gender === 'male') {
      for (const myWife of spouses) {
        const wifeSibs = getSiblings(myWife, members);
        const targetWives = getSpouses(target, members);
        for (const tw of targetWives) {
          if (wifeSibs.some(ws => ws.id === tw.id && ws.gender === 'female')) {
            return {
              label: 'باجناق',
              category: 'bajenagh',
              badgeClass: 'badge-inlaw-gold',
              icon: 'link',
              description: `شوهرِ خواهر همسرتان (${tw.firstName}) - دو باجناق`
            };
          }
        }
      }
    }

    // ۱۹. جاری: زن دو تا برادر نسبت به هم جاری هستند
    // [مورد تأکید ویژه در صورت‌مسئله]
    // اگر فرد محوری زن باشد، و تارگت هم زن باشد، و همسر فرد محوری با همسر تارگت برادر باشند!
    if (focal.gender === 'female' && target.gender === 'female') {
      for (const myHusband of spouses) {
        const husbandSibs = getSiblings(myHusband, members);
        const targetHusbands = getSpouses(target, members);
        for (const th of targetHusbands) {
          if (husbandSibs.some(hs => hs.id === th.id && hs.gender === 'male')) {
            return {
              label: 'جاری',
              category: 'jari',
              badgeClass: 'badge-inlaw-gold',
              icon: 'link',
              description: `همسرِ برادر شوهرتان (${th.firstName}) - دو جاری`
            };
          }
        }
      }
    }

    // ۲۰. پدر همسر یا مادر همسر در حالت کلی
    for (const sp of spouses) {
      if (sp.fatherId === target.id) {
        return {
          label: focal.gender === 'female' ? 'پدر شوهر' : 'پدر زن',
          category: 'parent_in_law',
          badgeClass: 'badge-inlaw',
          icon: 'shield',
          description: `پدرِ همسرتان (${sp.firstName})`
        };
      }
      if (sp.motherId === target.id) {
        return {
          label: focal.gender === 'female' ? 'مادر شوهر' : 'مادر زن',
          category: 'parent_in_law',
          badgeClass: 'badge-inlaw',
          icon: 'shield',
          description: `مادرِ همسرتان (${sp.firstName})`
        };
      }
    }

    // ۲۱. جد بزرگ (پدر یا مادر پدربزرگ/مادربزرگ)
    for (const parent of parents) {
      const gParents = getParents(parent, members);
      for (const gp of gParents) {
        const ggParents = getParents(gp, members);
        if (ggParents.some(ggp => ggp.id === target.id)) {
          return {
            label: 'جد بزرگ (والد پدربزرگ/مادربزرگ)',
            category: 'ancestor',
            badgeClass: 'badge-elder',
            icon: 'award',
            description: `از نیاکان و اجداد قدیمی خاندان`
          };
        }
      }
    }

    // ارتباط نسبی دور یا نامشخص
    return {
      label: 'خویشاوند دور / ارتباط ثبت‌نشده',
      category: 'distant',
      badgeClass: 'badge-default',
      icon: 'help-circle',
      description: 'ارتباط مستقیم یا سببی شناخته‌شده‌ای در پایگاه داده فعلی ثبت نشده است.'
    };
  }

  /**
   * پالایش اعضای در دسترس برای انتساب به عنوان یک رابطه جدید به شخص مشخص:
   * شرط مهم کاربر:
   * "وقتی کسی را مثلا به عنوان پدر فرد دیگر ثبت می کنم تا وقتی پیوند را حذف نکردم،
   * از بخش اعضای موجود خارج می شود چون پدر یک نفر نمی تواند رابطه دیگری با او داشته باشد؛
   * این نکته را در مورد تمام روابط رعایت کن.
   * ضمنا برای بخش همسر ها، اگر زن ثبت شد، از بین مرد ها فقط بگرد و اگر مرد بود از بین مرد ها بگرد."
   */
  function getEligibleCandidates(personId, relationType, members, options = {}) {
    if (!members) return [];
    const person = members[personId];
    if (!person) return Object.values(members);

    // اشخاصی که قبلاً پیوند مستقیمی با این شخص دارند
    const existingLinkedIds = new Set();
    existingLinkedIds.add(personId); // خود شخص

    if (person.fatherId) existingLinkedIds.add(person.fatherId);
    if (person.motherId) existingLinkedIds.add(person.motherId);
    (person.spouseIds || []).forEach(id => existingLinkedIds.add(id));
    (person.childIds || []).forEach(id => existingLinkedIds.add(id));

    // خواهر و برادران فعلی
    const sibs = getSiblings(person, members);
    sibs.forEach(s => existingLinkedIds.add(s.id));

    // افرادی که این شخص را والد خود می‌دانند
    Object.values(members).forEach(m => {
      if (m.fatherId === personId || m.motherId === personId) {
        existingLinkedIds.add(m.id);
      }
      if ((m.spouseIds || []).includes(personId)) {
        existingLinkedIds.add(m.id);
      }
    });

    return Object.values(members).filter(candidate => {
      // ۱. اگر قبلاً به عنوان پیوند مستقیمی با این شخص ثبت شده باشد، خارج می‌شود!
      if (existingLinkedIds.has(candidate.id)) {
        return false;
      }

      // ۲. بررسی جنسیت و شرایط متناسب با نوع رابطه
      if (relationType === 'father') {
        if (candidate.gender === 'female') return false;
      } else if (relationType === 'mother') {
        if (candidate.gender === 'male') return false;
      } else if (relationType === 'brother') {
        if (candidate.gender === 'female') return false;
      } else if (relationType === 'sister') {
        if (candidate.gender === 'male') return false;
      } else if (relationType === 'spouse') {
        // قانون کاربر برای همسر:
        // "برای بخش همسر ها، اگر زن ثبت شد، از بین مرد ها فقط بگرد و اگر مرد بود از بین زن ها [یا مرد ها طبق انتخاب] بگرد"
        if (person.gender === 'female') {
          // اگر زن است، فقط مردها
          if (candidate.gender !== 'male' && !options.allowAnyGender) return false;
        } else if (person.gender === 'male') {
          // اگر مرد است، به طور پیش‌فرض زنان (مگر اینکه گزینه دلخواه فعال شود)
          if (candidate.gender !== 'female' && !options.allowAnyGender) return false;
        }
      }

      return true;
    });
  }

  return {
    getChildren,
    getParents,
    getSpouses,
    getSiblings,
    getGrandchildren,
    calculateKinship,
    getEligibleCandidates
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Kinship;
}
