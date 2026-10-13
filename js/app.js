/**
 * app.js - کنترل‌کننده اصلی اپلیکیشن وب شجره‌نامه
 * مدیریت رابط کاربری، مودال‌ها، نمای درختی، تب‌ها، فیلترها و عملیات تعاملی
 * ۱۰۰٪ آفلاین و بدون وابستگی به فیلترشکن
 */

const App = (() => {
  // متغیرهای وضعیت جاری
  let activeTab = 'tree'; // 'tree' | 'members' | 'ai'
  let currentClan = null;
  let viewingMemberId = null;
  let editingMemberId = null;
  let pendingRelativeLink = null; // برای زمانی که از درون بخش فامیل‌ها دکمه "+ عضو جدید" زده می‌شود

  // فهرست علایق پیش‌فرض پیشنهادی
  const PRESET_INTERESTS = [
    'شعر و ادبیات', 'خوشنویسی', 'موسیقی سنتی', 'موسیقی مدرن',
    'تاریخ و کهن‌شناسی', 'نقاشی و هنر', 'فلسفه و عرفان', 'ورزش و تناسب اندام',
    'کوهنوردی و طبیعت', 'باغبانی و گلکاری', 'عکاسی', 'سفر و گردشگری',
    'مطالعه کتاب', 'علم و فناوری', 'آشپزی سنتی', 'صنایع دستی', 'نجوم و کیهان‌شناسی'
  ];

  // متغیر موقت برای فرم ویرایش عضو
  let currentEditFormState = {
    interests: [],
    galleryPhotos: [],
    photo: null,
    video: null,
    audio: null,
    preferredCalendar: 'jalali'
  };

  function init() {
    // مقداردهی درخت SVG
    const treeContainer = document.getElementById('treeContainer');
    if (treeContainer) {
      TreeViewer.init(treeContainer);
    }

    // بارگذاری داده‌ها از Storage
    currentClan = Storage.getActiveClan();

    // ثبت رویدادهای عمومی
    setupEventListeners();

    // بارگذاری نمای اولیه
    renderClanSelector();
    refreshView();

    // اگر اولین بار است و دیتابیس خالی است، پیام راهنما
    if (!currentClan || Object.keys(currentClan.members || {}).length === 0) {
      showEmptyStateAlert();
    }
  }

  function setupEventListeners() {
    // تب‌های ناوبری اصلی
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });

    // دکمه‌های کنترل زوم درخت
    document.getElementById('btnZoomIn')?.addEventListener('click', () => TreeViewer.zoom(1.2));
    document.getElementById('btnZoomOut')?.addEventListener('click', () => TreeViewer.zoom(0.8));
    document.getElementById('btnResetZoom')?.addEventListener('click', () => TreeViewer.resetView());
    document.getElementById('btnFitTree')?.addEventListener('click', () => TreeViewer.fitTreeToView());

    // انتخاب خاندان
    document.getElementById('clanSelect')?.addEventListener('change', (e) => {
      const clanId = e.target.value;
      if (clanId === '__new__') {
        openNewClanModal();
      } else {
        Storage.setActiveClan(clanId);
        currentClan = Storage.getActiveClan();
        refreshView();
        showToast(`خاندان «${currentClan.name}» فعال شد.`);
      }
    });

    // دکمه ایجاد خاندان جدید
    document.getElementById('btnCreateClan')?.addEventListener('click', openNewClanModal);

    // دکمه حذف کل خاندان
    document.getElementById('btnDeleteClan')?.addEventListener('click', confirmDeleteClan);

    // دکمه افزودن عضو جدید
    document.getElementById('btnAddMember')?.addEventListener('click', () => openMemberModal(null));

    // دکمه بارگذاری نمونه آزمایشی
    document.getElementById('btnLoadDemo')?.addEventListener('click', () => {
      const demo = Storage.loadDemoData();
      currentClan = demo;
      renderClanSelector();
      refreshView();
      showToast('خاندان نمونه بزرگ علوی با روابط کامل بارگذاری شد.', 'success');
    });

    // جستجوی اعضا
    document.getElementById('memberSearchInput')?.addEventListener('input', (e) => {
      renderMembersList(e.target.value);
    });

    // فیلتر اعضا بر اساس جنسیت یا وضعیت
    document.getElementById('filterGenderSelect')?.addEventListener('change', () => {
      const query = document.getElementById('memberSearchInput')?.value || '';
      renderMembersList(query);
    });

    // دکمه‌های تقویم شمسی/میلادی/قمری در فرم عضو
    setupCalendarTabButtons();

    // تاگل شخص تاریخی
    const historicalCheckbox = document.getElementById('isHistoricalCheck');
    if (historicalCheckbox) {
      historicalCheckbox.addEventListener('change', (e) => {
        toggleHistoricalMode(e.target.checked);
      });
    }

    // تاگل وضعیت حیات / فوت
    const deceasedCheckbox = document.getElementById('isDeceasedCheck');
    if (deceasedCheckbox) {
      deceasedCheckbox.addEventListener('change', (e) => {
        const deathSection = document.getElementById('deathDateSection');
        if (deathSection) {
          deathSection.style.display = e.target.checked ? 'block' : 'none';
        }
      });
    }

    // آپلود عکس پروفایل
    document.getElementById('photoInput')?.addEventListener('change', handlePhotoUpload);

    // افزودن برچسب علاقه سفارشی
    document.getElementById('btnAddCustomInterest')?.addEventListener('click', addCustomInterest);
    document.getElementById('customInterestInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addCustomInterest();
      }
    });

    // آپلود ویدیو
    document.getElementById('videoFileInput')?.addEventListener('change', handleVideoUpload);

    // آپلود صوت
    document.getElementById('audioFileInput')?.addEventListener('change', handleAudioUpload);

    // آپلود عکس‌های گالری
    document.getElementById('galleryInput')?.addEventListener('change', handleGalleryUpload);

    // ذخیره فرم عضو
    document.getElementById('memberForm')?.addEventListener('submit', handleSaveMember);

    // اجرای دستور هوش مصنوعی
    document.getElementById('btnRunAiInstruction')?.addEventListener('click', handleAiInstructionSubmit);
    document.getElementById('aiInstructionInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAiInstructionSubmit();
      }
    });

    // دکمه‌های سریع دستورات هوش مصنوعی
    document.querySelectorAll('.ai-prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = chip.getAttribute('data-prompt');
        const input = document.getElementById('aiInstructionInput');
        if (input) {
          input.value = prompt;
          handleAiInstructionSubmit();
        }
      });
    });

    // دکمه اصلاح خودکار همه موارد
    document.getElementById('btnAiAutoFixAll')?.addEventListener('click', () => {
      if (!currentClan) return;
      const res = AIDebugger.autoFixAll(currentClan);
      refreshView();
      runAiAnalysis();
      showToast(`${res.fixedCount} اشکال با هوش مصنوعی اصلاح شد.`, 'success');
    });

    // بستن مودال‌ها با کلیک روی پس‌زمینه یا دکمه بستن
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop') || e.target.classList.contains('modal-close')) {
          closeAllModals();
        }
      });
    });
  }

  // سوئیچ بین تب‌های نمای درختی، فهرست اعضا و هوش مصنوعی
  function switchTab(tabName) {
    activeTab = tabName;

    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });

    document.querySelectorAll('.tab-view').forEach(view => {
      view.classList.remove('active');
    });

    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) activeView.classList.add('active');

    if (tabName === 'tree') {
      setTimeout(() => {
        TreeViewer.render(currentClan);
      }, 50);
    } else if (tabName === 'members') {
      renderMembersList();
    } else if (tabName === 'ai') {
      runAiAnalysis();
    }
  }

  // بروزرسانی کامل تمام بخش‌های رابط کاربری
  function refreshView() {
    currentClan = Storage.getActiveClan();

    updateHeaderStats();
    updateFocalBanner();

    if (activeTab === 'tree') {
      TreeViewer.render(currentClan);
    } else if (activeTab === 'members') {
      renderMembersList();
    } else if (activeTab === 'ai') {
      runAiAnalysis();
    }
  }

  // بروزرسانی آمار بالای صفحه
  function updateHeaderStats() {
    const clanNameEl = document.getElementById('headerClanName');
    const memberCountEl = document.getElementById('headerMemberCount');
    const deleteBtn = document.getElementById('btnDeleteClan');

    if (currentClan) {
      if (clanNameEl) clanNameEl.textContent = `${currentClan.emblem || '🌿'} ${currentClan.name}`;
      const count = Object.keys(currentClan.members || {}).length;
      if (memberCountEl) memberCountEl.textContent = `${count} عضو`;
      if (deleteBtn) deleteBtn.style.display = 'inline-flex';
    } else {
      if (clanNameEl) clanNameEl.textContent = 'هیچ خاندانی انتخاب نشده';
      if (memberCountEl) memberCountEl.textContent = '۰ عضو';
      if (deleteBtn) deleteBtn.style.display = 'none';
    }
  }

  // نمایش بنر فرد محوری فعال
  function updateFocalBanner() {
    const banner = document.getElementById('focalBanner');
    const focal = Storage.getFocalPerson();

    if (focal && banner) {
      banner.style.display = 'flex';
      const nameEl = document.getElementById('focalPersonName');
      if (nameEl) nameEl.textContent = `${focal.firstName} ${focal.lastName}`;
    } else if (banner) {
      banner.style.display = 'none';
    }
  }

  // رندر سلکتور خاندان‌ها
  function renderClanSelector() {
    const select = document.getElementById('clanSelect');
    if (!select) return;

    select.innerHTML = '';
    const clans = Storage.getClans();

    if (clans.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'هیچ خاندانی موجود نیست';
      select.appendChild(opt);
    } else {
      clans.forEach(clan => {
        const opt = document.createElement('option');
        opt.value = clan.id;
        opt.textContent = `${clan.emblem || '🌿'} ${clan.name}`;
        if (currentClan && clan.id === currentClan.id) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    }

    // گزینه ایجاد خاندان جدید
    const newOpt = document.createElement('option');
    newOpt.value = '__new__';
    newOpt.textContent = '➕ ایجاد خاندان جدید...';
    select.appendChild(newOpt);
  }

  // کلیک روی کارت یک عضو در درخت
  // "با انتخاب یک فرد محور با لمس آن، آن فرد ، فرد محوری شده است."
  function onNodeClicked(personId, event) {
    if (!currentClan || !currentClan.members[personId]) return;

    // لمس یا کلیک، آن شخص را فرد محوری می‌کند
    Storage.setFocalPerson(personId);
    updateFocalBanner();

    // باز کردن کشوی پروفایل و نسبت‌های شخص
    openProfileModal(personId);

    // بازخوانی درخت با نسبت‌های جدید
    TreeViewer.render(currentClan);
    showToast(`فرد محوری به «${currentClan.members[personId].firstName}» تغییر یافت.`, 'info');
  }

  // رندر لیست اعضا در تب اعضا
  function renderMembersList(searchQuery = '') {
    const container = document.getElementById('membersListContainer');
    if (!container) return;

    container.innerHTML = '';

    if (!currentClan || !currentClan.members || Object.keys(currentClan.members).length === 0) {
      container.innerHTML = `
        <div class="empty-state-box">
          <p>🌱 هیچ عضوی در این خاندان ثبت نشده است.</p>
          <button class="btn btn-primary" onclick="App.openMemberModal(null)">➕ افزودن اولین عضو</button>
        </div>
      `;
      return;
    }

    const members = Object.values(currentClan.members);
    const focal = Storage.getFocalPerson();
    const genderFilter = document.getElementById('filterGenderSelect')?.value || 'all';

    const query = searchQuery.trim().toLowerCase();

    const filtered = members.filter(m => {
      // جستجو در نام
      const fullName = `${m.firstName} ${m.lastName}`.toLowerCase();
      if (query && !fullName.includes(query)) return false;

      // فیلتر جنسیت
      if (genderFilter !== 'all') {
        if (genderFilter === 'male' && m.gender !== 'male') return false;
        if (genderFilter === 'female' && m.gender !== 'female') return false;
        if (genderFilter === 'deceased' && !m.isDeceased) return false;
        if (genderFilter === 'historical' && !m.isHistorical) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `<p class="text-center text-muted p-4">هیچ عضوی با این مشخصات یافت نشد.</p>`;
      return;
    }

    filtered.forEach(person => {
      const isFocal = focal && focal.id === person.id;
      const kinship = focal ? Kinship.calculateKinship(focal.id, person.id, currentClan.members) : null;

      const card = document.createElement('div');
      card.className = `member-card ${isFocal ? 'is-focal-card' : ''} gender-${person.gender}`;

      card.innerHTML = `
        <div class="member-card-header">
          <div class="member-avatar ${person.photo ? 'has-img' : ''}">
            ${person.photo ? `<img src="${person.photo}" alt="${person.firstName}">` : `<span class="emoji-avatar">${person.gender === 'female' ? '👩' : (person.gender === 'male' ? '👨' : '👤')}</span>`}
          </div>
          <div class="member-info">
            <h3 class="member-name">${person.firstName} ${person.lastName}</h3>
            <div class="member-meta">
              ${person.isHistorical ? '🏛️ شخصیت تاریخی' : (person.isDeceased ? `🖤 فوت شده (${person.age || '?'} سال)` : `🌿 در قید حیات (${person.age || '?'} سال)`)}
            </div>
          </div>
        </div>

        ${kinship ? `
          <div class="member-kinship-row">
            <span class="kinship-badge ${kinship.badgeClass || ''}">
              ${isFocal ? '👑 فرد محوری' : `نسبت با فرد محور: <strong>${kinship.label}</strong>`}
            </span>
          </div>
        ` : ''}

        <div class="member-card-actions">
          <button class="btn btn-sm btn-outline-primary" onclick="App.openProfileModal('${person.id}')">👁️ مشاهده</button>
          <button class="btn btn-sm btn-outline-secondary" onclick="App.openRelativesModal('${person.id}')">🔗 فامیل‌ها</button>
          <button class="btn btn-sm btn-outline-dark" onclick="App.openMemberModal('${person.id}')">✏️ ویرایش</button>
          <button class="btn btn-sm ${isFocal ? 'btn-warning' : 'btn-outline-warning'}" onclick="App.setAsFocal('${person.id}')">
            ${isFocal ? '⭐ شاخص' : 'انتخاب محور'}
          </button>
        </div>
      `;

      container.appendChild(card);
    });
  }

  // تنظیم به عنوان فرد محوری
  function setAsFocal(personId) {
    if (!currentClan) return;
    Storage.setFocalPerson(personId);
    updateFocalBanner();
    refreshView();
    showToast(`«${currentClan.members[personId].firstName}» به عنوان فرد محوری تنظیم شد.`);
  }

  // باز کردن مودال مشاهده پروفایل کامل عضو
  function openProfileModal(personId) {
    viewingMemberId = personId;
    const member = currentClan?.members[personId];
    if (!member) return;

    const modal = document.getElementById('profileModal');
    if (!modal) return;

    const focal = Storage.getFocalPerson();
    const isFocal = focal && focal.id === member.id;
    const kinship = focal ? Kinship.calculateKinship(focal.id, member.id, currentClan.members) : null;

    // پر کردن اطلاعات هدر پروفایل
    document.getElementById('profileFullName').textContent = `${member.firstName} ${member.lastName}`;
    document.getElementById('profileAvatarImg').src = member.photo || '';
    document.getElementById('profileAvatarImg').style.display = member.photo ? 'block' : 'none';
    document.getElementById('profileAvatarEmoji').style.display = member.photo ? 'none' : 'block';
    document.getElementById('profileAvatarEmoji').textContent = member.gender === 'female' ? '👩' : (member.gender === 'male' ? '👨' : '👤');

    // تاریخ و سن
    const birthStr = Calendar.formatDateString(member.birthDate);
    const deathStr = member.isDeceased ? Calendar.formatDateString(member.deathDate) : 'در قید حیات';
    document.getElementById('profileBirthDate').textContent = birthStr;
    document.getElementById('profileDeathDate').textContent = deathStr;
    document.getElementById('profileAge').textContent = member.age ? `${member.age} سال` : 'محاسبه نشده';

    // نسبت با فرد محوری
    const kinshipBadge = document.getElementById('profileKinshipBadge');
    if (kinship && kinshipBadge) {
      kinshipBadge.style.display = 'block';
      kinshipBadge.className = `kinship-highlight-badge ${kinship.badgeClass || ''}`;
      kinshipBadge.innerHTML = isFocal
        ? '👑 <strong>این شخص، فرد محوری انتخاب شده شجره‌نامه است.</strong>'
        : `نسبت با فرد محوری (${focal.firstName} ${focal.lastName}): <strong>${kinship.label}</strong> <span class="kinship-desc-small">(${kinship.description})</span>`;
    } else if (kinshipBadge) {
      kinshipBadge.style.display = 'none';
    }

    // پر کردن خویشاوندان مستقیم (والدین، همسران، فرزندان، نوه‌ها)
    renderProfileRelativesSummary(member);

    // پر کردن بخش رسانه‌ها و توضیحات اضافه (علایق، فیلم، صوت، عکس‌ها)
    renderProfileMedia(member);

    // تنظیم دکمه‌های اکشن
    const btnSetFocal = document.getElementById('profileBtnSetFocal');
    if (btnSetFocal) {
      btnSetFocal.style.display = isFocal ? 'none' : 'inline-flex';
      btnSetFocal.onclick = () => {
        setAsFocal(member.id);
        openProfileModal(member.id);
      };
    }

    document.getElementById('profileBtnEdit').onclick = () => {
      closeAllModals();
      openMemberModal(member.id);
    };

    document.getElementById('profileBtnManageRelatives').onclick = () => {
      closeAllModals();
      openRelativesModal(member.id);
    };

    document.getElementById('profileBtnDelete').onclick = () => {
      if (confirm(`آیا از حذف «${member.firstName} ${member.lastName}» از شجره‌نامه اطمینان دارید؟`)) {
        Storage.deleteMember(member.id);
        closeAllModals();
        refreshView();
        showToast('عضو با موفقیت حذف گردید.', 'info');
      }
    };

    modal.classList.add('show');
  }

  // خلاصه فامیل‌ها در مودال پروفایل
  function renderProfileRelativesSummary(member) {
    const container = document.getElementById('profileRelativesSummary');
    if (!container) return;

    const members = currentClan.members;
    const parents = Kinship.getParents(member, members);
    const spouses = Kinship.getSpouses(member, members);
    const children = Kinship.getChildren(member, members);
    const siblings = Kinship.getSiblings(member, members);
    const grandKids = Kinship.getGrandchildren(member, members);

    let html = '';

    // والدین
    if (parents.length > 0) {
      html += `<div class="rel-row"><span class="rel-title">والدین:</span> ${parents.map(p => `<span class="rel-link" onclick="App.openProfileModal('${p.id}')">${p.firstName} ${p.lastName}</span>`).join('، ')}</div>`;
    }

    // همسران
    if (spouses.length > 0) {
      html += `<div class="rel-row"><span class="rel-title">همسر(ها):</span> ${spouses.map(s => `<span class="rel-link" onclick="App.openProfileModal('${s.id}')">${s.firstName} ${s.lastName}</span>`).join('، ')}</div>`;
    }

    // خواهران و برادران
    if (siblings.length > 0) {
      html += `<div class="rel-row"><span class="rel-title">خواهران و برادران:</span> ${siblings.map(s => `<span class="rel-link" onclick="App.openProfileModal('${s.id}')">${s.firstName} ${s.lastName}</span>`).join('، ')}</div>`;
    }

    // فرزندان
    if (children.length > 0) {
      html += `<div class="rel-row"><span class="rel-title">فرزندان:</span> ${children.map(c => `<span class="rel-link" onclick="App.openProfileModal('${c.id}')">${c.firstName} ${c.lastName}</span>`).join('، ')}</div>`;
    }

    // نوه‌ها [مورد تأکید کاربر: در تمام بخش های لازم، نوه ها اضافه شوند]
    if (grandKids.length > 0) {
      html += `<div class="rel-row"><span class="rel-title">نوه‌ها:</span> ${grandKids.map(gk => `<span class="rel-link" onclick="App.openProfileModal('${gk.grandchild.id}')">${gk.grandchild.firstName} ${gk.grandchild.lastName} <small class="text-muted">(${gk.viaChild.gender === 'male' ? 'پسری' : 'دختری'})</small></span>`).join('، ')}</div>`;
    }

    if (!html) {
      html = '<p class="text-muted">پیوند خویشاوندی مستقیمی ثبت نشده است.</p>';
    }

    container.innerHTML = html;
  }

  // پر کردن رسانه‌ها و توضیحات اضافه در پروفایل
  function renderProfileMedia(member) {
    const extra = member.extraDetails || {};

    // علایق
    const interestsContainer = document.getElementById('profileInterestsDisplay');
    if (interestsContainer) {
      if (extra.interests && extra.interests.length > 0) {
        interestsContainer.innerHTML = extra.interests.map(i => `<span class="interest-chip-static">${i}</span>`).join('');
      } else {
        interestsContainer.innerHTML = '<span class="text-muted">علاقه‌مندی ثبت نشده است.</span>';
      }
    }

    // ویدیو
    const videoSection = document.getElementById('profileVideoDisplay');
    const videoPlayer = document.getElementById('profileVideoPlayer');
    if (videoSection && videoPlayer) {
      if (extra.video) {
        videoPlayer.src = extra.video;
        videoSection.style.display = 'block';
      } else {
        videoSection.style.display = 'none';
        videoPlayer.src = '';
      }
    }

    // صوت
    const audioSection = document.getElementById('profileAudioDisplay');
    const audioPlayer = document.getElementById('profileAudioPlayer');
    if (audioSection && audioPlayer) {
      if (extra.audio) {
        audioPlayer.src = extra.audio;
        audioSection.style.display = 'block';
      } else {
        audioSection.style.display = 'none';
        audioPlayer.src = '';
      }
    }

    // گالری عکس‌ها
    const galleryContainer = document.getElementById('profileGalleryDisplay');
    if (galleryContainer) {
      if (extra.galleryPhotos && extra.galleryPhotos.length > 0) {
        galleryContainer.innerHTML = extra.galleryPhotos.map((imgUrl, i) => `
          <div class="gallery-thumb-item" onclick="App.previewImage('${imgUrl}')">
            <img src="${imgUrl}" alt="عکس گالری ${i + 1}">
          </div>
        `).join('');
        galleryContainer.style.display = 'flex';
      } else {
        galleryContainer.innerHTML = '';
        galleryContainer.style.display = 'none';
      }
    }

    // زندگی‌نامه و یادداشت
    const bioText = document.getElementById('profileBioDisplay');
    if (bioText) {
      bioText.textContent = extra.biography || 'یادداشت یا زندگی‌نامه‌ای ثبت نشده است.';
    }
  }

  /**
   * باز کردن مودال «افزودن فامیل‌ها» برای یک شخص مشخص
   * "غیر از آن ، برای هر شخص یک بخش افزودن فامیل ها داریم در قسمت افزودن فامیل ها،
   * پدر ، مادر، خواهر ها، برادر ها ، فرزندان، همسر ها باشد و اگر به اصطلاح کسی تعریف نشده باشد
   * از همان قسمت گزینه ای ایجاد شود که بتوان به قسمت افزودن عضو جدید رفت."
   * به همراه رعایت کامل قانون خروج اشخاص پیوند خورده از لیست اعضای موجود!
   */
  function openRelativesModal(personId) {
    if (!currentClan || !currentClan.members[personId]) return;
    const person = currentClan.members[personId];

    const modal = document.getElementById('relativesModal');
    if (!modal) return;

    document.getElementById('relativesModalPersonName').textContent = `${person.firstName} ${person.lastName}`;

    const categories = [
      { key: 'father', title: 'پدر', icon: '👨', single: true },
      { key: 'mother', title: 'مادر', icon: '👩', single: true },
      { key: 'brother', title: 'برادرها', icon: '👦', single: false },
      { key: 'sister', title: 'خواهرها', icon: '👧', single: false },
      { key: 'child', title: 'فرزندان (پسران و دختران)', icon: '👶', single: false },
      { key: 'spouse', title: 'همسر(ها)', icon: '💍', single: false }
    ];

    const container = document.getElementById('relativesSectionsContainer');
    container.innerHTML = '';

    categories.forEach(cat => {
      const section = document.createElement('div');
      section.className = 'relative-cat-card';

      // اعضای فعلی این رابطه
      let currentRelIds = [];
      if (cat.key === 'father' && person.fatherId) currentRelIds = [person.fatherId];
      else if (cat.key === 'mother' && person.motherId) currentRelIds = [person.motherId];
      else if (cat.key === 'spouse') currentRelIds = person.spouseIds || [];
      else if (cat.key === 'child') currentRelIds = person.childIds || [];
      else if (cat.key === 'brother') {
        currentRelIds = Kinship.getSiblings(person, currentClan.members).filter(s => s.gender === 'male').map(s => s.id);
      } else if (cat.key === 'sister') {
        currentRelIds = Kinship.getSiblings(person, currentClan.members).filter(s => s.gender === 'female').map(s => s.id);
      }

      // اعضای واجد شرایط انتخاب (محرومیت اعضایی که پیوند دارند طبق شرط کاربر)
      const eligible = Kinship.getEligibleCandidates(person.id, cat.key, currentClan.members);

      section.innerHTML = `
        <div class="cat-header">
          <span class="cat-icon">${cat.icon}</span>
          <span class="cat-title">${cat.title}</span>
          <button class="btn btn-xs btn-outline-success btn-quick-add" onclick="App.quickAddRelative('${person.id}', '${cat.key}')">
            ➕ تعریف عضو جدید
          </button>
        </div>

        <div class="cat-current-list">
          ${currentRelIds.length === 0 ? '<span class="text-muted small">ثبت نشده</span>' : ''}
          ${currentRelIds.map(rid => {
            const relMember = currentClan.members[rid];
            if (!relMember) return '';
            return `
              <div class="rel-pill">
                <span>${relMember.firstName} ${relMember.lastName}</span>
                <button class="btn-remove-rel" title="حذف پیوند" onclick="App.unlinkRelation('${person.id}', '${cat.key}', '${rid}')">×</button>
              </div>
            `;
          }).join('')}
        </div>

        ${(!cat.single || currentRelIds.length === 0) ? `
          <div class="cat-add-row">
            <select class="form-select form-select-sm" id="select_rel_${cat.key}">
              <option value="">انتخاب از اعضای موجود...</option>
              ${eligible.map(c => `<option value="${c.id}">${c.firstName} ${c.lastName}</option>`).join('')}
            </select>
            <button class="btn btn-sm btn-primary" onclick="App.linkExistingRelative('${person.id}', '${cat.key}')">پیوند دادن</button>
          </div>
        ` : ''}
      `;

      container.appendChild(section);
    });

    modal.classList.add('show');
  }

  // پیوند دادن یک عضو موجود به شخص
  function linkExistingRelative(personId, relationKey) {
    const select = document.getElementById(`select_rel_${relationKey}`);
    if (!select || !select.value) {
      showToast('لطفاً ابتدا شخصی را از لیست انتخاب کنید.', 'warning');
      return;
    }
    const relativeId = select.value;
    Storage.linkRelation(personId, relationKey, relativeId);
    refreshView();
    openRelativesModal(personId); // بروزرسانی پنجره
    showToast('پیوند خانوادگی با موفقیت ثبت شد.', 'success');
  }

  // حذف پیوند فامیلی
  function unlinkRelation(personId, relationKey, relativeId) {
    Storage.unlinkRelation(personId, relationKey, relativeId);
    refreshView();
    openRelativesModal(personId);
    showToast('پیوند حذف گردید و شخص به لیست اعضای در دسترس بازگشت.', 'info');
  }

  // هدایت مستقیم از بخش فامیل‌ها به افزودن عضو جدید با اتصال خودکار
  function quickAddRelative(personId, relationKey) {
    pendingRelativeLink = { personId, relationKey };
    closeAllModals();

    const person = currentClan.members[personId];
    openMemberModal(null, {
      prefilledLastName: person.lastName,
      suggestedGender: (relationKey === 'father' || relationKey === 'brother') ? 'male' : ((relationKey === 'mother' || relationKey === 'sister') ? 'female' : 'male'),
      relationNote: `این عضو جدید به عنوان «${getRelationTitle(relationKey)}» برای «${person.firstName} ${person.lastName}» ثبت خواهد شد.`
    });
  }

  function getRelationTitle(key) {
    const titles = {
      father: 'پدر',
      mother: 'مادر',
      brother: 'برادر',
      sister: 'خواهر',
      child: 'فرزند',
      spouse: 'همسر'
    };
    return titles[key] || 'خویشاوند';
  }

  /**
   * باز کردن مودال فرم عضو جدید یا ویرایش عضو
   */
  function openMemberModal(memberId = null, options = {}) {
    editingMemberId = memberId;
    const modal = document.getElementById('memberModal');
    if (!modal) return;

    const modalTitle = document.getElementById('memberModalTitle');
    const form = document.getElementById('memberForm');
    form.reset();

    const relationNotice = document.getElementById('memberRelationNotice');
    if (options.relationNote && relationNotice) {
      relationNotice.textContent = options.relationNote;
      relationNotice.style.display = 'block';
    } else if (relationNotice) {
      relationNotice.style.display = 'none';
    }

    if (memberId && currentClan?.members[memberId]) {
      // ویرایش عضو موجود
      const m = currentClan.members[memberId];
      if (modalTitle) modalTitle.textContent = `ویرایش اطلاعات: ${m.firstName} ${m.lastName}`;

      document.getElementById('memberFirstName').value = m.firstName || '';
      document.getElementById('memberLastName').value = m.lastName || '';
      document.getElementById('memberGender').value = m.gender || 'male';

      document.getElementById('isHistoricalCheck').checked = Boolean(m.isHistorical);
      toggleHistoricalMode(Boolean(m.isHistorical));

      document.getElementById('isDeceasedCheck').checked = Boolean(m.isDeceased);
      const deathSection = document.getElementById('deathDateSection');
      if (deathSection) deathSection.style.display = m.isDeceased ? 'block' : 'none';

      // بارگذاری تاریخ تولد
      populateDateInputs('birth', m.birthDate);
      if (m.isDeceased) {
        populateDateInputs('death', m.deathDate);
      }

      // وضعیت فرم
      currentEditFormState = {
        interests: [...(m.extraDetails?.interests || [])],
        galleryPhotos: [...(m.extraDetails?.galleryPhotos || [])],
        photo: m.photo || null,
        video: m.extraDetails?.video || null,
        audio: m.extraDetails?.audio || null,
        preferredCalendar: m.birthDate?.preferredCalendar || 'jalali'
      };

      document.getElementById('memberBiography').value = m.extraDetails?.biography || '';
    } else {
      // افزودن عضو جدید
      if (modalTitle) modalTitle.textContent = 'افزودن عضو جدید به شجره‌نامه';
      if (options.prefilledLastName) {
        document.getElementById('memberLastName').value = options.prefilledLastName;
      }
      if (options.suggestedGender) {
        document.getElementById('memberGender').value = options.suggestedGender;
      }

      document.getElementById('isHistoricalCheck').checked = false;
      toggleHistoricalMode(false);
      document.getElementById('isDeceasedCheck').checked = false;
      document.getElementById('deathDateSection').style.display = 'none';

      currentEditFormState = {
        interests: [],
        galleryPhotos: [],
        photo: null,
        video: null,
        audio: null,
        preferredCalendar: 'jalali'
      };

      document.getElementById('memberBiography').value = '';
    }

    // بروزرسانی پیش‌نمایش تصویر و چیپ‌های علایق
    updatePhotoPreview(currentEditFormState.photo);
    renderInterestChips();
    renderGalleryThumbnails();

    modal.classList.add('show');
  }

  // پر کردن ورودی‌های تاریخ
  function populateDateInputs(prefix, dateObj) {
    if (!dateObj) return;

    if (dateObj.isHistorical) {
      document.getElementById(`${prefix}Era`).value = dateObj.era || 'BC';
      document.getElementById(`${prefix}Year`).value = Math.abs(dateObj.year) || '';
      document.getElementById(`${prefix}Month`).value = dateObj.month || 1;
      document.getElementById(`${prefix}Day`).value = dateObj.day || 1;
    } else {
      document.getElementById(`${prefix}Year`).value = dateObj.year || '';
      document.getElementById(`${prefix}Month`).value = dateObj.month || 1;
      document.getElementById(`${prefix}Day`).value = dateObj.day || 1;
      setCalendarTab(dateObj.preferredCalendar || 'jalali', prefix);
    }
  }

  // تاگل بخش افراد تاریخی و ق.م / ب.م
  // "در ضمن قبل و بعد میلاد فقط برای وقتی است که من گزینه افراد تاریخی را که ایجاد می کنی فشار دهم"
  function toggleHistoricalMode(isHistorical) {
    const birthEraGroup = document.getElementById('birthEraGroup');
    const deathEraGroup = document.getElementById('deathEraGroup');
    const calendarTabs = document.querySelectorAll('.calendar-type-tabs');

    if (birthEraGroup) birthEraGroup.style.display = isHistorical ? 'block' : 'none';
    if (deathEraGroup) deathEraGroup.style.display = isHistorical ? 'block' : 'none';

    calendarTabs.forEach(el => {
      el.style.display = isHistorical ? 'none' : 'flex';
    });
  }

  // تنظیم دکمه‌های تقویم شمسی/میلادی/قمری
  // "دکمه تاریخ میلادی و شمسی و قمری را جداگانه و دستی اضافه کن"
  function setupCalendarTabButtons() {
    ['birth', 'death'].forEach(prefix => {
      document.querySelectorAll(`.btn-cal-${prefix}`).forEach(btn => {
        btn.addEventListener('click', () => {
          const system = btn.getAttribute('data-cal');
          setCalendarTab(system, prefix);
        });
      });
    });
  }

  function setCalendarTab(system, prefix) {
    document.querySelectorAll(`.btn-cal-${prefix}`).forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-cal') === system);
    });

    const label = document.getElementById(`${prefix}YearLabel`);
    if (label) {
      if (system === 'jalali') label.textContent = 'سال خورشیدی (شمسی):';
      else if (system === 'gregorian') label.textContent = 'سال میلادی (Gregorian):';
      else if (system === 'hijri') label.textContent = 'سال هجری قمری:';
    }

    currentEditFormState.preferredCalendar = system;
  }

  // ذخیره فرم عضو
  function handleSaveMember(e) {
    e.preventDefault();
    if (!currentClan) {
      showToast('لطفاً ابتدا یک خاندان ایجاد یا انتخاب کنید.', 'warning');
      return;
    }

    const firstName = document.getElementById('memberFirstName').value.trim();
    const lastName = document.getElementById('memberLastName').value.trim();
    const gender = document.getElementById('memberGender').value;
    const isHistorical = document.getElementById('isHistoricalCheck').checked;
    const isDeceased = document.getElementById('isDeceasedCheck').checked;

    if (!firstName) {
      showToast('وارد کردن نام الزامی است.', 'warning');
      return;
    }

    // استخراج تاریخ تولد
    const birthYear = parseInt(document.getElementById('birthYear').value, 10);
    const birthMonth = parseInt(document.getElementById('birthMonth').value, 10) || 1;
    const birthDay = parseInt(document.getElementById('birthDay').value, 10) || 1;

    let birthDate = null;
    if (!isNaN(birthYear)) {
      if (isHistorical) {
        birthDate = {
          isHistorical: true,
          era: document.getElementById('birthEra').value || 'BC',
          year: birthYear,
          month: birthMonth,
          day: birthDay
        };
      } else {
        birthDate = {
          preferredCalendar: currentEditFormState.preferredCalendar,
          year: birthYear,
          month: birthMonth,
          day: birthDay
        };
      }
    }

    // استخراج تاریخ وفات
    let deathDate = null;
    if (isDeceased) {
      const deathYear = parseInt(document.getElementById('deathYear').value, 10);
      const deathMonth = parseInt(document.getElementById('deathMonth').value, 10) || 1;
      const deathDay = parseInt(document.getElementById('deathDay').value, 10) || 1;

      if (!isNaN(deathYear)) {
        if (isHistorical) {
          deathDate = {
            isHistorical: true,
            era: document.getElementById('deathEra').value || 'BC',
            year: deathYear,
            month: deathMonth,
            day: deathDay
          };
        } else {
          deathDate = {
            preferredCalendar: currentEditFormState.preferredCalendar,
            year: deathYear,
            month: deathMonth,
            day: deathDay
          };
        }
      }
    }

    // محاسبه سن
    const age = Calendar.computeAge(birthDate, deathDate, isDeceased);

    const biography = document.getElementById('memberBiography').value.trim();

    const memberPayload = {
      id: editingMemberId,
      firstName,
      lastName,
      gender,
      isHistorical,
      isDeceased,
      birthDate,
      deathDate,
      age,
      photo: currentEditFormState.photo,
      extraDetails: {
        interests: currentEditFormState.interests,
        video: currentEditFormState.video,
        audio: currentEditFormState.audio,
        galleryPhotos: currentEditFormState.galleryPhotos,
        biography
      }
    };

    const saved = Storage.saveMember(memberPayload);

    // اگر از طریق Quick Add متصل شده است
    if (pendingRelativeLink && saved) {
      Storage.linkRelation(pendingRelativeLink.personId, pendingRelativeLink.relationKey, saved.id);
      pendingRelativeLink = null;
    }

    closeAllModals();
    refreshView();
    showToast(`عضو «${saved.firstName} ${saved.lastName}» با موفقیت ذخیره شد.`, 'success');
  }

  // آپلود عکس با FileReader
  function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('حجم فایل عکس نباید بیشتر از ۵ مگابایت باشد.', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      currentEditFormState.photo = event.target.result;
      updatePhotoPreview(currentEditFormState.photo);
      showToast('عکس با موفقیت انتخاب شد.', 'info');
    };
    reader.readAsDataURL(file);
  }

  function updatePhotoPreview(imgUrl) {
    const previewContainer = document.getElementById('photoPreviewContainer');
    const previewImg = document.getElementById('photoPreviewImg');
    const placeholder = document.getElementById('photoPlaceholder');

    if (!previewContainer) return;

    if (imgUrl) {
      if (previewImg) {
        previewImg.src = imgUrl;
        previewImg.style.display = 'block';
      }
      if (placeholder) placeholder.style.display = 'none';
    } else {
      if (previewImg) previewImg.style.display = 'none';
      if (placeholder) placeholder.style.display = 'block';
    }
  }

  // رندر برچسب‌های علایق
  function renderInterestChips() {
    const container = document.getElementById('interestChipsContainer');
    if (!container) return;

    container.innerHTML = '';

    // برچسب‌های انتخاب شده
    currentEditFormState.interests.forEach(interest => {
      const chip = document.createElement('span');
      chip.className = 'interest-chip selected';
      chip.innerHTML = `${interest} <button type="button" class="btn-remove-chip">×</button>`;
      chip.querySelector('.btn-remove-chip').onclick = (e) => {
        e.stopPropagation();
        currentEditFormState.interests = currentEditFormState.interests.filter(i => i !== interest);
        renderInterestChips();
      };
      container.appendChild(chip);
    });

    // برچسب‌های پیشنهادی انتخاب نشده
    PRESET_INTERESTS.forEach(preset => {
      if (!currentEditFormState.interests.includes(preset)) {
        const chip = document.createElement('span');
        chip.className = 'interest-chip unselected';
        chip.textContent = `+ ${preset}`;
        chip.onclick = () => {
          currentEditFormState.interests.push(preset);
          renderInterestChips();
        };
        container.appendChild(chip);
      }
    });
  }

  function addCustomInterest() {
    const input = document.getElementById('customInterestInput');
    if (!input) return;
    const val = input.value.trim();
    if (val && !currentEditFormState.interests.includes(val)) {
      currentEditFormState.interests.push(val);
      input.value = '';
      renderInterestChips();
    }
  }

  // آپلود ویدیو با FileReader
  function handleVideoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      currentEditFormState.video = event.target.result;
      showToast('ویدیو با موفقیت ضمیمه شد.', 'info');
    };
    reader.readAsDataURL(file);
  }

  // آپلود صوت با FileReader
  function handleAudioUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      currentEditFormState.audio = event.target.result;
      showToast('فایل صوتی ضمیمه شد.', 'info');
    };
    reader.readAsDataURL(file);
  }

  // آپلود عکس‌های گالری
  function handleGalleryUpload(e) {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        currentEditFormState.galleryPhotos.push(event.target.result);
        renderGalleryThumbnails();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderGalleryThumbnails() {
    const container = document.getElementById('galleryThumbnailsContainer');
    if (!container) return;

    container.innerHTML = currentEditFormState.galleryPhotos.map((url, idx) => `
      <div class="thumb-wrap">
        <img src="${url}" alt="عکس">
        <button type="button" class="btn-remove-thumb" onclick="App.removeGalleryPhoto(${idx})">×</button>
      </div>
    `).join('');
  }

  function removeGalleryPhoto(idx) {
    currentEditFormState.galleryPhotos.splice(idx, 1);
    renderGalleryThumbnails();
  }

  // پیش‌نمایش تصویر در لایت‌باکس
  function previewImage(src) {
    const lb = document.getElementById('lightboxModal');
    const lbImg = document.getElementById('lightboxImg');
    if (lb && lbImg) {
      lbImg.src = src;
      lb.classList.add('show');
    }
  }

  /**
   * هوش مصنوعی و رفع اشکالگر خودکار GPT-6-SOL-MAX
   */
  function runAiAnalysis() {
    if (!currentClan) return;

    const report = AIDebugger.analyzeClan(currentClan);
    const container = document.getElementById('aiIssuesContainer');
    const brideGroomContainer = document.getElementById('aiBrideGroomContainer');
    const summaryText = document.getElementById('aiSummaryText');
    const statsBadge = document.getElementById('aiStatsBadge');

    if (summaryText) summaryText.textContent = report.summary;
    if (statsBadge) {
      statsBadge.textContent = `مدل: ${report.model} | اعضای اسکن‌شده: ${report.stats.checkedMembers} | عروس و داماد: ${report.stats.brideGroomPairs} | خطاها: ${report.stats.errors}`;
    }

    // گزارش عروس و داماد طبق فرمایش کاربر
    // "نسبت عروس [برای پدر شوهر و مادر شوهر ، عروس یعنی زن پسر ] و داماد [برای پدر زن و مادر زن ، داماد یعنی شوهر دختر ]را چک کن ببین اگر نیست اضافه کن"
    if (brideGroomContainer) {
      if (report.gpt6BrideGroomReport.length === 0) {
        brideGroomContainer.innerHTML = '<p class="text-muted small">هنوز رابطه زناشویی با فرزند در این شجره‌نامه تعریف نشده است.</p>';
      } else {
        brideGroomContainer.innerHTML = report.gpt6BrideGroomReport.map(r => `
          <div class="ai-bride-groom-card ${r.type}">
            <div class="ai-bg-badge ${r.type === 'bride' ? 'badge-bride' : 'badge-groom'}">
              ${r.type === 'bride' ? '💍 احراز عروس' : '🎩 احراز داماد'}
            </div>
            <div class="ai-bg-details">
              <strong>${r.relationName}:</strong> ${r.statusText}
            </div>
            <div class="ai-bg-status">
              ${r.isComplete ? '<span class="text-success">✅ تأیید شده</span>' : '<span class="text-warning">⚠️ نیازمند همگام‌سازی</span>'}
            </div>
          </div>
        `).join('');
      }
    }

    // گزارش اشکالات و خطاها
    if (container) {
      if (report.issues.length === 0) {
        container.innerHTML = `
          <div class="ai-clean-state">
            <span class="sparkle-icon">✨</span>
            <h4>تبریک! هیچ خطایی در شجره‌نامه کشف نشد.</h4>
            <p>تمام روابط نسَب و سبب، توالی‌های زمانی و قوانین تبارشناسی با استانداردهای مدل ${report.model} مطابقت کامل دارند.</p>
          </div>
        `;
      } else {
        container.innerHTML = report.issues.map(issue => `
          <div class="ai-issue-card level-${issue.level}">
            <div class="ai-issue-head">
              <span class="issue-level-tag ${issue.level}">${issue.level === 'error' ? '❌ خطای بحرانی' : (issue.level === 'warning' ? '⚠️ هشدار' : 'ℹ️ پیشنهاد')}</span>
              <strong class="issue-title">${issue.title}</strong>
            </div>
            <p class="issue-desc">${issue.description}</p>
            ${issue.fixData ? `
              <div class="issue-action">
                <button class="btn btn-sm btn-outline-success" onclick="App.applySingleFix('${issue.id}')">
                  ⚡ ${issue.actionText}
                </button>
              </div>
            ` : ''}
          </div>
        `).join('');
      }
    }
  }

  function applySingleFix(issueId) {
    if (!currentClan) return;
    const report = AIDebugger.analyzeClan(currentClan);
    const issue = report.issues.find(i => i.id === issueId);
    if (issue && AIDebugger.applyFix(issue, currentClan)) {
      refreshView();
      runAiAnalysis();
      showToast('اشکال با موفقیت اصلاح شد.', 'success');
    }
  }

  // اجرای دستور متنی کاربر در بخش دستور العمل هوش مصنوعی
  function handleAiInstructionSubmit() {
    const input = document.getElementById('aiInstructionInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;

    if (!currentClan) {
      showToast('ابتدا یک خاندان ایجاد یا بارگذاری کنید.', 'warning');
      return;
    }

    const logContainer = document.getElementById('aiConsoleLogs');
    if (logContainer) {
      logContainer.innerHTML = '<div class="ai-thinking">🤖 مدل GPT-6-SOL-MAX در حال پردازش دستور العمل...</div>';
    }

    setTimeout(() => {
      const result = AIDebugger.processUserInstruction(text, currentClan);

      if (logContainer) {
        logContainer.innerHTML = result.logSteps.map(step => `<div class="console-line">${escapeHtml(step)}</div>`).join('');
        logContainer.scrollTop = logContainer.scrollHeight;
      }

      showToast(result.responseMessage, 'success');
      refreshView();
      runAiAnalysis();
    }, 400);
  }

  // ایجاد خاندان جدید
  function openNewClanModal() {
    const name = prompt('لطفاً نام خاندان جدید را وارد نمایید: (مثلاً: خاندان سلیمانی)');
    if (name && name.trim()) {
      const newClan = Storage.createClan(name.trim());
      currentClan = newClan;
      renderClanSelector();
      refreshView();
      showToast(`خاندان جدید «${newClan.name}» ایجاد شد.`, 'success');
    } else {
      renderClanSelector();
    }
  }

  // حذف کامل خاندان
  // "قابلیت حذف کل خاندان + قابلیت ایجاد بی نهایت خاندان را اضافه کن."
  function confirmDeleteClan() {
    if (!currentClan) return;

    const confirmed = confirm(`⚠️ آیا از حذف کامل خاندان «${currentClan.name}» و تمام اعضا و روابط آن مطمئن هستید؟ این عملیات غیرقابل بازگشت است.`);
    if (confirmed) {
      const clanName = currentClan.name;
      Storage.deleteClan(currentClan.id);
      currentClan = Storage.getActiveClan();
      renderClanSelector();
      refreshView();
      showToast(`خاندان «${clanName}» به طور کامل حذف شد.`, 'info');
    }
  }

  function showEmptyStateAlert() {
    // پیام راهنمای بار اول
    console.log('خاندانی یافت نشد یا خاندان خالی است.');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  return {
    init,
    switchTab,
    openMemberModal,
    openProfileModal,
    openRelativesModal,
    quickAddRelative,
    linkExistingRelative,
    unlinkRelation,
    setAsFocal,
    onNodeClicked,
    removeGalleryPhoto,
    previewImage,
    applySingleFix,
    handleAiInstructionSubmit
  };
})();

// راه‌اندازی پس از بارگذاری کامل صفحه
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
