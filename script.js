// VLM OCR 實習成果報告：只保留一般瀏覽器 JavaScript，不需要任何 framework。

// 1) 側欄：依目前閱讀位置標示章節。
(() => {
  const links = Array.from(document.querySelectorAll('[data-toc]'));
  const sections = links
    .map(link => document.getElementById(link.getAttribute('data-toc')))
    .filter(Boolean);

  function paint(id) {
    links.forEach(link => {
      link.classList.toggle('is-active', link.dataset.toc === id);
    });
  }

  function onScroll() {
    let current = sections[0]?.id;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= 140) current = section.id;
    }
    if (current) paint(current);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

// 2) OmniDocBench 雷達圖：座標由資料算出，不在 HTML 手算填死。
//    五個軸的角度是寫死的幾何常數（正五邊形，Text 在正上方、順時針每軸
//    72°），但每個模型的分數只在這裡出現一次；改分數只要改這個陣列。
(() => {
  const RADAR_AXES = ['text', 'teds', 'cdm', 'order', 'overall'];
  const RADAR_CENTER = { x: 170, y: 150 };
  const RADAR_MAX_RADIUS = 110;

  const RADAR_DATA = [
    { model: 'Qwen3-VL 32B',       color: '#2563eb', text: 88.9, teds: 78.5, cdm: 88.5, order: 79.4, overall: 85.3 },
    { model: 'Qwen3-VL 4B',        color: '#3b82f6', text: 85.1, teds: 67.6, cdm: 74.2, order: 75.7, overall: 75.6 },
    { model: 'Gemma 4 31B',        color: '#064e3b', text: 71.4, teds: 63.2, cdm: 81.3, order: 72.4, overall: 71.9 },
    { model: 'InternVL3.5 38B',    color: '#b45309', text: 74.5, teds: 57.9, cdm: 79.0, order: 71.8, overall: 70.5 },
    { model: 'InternVL3.5 4B',     color: '#b45309', text: 80.4, teds: 59.3, cdm: 69.3, order: 74.2, overall: 69.6 },
    { model: 'Gemma 4 26B A4B',    color: '#065f46', text: 62.6, teds: 55.3, cdm: 72.4, order: 64.9, overall: 63.4 },
    { model: 'Gemma 4 12B',        color: '#047857', text: 35.6, teds: 30.1, cdm: 46.7, order: 49.8, overall: 37.5 },
    { model: 'Gemma 4 E4B',        color: '#059669', text: 28.6, teds: 20.4, cdm: 31.7, order: 45.1, overall: 26.9 },
    { model: 'Gemma 4 E2B',        color: '#10b981', text: 19.9, teds: 6.8,  cdm: 25.2, order: 37.3, overall: 17.3 },
  ];

  function radarPoints(entry) {
    return RADAR_AXES.map((key, i) => {
      const angle = (-90 + i * 72) * (Math.PI / 180);
      const r = RADAR_MAX_RADIUS * (entry[key] / 100);
      const x = RADAR_CENTER.x + r * Math.cos(angle);
      const y = RADAR_CENTER.y + r * Math.sin(angle);
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
  }

  function hexToRgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  document.querySelectorAll('.radar-series[data-model]').forEach(polygon => {
    const entry = RADAR_DATA.find(d => d.model === polygon.dataset.model);
    if (!entry) return;
    polygon.setAttribute('points', radarPoints(entry));
    polygon.setAttribute('stroke', entry.color);
    polygon.setAttribute('fill', hexToRgba(entry.color, 0.13));
  });
})();

// 3) OmniDocBench 雷達圖模型切換。
(() => {
  const chips = Array.from(document.querySelectorAll('.model-chip'));
  const series = Array.from(document.querySelectorAll('.radar-series'));
  const rows = Array.from(document.querySelectorAll('.radar-row'));

  if (!chips.length) return;

  function rgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
  }

  function setActive(button, active) {
    const name = button.dataset.model;
    const color = button.dataset.color;
    button.setAttribute('aria-pressed', String(active));
    button.style.background = active ? rgba(color, 0.14) : '#ffffff';
    button.style.borderColor = active ? rgba(color, 0.55) : '#e0e6ed';
    button.style.color = active ? '#101d26' : '#4d5d6b';

    series.filter(el => el.dataset.model === name).forEach(el => {
      el.style.display = active ? '' : 'none';
    });
    rows.filter(el => el.dataset.model === name).forEach(el => {
      el.style.display = active ? '' : 'none';
    });
  }

  chips.forEach(button => {
    // 初始外觀（active/inactive 底色）改由這裡統一計算，不再靠 CSS 另外
    // 定義一組「預設就是 active」的樣式跟這裡的邏輯各自維護一份、容易兩邊不同步。
    setActive(button, button.getAttribute('aria-pressed') === 'true');
    button.addEventListener('click', () => {
      setActive(button, button.getAttribute('aria-pressed') !== 'true');
    });
  });
})();

// 4) 中英雙語切換。中英文內容都寫死在 HTML 裡，這裡只改根元素的
//    data-lang，實際顯示／隱藏交給 CSS；因此切換不需重新載入頁面，
//    也不會有翻譯字串散落在 JS 與 HTML 兩邊的問題。
(() => {
  const button = document.getElementById('lang-toggle');
  if (!button) return;

  // <title> 與 meta description 不在文件流裡，無法用 data-lang 複製一份，
  // 只有這兩項需要在 JS 這邊維護對照表。
  const TITLE = {
    zh: '[草稿] VLM OCR 評測實習成果報告 | OCF 2026',
    en: '[Draft] VLM OCR Benchmark Internship Report | OCF 2026',
  };
  const DESCRIPTION = {
    zh: 'OCF 2026 AI 研究實習：開源 VLM 繁體中文 OCR 與文件解析評測成果報告',
    en: 'OCF 2026 AI Research Internship: benchmarking open-source VLMs on Traditional Chinese OCR and document parsing.',
  };

  const description = document.querySelector('meta[name="description"]');

  function current() {
    return document.documentElement.dataset.lang === 'en' ? 'en' : 'zh';
  }

  function apply(lang) {
    document.documentElement.dataset.lang = lang;
    document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant';
    document.title = TITLE[lang];
    if (description) description.setAttribute('content', DESCRIPTION[lang]);
    try {
      localStorage.setItem('ocf-report-lang', lang);
    } catch (e) { /* 隱私模式下無法保存，切換本身仍然有效。 */ }
  }

  // <head> 的行內 script 只還原了 data-lang（為了避免閃爍），
  // title 與 description 在這裡補齊。
  apply(current());

  button.addEventListener('click', () => {
    apply(current() === 'en' ? 'zh' : 'en');
    // 換語言後段落高度會變，讓側欄目錄依新的捲動位置重新標示章節。
    window.dispatchEvent(new Event('scroll'));
  });
})();
