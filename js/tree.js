/**
 * tree.js - رسم تعاملی درخت تبارشناسی (شجره‌نامه) با SVG
 * مجهز به بزرگ‌نمایی (Zoom)، جابجایی (Pan)، انتخاب فرد محوری با لمس،
 * و حفظ صریح خط اتصال دختر به پدرش در صورت ازدواج فامیلی (دختر عمو/دایی/عمه/خاله)
 */

const TreeViewer = (() => {
  let svgContainer = null;
  let svgContent = null;
  let currentClan = null;
  let zoomLevel = 1;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let startX = 0;
  let startY = 0;

  // تنظیمات ابعاد کارت‌ها در درخت
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 110;
  const LEVEL_GAP_Y = 180;
  const SIBLING_GAP_X = 60;

  function init(containerElement) {
    svgContainer = containerElement;
    if (!svgContainer) return;

    svgContainer.innerHTML = '';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('class', 'family-tree-svg');
    svg.id = 'familyTreeSvg';

    // ساخت گروه اصلی با قابلیت زوم و پن
    svgContent = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svgContent.setAttribute('id', 'treeContentGroup');
    svg.appendChild(svgContent);

    svgContainer.appendChild(svg);

    // افزودن رویدادهای ماوس و لمس برای جابجایی و زوم
    setupPanAndZoom(svg);
  }

  function setupPanAndZoom(svg) {
    // جابجایی با درگ ماوس
    svg.addEventListener('mousedown', (e) => {
      if (e.target.closest('.tree-node')) return; // جلوگیری از پن هنگام کلیک روی کارت
      isPanning = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
      svg.style.cursor = 'grabbing';
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      panX = e.clientX - startX;
      panY = e.clientY - startY;
      updateTransform();
    });

    window.addEventListener('mouseup', () => {
      isPanning = false;
      if (svg) svg.style.cursor = 'grab';
    });

    // زوم با اسکرول ماوس
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      zoom(zoomFactor, e.clientX, e.clientY);
    }, { passive: false });

    // پشتیبانی از لمس در موبایل
    let touchStartDist = 0;
    svg.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        if (e.target.closest('.tree-node')) return;
        isPanning = true;
        startX = e.touches[0].clientX - panX;
        startY = e.touches[0].clientY - panY;
      } else if (e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    });

    svg.addEventListener('touchmove', (e) => {
      if (isPanning && e.touches.length === 1) {
        panX = e.touches[0].clientX - startX;
        panY = e.touches[0].clientY - startY;
        updateTransform();
      } else if (e.touches.length === 2 && touchStartDist > 0) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = dist / touchStartDist;
        zoom(factor > 1 ? 1.03 : 0.97);
        touchStartDist = dist;
      }
    }, { passive: false });

    svg.addEventListener('touchend', () => {
      isPanning = false;
      touchStartDist = 0;
    });
  }

  function zoom(factor, clientX, clientY) {
    const newZoom = Math.min(Math.max(zoomLevel * factor, 0.25), 3.0);
    zoomLevel = newZoom;
    updateTransform();
  }

  function resetView() {
    zoomLevel = 1;
    panX = 0;
    panY = 0;
    updateTransform();
  }

  function updateTransform() {
    if (!svgContent) return;
    svgContent.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoomLevel})`);
  }

  /**
   * محاسبه نسل‌ها و موقعیت‌یابی اعضا در شجره‌نامه
   */
  function calculateGenerations(members) {
    const levels = {};
    const visited = new Set();

    // اعضایی که والد ندارند نسل ۰ فرض می‌شوند
    const rootCandidates = Object.values(members).filter(m => !m.fatherId && !m.motherId);
    if (rootCandidates.length === 0 && Object.keys(members).length > 0) {
      rootCandidates.push(Object.values(members)[0]);
    }

    function assignLevel(personId, currentLevel) {
      if (visited.has(personId)) return;
      visited.add(personId);

      levels[personId] = Math.max(levels[personId] || 0, currentLevel);
      const person = members[personId];
      if (!person) return;

      // همسران هم‌سطح هستند
      (person.spouseIds || []).forEach(sid => {
        if (members[sid] && levels[sid] === undefined) {
          levels[sid] = levels[personId];
        }
      });

      // فرزندان یک نسل پایین‌تر هستند
      const kids = Kinship.getChildren(person, members);
      kids.forEach(k => {
        assignLevel(k.id, levels[personId] + 1);
      });
    }

    rootCandidates.forEach(r => assignLevel(r.id, 0));

    // برای سایر اعضایی که در گراف بالا متصل نشدند
    Object.keys(members).forEach(id => {
      if (levels[id] === undefined) {
        assignLevel(id, 0);
      }
    });

    return levels;
  }

  /**
   * رسم کامل درخت با پشتیبانی ویژه از ازدواج‌های فامیلی (دختر عمو/دایی/عمه/خاله)
   * "در بخش درختی، اگر همسر یک مرد، دختر عمو/دایی/عمه/خاله ی آن مرد باشد،
   * همچنان خط متصل کننده آن دختر به پدرش نشان داده شود."
   */
  function render(clan) {
    if (!svgContent) return;
    currentClan = clan;
    svgContent.innerHTML = '';

    if (!clan || !clan.members || Object.keys(clan.members).length === 0) {
      renderEmptyState();
      return;
    }

    const members = clan.members;
    const focalId = clan.focalPersonId;
    const generations = calculateGenerations(members);

    // گروه‌بندی اشخاص بر اساس نسل
    const genGroups = {};
    Object.entries(generations).forEach(([personId, gen]) => {
      if (!genGroups[gen]) genGroups[gen] = [];
      genGroups[gen].push(personId);
    });

    const nodePositions = {};
    const sortedGens = Object.keys(genGroups).map(Number).sort((a, b) => a - b);

    // محاسبه چیدمان مختصات کارت‌ها (X و Y)
    sortedGens.forEach((gen, levelIndex) => {
      const pIds = genGroups[gen];
      const count = pIds.length;
      const totalWidth = count * NODE_WIDTH + (count - 1) * SIBLING_GAP_X;
      const startX = -totalWidth / 2;
      const posY = levelIndex * LEVEL_GAP_Y + 80;

      pIds.forEach((pid, idx) => {
        const posX = startX + idx * (NODE_WIDTH + SIBLING_GAP_X);
        nodePositions[pid] = { x: posX, y: posY };
      });
    });

    // لایه‌بندی المان‌های SVG:
    // ۱. گروه خطوط پیوند زیستی پدری/مادری (Lineage lines)
    // ۲. گروه خطوط پیوند زناشویی (Marriage lines)
    // ۳. گروه کارت‌های اشخاص (Nodes)
    const linesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    linesGroup.setAttribute('class', 'tree-lines-group');
    svgContent.appendChild(linesGroup);

    const marriageLinesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    marriageLinesGroup.setAttribute('class', 'tree-marriage-lines-group');
    svgContent.appendChild(marriageLinesGroup);

    const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodesGroup.setAttribute('class', 'tree-nodes-group');
    svgContent.appendChild(nodesGroup);

    // رسم خطوط اتصال زیستی والدین به فرزندان (Blood / Lineage)
    // توجه ویژه: برای دخترانی که با پسر عمو/دایی/عمه/خاله ازدواج کرده‌اند، خط اتصال زیستی به پدر مستقیماً کشیده می‌شود!
    Object.values(members).forEach(person => {
      const pPos = nodePositions[person.id];
      if (!pPos) return;

      // اتصال به پدر
      if (person.fatherId && nodePositions[person.fatherId]) {
        const fatherPos = nodePositions[person.fatherId];
        const path = createCurvedConnector(
          fatherPos.x + NODE_WIDTH / 2,
          fatherPos.y + NODE_HEIGHT,
          pPos.x + NODE_WIDTH / 2,
          pPos.y,
          'paternal'
        );
        path.setAttribute('data-father', person.fatherId);
        path.setAttribute('data-child', person.id);
        path.setAttribute('class', 'tree-line lineage-line father-line');
        linesGroup.appendChild(path);
      }

      // اتصال به مادر
      if (person.motherId && nodePositions[person.motherId]) {
        const motherPos = nodePositions[person.motherId];
        const path = createCurvedConnector(
          motherPos.x + NODE_WIDTH / 2,
          motherPos.y + NODE_HEIGHT,
          pPos.x + NODE_WIDTH / 2,
          pPos.y,
          'maternal'
        );
        path.setAttribute('data-mother', person.motherId);
        path.setAttribute('data-child', person.id);
        path.setAttribute('class', 'tree-line lineage-line mother-line');
        linesGroup.appendChild(path);
      }
    });

    // رسم خطوط پیوند زناشویی (Spouse connections)
    const drawnCouples = new Set();
    Object.values(members).forEach(person => {
      const pPos = nodePositions[person.id];
      if (!pPos) return;

      (person.spouseIds || []).forEach(spouseId => {
        const spousePos = nodePositions[spouseId];
        if (!spousePos) return;

        const coupleKey = [person.id, spouseId].sort().join('___');
        if (drawnCouples.has(coupleKey)) return;
        drawnCouples.add(coupleKey);

        const spouse = members[spouseId];

        // بررسی اینکه آیا ازدواج فامیلی است (دختر عمو، دختر دایی، دختر عمه، دختر خاله)
        const isConsanguineous = (spouse.gender === 'female' && spouse.fatherId && person.fatherId) || 
                                 (person.gender === 'female' && person.fatherId && spouse.fatherId);

        const mPath = createMarriageConnector(
          pPos.x + NODE_WIDTH / 2,
          pPos.y + NODE_HEIGHT / 2,
          spousePos.x + NODE_WIDTH / 2,
          spousePos.y + NODE_HEIGHT / 2,
          isConsanguineous
        );

        mPath.setAttribute('class', `tree-line marriage-line ${isConsanguineous ? 'consanguineous-marriage' : ''}`);
        mPath.setAttribute('data-couple', coupleKey);
        marriageLinesGroup.appendChild(mPath);

        // آیکون حلقه یا قلب در میانه خط پیوند زناشویی
        const midX = (pPos.x + spousePos.x + NODE_WIDTH) / 2;
        const midY = (pPos.y + spousePos.y + NODE_HEIGHT) / 2 - 15;
        const heartBadge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        heartBadge.setAttribute('x', midX);
        heartBadge.setAttribute('y', midY);
        heartBadge.setAttribute('class', 'marriage-heart-badge');
        heartBadge.setAttribute('text-anchor', 'middle');
        heartBadge.textContent = '💍';
        marriageLinesGroup.appendChild(heartBadge);
      });
    });

    // رسم کارت‌های اعضا (Nodes)
    Object.values(members).forEach(person => {
      const pos = nodePositions[person.id];
      if (!pos) return;

      const isFocal = (person.id === focalId);
      const kinshipInfo = focalId ? Kinship.calculateKinship(focalId, person.id, members) : null;

      const nodeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      nodeG.setAttribute('class', `tree-node ${isFocal ? 'is-focal' : ''} gender-${person.gender}`);
      nodeG.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
      nodeG.setAttribute('data-person-id', person.id);

      // پس‌زمینه کارت
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', NODE_WIDTH);
      rect.setAttribute('height', NODE_HEIGHT);
      rect.setAttribute('rx', '14');
      rect.setAttribute('class', `node-card-bg ${person.gender} ${isFocal ? 'focal-border' : ''} ${person.isDeceased ? 'deceased' : ''}`);
      nodeG.appendChild(rect);

      // دایره آواتار / تصویر
      const avatarG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      avatarG.setAttribute('transform', 'translate(165, 20)');

      const avatarCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      avatarCircle.setAttribute('cx', '22');
      avatarCircle.setAttribute('cy', '22');
      avatarCircle.setAttribute('r', '22');
      avatarCircle.setAttribute('class', `avatar-bg gender-${person.gender}`);
      avatarG.appendChild(avatarCircle);

      if (person.photo) {
        // تصویر واقعی عضو
        const clipId = `clip_${person.id}`;
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        clip.setAttribute('id', clipId);
        const clipCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        clipCircle.setAttribute('cx', '22');
        clipCircle.setAttribute('cy', '22');
        clipCircle.setAttribute('r', '22');
        clip.appendChild(clipCircle);
        svgContent.appendChild(clip);

        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', person.photo);
        img.setAttribute('x', '0');
        img.setAttribute('y', '0');
        img.setAttribute('width', '44');
        img.setAttribute('height', '44');
        img.setAttribute('clip-path', `url(#${clipId})`);
        avatarG.appendChild(img);
      } else {
        // آیکون پیش‌فرض بر اساس جنسیت
        const avatarIcon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        avatarIcon.setAttribute('x', '22');
        avatarIcon.setAttribute('y', '27');
        avatarIcon.setAttribute('text-anchor', 'middle');
        avatarIcon.setAttribute('class', 'avatar-emoji');
        avatarIcon.textContent = person.gender === 'female' ? '👩' : (person.gender === 'male' ? '👨' : '👤');
        avatarG.appendChild(avatarIcon);
      }

      nodeG.appendChild(avatarG);

      // نام و نام خانوادگی
      const nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      nameText.setAttribute('x', '155');
      nameText.setAttribute('y', '32');
      nameText.setAttribute('text-anchor', 'end');
      nameText.setAttribute('class', 'node-title-text');
      nameText.textContent = `${person.firstName} ${person.lastName}`.trim();
      nodeG.appendChild(nameText);

      // سن و وضعیت حیات/وفات
      const subText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      subText.setAttribute('x', '155');
      subText.setAttribute('y', '50');
      subText.setAttribute('text-anchor', 'end');
      subText.setAttribute('class', 'node-sub-text');

      let ageDisplay = '';
      if (person.isHistorical) {
        ageDisplay = '🏛️ شخصیت تاریخی';
      } else if (person.isDeceased) {
        ageDisplay = person.age ? `فوت شده (${person.age} سال)` : 'فوت شده 🖤';
      } else {
        ageDisplay = person.age ? `${person.age} ساله` : 'در قید حیات 🌿';
      }
      subText.textContent = ageDisplay;
      nodeG.appendChild(subText);

      // برچسب نسبت با فرد محوری (Focal Kinship Badge)
      if (kinshipInfo) {
        const badgeG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        badgeG.setAttribute('transform', 'translate(10, 68)');

        const badgeRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        badgeRect.setAttribute('width', '200');
        badgeRect.setAttribute('height', '28');
        badgeRect.setAttribute('rx', '8');
        badgeRect.setAttribute('class', `kinship-pill ${kinshipInfo.badgeClass || ''} ${isFocal ? 'pill-focal-gold' : ''}`);
        badgeG.appendChild(badgeRect);

        const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        badgeText.setAttribute('x', '100');
        badgeText.setAttribute('y', '19');
        badgeText.setAttribute('text-anchor', 'middle');
        badgeText.setAttribute('class', 'kinship-pill-text');
        badgeText.textContent = isFocal ? '👑 فرد محوری (شاخص)' : kinshipInfo.label;
        badgeG.appendChild(badgeText);

        nodeG.appendChild(badgeG);
      }

      // رویداد کلیک یا لمس کارت:
      // "با انتخاب یک فرد محور با لمس آن، آن فرد ، فرد محوری شده است."
      nodeG.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.App && typeof window.App.onNodeClicked === 'function') {
          window.App.onNodeClicked(person.id, e);
        }
      });

      // رویداد هاور جهت روشن شدن همزمان خط نسب خونی دختر به پدر و خط ازدواج
      nodeG.addEventListener('mouseenter', () => {
        highlightNodeConnections(person.id, true);
      });
      nodeG.addEventListener('mouseleave', () => {
        highlightNodeConnections(person.id, false);
      });

      nodesGroup.appendChild(nodeG);
    });

    // تنظیم اولیه مرکزیت دید روی درخت
    fitTreeToView();
  }

  // رسم خط منحنی نرم اتصال والدینی
  function createCurvedConnector(x1, y1, x2, y2, type) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const midY = (y1 + y2) / 2;
    const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    path.setAttribute('d', d);
    return path;
  }

  // رسم خط پیوند ازدواج
  function createMarriageConnector(x1, y1, x2, y2, isConsanguineous) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    // منحنی قوس‌دار زیبا برای پیوند زناشویی
    const dx = x2 - x1;
    const dy = y2 - y1;
    const curveOffset = Math.abs(dx) > 100 ? (dy === 0 ? -40 : -30) : -25;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 + curveOffset;

    const d = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;
    path.setAttribute('d', d);
    return path;
  }

  // برجسته‌سازی و هایلایت خطوط متصل به شخص به همراه خط اتصال دختر به پدر
  function highlightNodeConnections(personId, highlight) {
    if (!svgContent) return;
    const lines = svgContent.querySelectorAll(`[data-child="${personId}"], [data-father="${personId}"], [data-mother="${personId}"]`);
    lines.forEach(l => {
      if (highlight) {
        l.classList.add('line-highlighted');
      } else {
        l.classList.remove('line-highlighted');
      }
    });

    const mLines = svgContent.querySelectorAll(`.marriage-line`);
    mLines.forEach(ml => {
      const couple = ml.getAttribute('data-couple') || '';
      if (couple.includes(personId)) {
        if (highlight) {
          ml.classList.add('marriage-highlighted');
        } else {
          ml.classList.remove('marriage-highlighted');
        }
      }
    });
  }

  function fitTreeToView() {
    if (!svgContent || !svgContainer) return;
    const bbox = svgContent.getBBox();
    if (!bbox || bbox.width === 0 || bbox.height === 0) return;

    const containerWidth = svgContainer.clientWidth || 800;
    const containerHeight = svgContainer.clientHeight || 600;

    const scaleX = (containerWidth - 100) / bbox.width;
    const scaleY = (containerHeight - 100) / bbox.height;
    zoomLevel = Math.min(Math.max(Math.min(scaleX, scaleY), 0.4), 1.1);

    panX = (containerWidth / 2) - (bbox.x + bbox.width / 2) * zoomLevel;
    panY = 60 - bbox.y * zoomLevel;

    updateTransform();
  }

  function renderEmptyState() {
    if (!svgContent || !svgContainer) return;
    const w = svgContainer.clientWidth || 800;
    const h = svgContainer.clientHeight || 500;

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '0');
    text.setAttribute('y', '150');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('class', 'tree-empty-text');
    text.textContent = '🌿 شجره‌نامه این خاندان هنوز خالی است. اولین عضو را با دکمه «افزودن عضو جدید» ثبت نمایید.';
    svgContent.appendChild(text);

    panX = w / 2;
    panY = 100;
    zoomLevel = 1;
    updateTransform();
  }

  return {
    init,
    render,
    zoom,
    resetView,
    fitTreeToView
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = TreeViewer;
}
