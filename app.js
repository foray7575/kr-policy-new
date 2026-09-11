const features = Array.from(document.querySelectorAll('.feature'));
    const trendList = document.getElementById('trendList');
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalDesc = document.getElementById('modalDesc');
    const modalBody = document.getElementById('modalBody');
    const modalCancel = document.getElementById('modalCancel');
    const modalAction = document.getElementById('modalAction');

    // --- 카드 클릭으로 열기/닫기 ---
    features.forEach(f => {
      const updateAria = (open) => {
        f.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) f.classList.add('open'); else f.classList.remove('open');
      };

      f.addEventListener('click', (e) => {
        if (e.target.tagName.toLowerCase() === 'button') return;
        const isOpen = f.classList.contains('open');
        if (!isOpen) {
          features.forEach(x => { if (x !== f) updateAria(false); });
          updateAria(true);
        } else {
          updateAria(false);
        }
      });

      f.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          f.click();
        }
      });
    });

    // --- 최신 동향: 열린국회정보 API 기반 최신순 법률안 ---
    function formatRelativeDate(dateStr) {
      if (!dateStr) return '';
      const then = new Date(`${dateStr}T00:00:00+09:00`);
      if (isNaN(then.getTime())) return dateStr;
      const now = new Date();
      const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return '오늘';
      if (diffDays === 1) return '어제';
      return `${diffDays}일 전`;
    }

    async function fetchLatestBills(limit) {
      try {
        const res = await fetch(`/api/nanet-search?latest=1&pSize=${limit}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        return items.map(item => ({
          title: item.title || '(제목 없음)',
          time: formatRelativeDate(item.pubDate),
          link: item.link || ''
        }));
      } catch (err) {
        return [];
      }
    }

    function renderTrendItems(container, data, opts) {
      const isSide = !!(opts && opts.side);
      container.innerHTML = '';
      if (data.length === 0) {
        container.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">최신 법률안을 불러오지 못했습니다.</div>';
        return;
      }
      data.forEach(d => {
        const titleHtml = d.link
          ? `<a href="${d.link}" target="_blank" rel="noopener" style="color:var(--blue-text);font-weight:700;text-decoration:none">${d.title}</a>`
          : `<div style="font-weight:700;color:var(--blue-text)">${d.title}</div>`;
        const el = document.createElement('div');
        if (isSide) {
          el.className = 'top-item';
          el.innerHTML = `<div style="width:6px;height:40px;border-radius:3px;background:var(--blue-primary);opacity:0.6"></div>
                          <div style="flex:1">
                            ${titleHtml}
                            <div style="color:var(--muted);font-size:13px;margin-top:4px">${d.time}</div>
                          </div>`;
        } else {
          el.style.padding = '10px 0';
          el.style.borderBottom = '1px solid rgba(0,0,0,0.05)';
          el.innerHTML = `${titleHtml}<div style="color:var(--muted);font-size:13px;margin-top:4px">${d.time}</div>`;
        }
        container.appendChild(el);
      });
    }

    async function renderTrendsToSide() {
      trendList.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">최신 법률안을 불러오는 중...</div>';
      const data = await fetchLatestBills(4);
      renderTrendItems(trendList, data, { side: true });
    }

    renderTrendsToSide();

    document.getElementById('refreshTrends').addEventListener('click', () => {
      const btn = document.getElementById('refreshTrends');
      btn.textContent = '갱신 중...';
      renderTrendsToSide().then(() => { btn.textContent = '새로고침'; });
    });

    // Hero lede area: monthly bill proposal trend chart (with cumulative up-to-month filter)
    const billTrendChartEl = document.getElementById('billTrendChart');
    const billTrendSelectEl = document.getElementById('billTrendMonthSelect');
    const BILL_TREND_ALL = 'all';
    let billTrendMonths = [];

    function formatMonthLabel(monthKey) {
      if (!monthKey || monthKey.indexOf('-') === -1) return monthKey;
      const [, m] = monthKey.split('-');
      return `${parseInt(m, 10)}월`;
    }

    function renderBillTrendBars(monthsList, globalMax) {
      const maxCount = globalMax || Math.max(1, ...monthsList.map(m => m.count));
      billTrendChartEl.innerHTML = monthsList.map(m => {
        const heightPct = Math.max(4, Math.round((m.count / maxCount) * 100));
        return `
          <div class="bill-trend-bar-col" title="${m.month} · ${m.count}건">
            <div class="bill-trend-bar-value">${m.count}</div>
            <div class="bill-trend-bar" style="height:${heightPct}%"></div>
            <div class="bill-trend-bar-label">${formatMonthLabel(m.month)}</div>
          </div>`;
      }).join('');
    }

    function renderBillTrendChart(selectedValue) {
      if (!billTrendChartEl) return;
      if (!billTrendMonths.length) {
        billTrendChartEl.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">월간 발의 추이를 불러오지 못했습니다.</div>';
        return;
      }
      const globalMax = Math.max(1, ...billTrendMonths.map(m => m.count));
      if (!selectedValue || selectedValue === BILL_TREND_ALL) {
        renderBillTrendBars(billTrendMonths, globalMax);
        return;
      }
      // 선택한 월까지 누적(해당 월 포함, 그 이전 월들)만 표시
      const upToSelected = billTrendMonths.filter(m => m.month <= selectedValue);
      renderBillTrendBars(upToSelected.length ? upToSelected : billTrendMonths, globalMax);
    }

    function populateBillTrendSelect(selectedValue) {
      if (!billTrendSelectEl) return;
      const allOption = `<option value="${BILL_TREND_ALL}"${selectedValue === BILL_TREND_ALL ? ' selected' : ''}>전체 12개월 보기</option>`;
      const monthOptions = billTrendMonths.map(m =>
        `<option value="${m.month}"${m.month === selectedValue ? ' selected' : ''}>${m.month}까지</option>`
      ).join('');
      billTrendSelectEl.innerHTML = allOption + monthOptions;
    }

    async function initBillTrend() {
      if (!billTrendChartEl) return;
      billTrendChartEl.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">월간 발의 추이를 불러오는 중...</div>';
      try {
        const res = await fetch('/api/bill-trend');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        billTrendMonths = Array.isArray(data.months) ? data.months : [];
      } catch (err) {
        billTrendMonths = [];
      }
      if (!billTrendMonths.length) {
        renderBillTrendChart(null);
        return;
      }
      populateBillTrendSelect(BILL_TREND_ALL);
      renderBillTrendChart(BILL_TREND_ALL);
    }

    if (billTrendSelectEl) {
      billTrendSelectEl.addEventListener('change', () => {
        renderBillTrendChart(billTrendSelectEl.value);
      });
    }

    initBillTrend();

    // --- 검색: 국회도서관 Open API 연동 (언론 키워드 사전 + 상세보기 + 관심 목록) ---
    function escapeSearchHtml(value) {
      return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }

    // 1) 언론 키워드 사전: 뉴스/방송에서 자주 쓰는 표현 -> 실제 법률 용어(복수 후보)
    const MEDIA_KEYWORD_MAP = {
      '노란봉투법': ['노동조합법', '노동쟁의', '노동조합'],
      '검수완박': ['검찰청법', '형사소송법', '수사권'],
      '보완수사권': ['형사소송법', '수사권', '검찰수사'],
      '전세사기법': ['전세사기', '주택임대차', '특별법'],
      '간호법': ['간호사', '의료법', '간호'],
      '중대재해처벌법': ['중대재해', '산업안전보건법', '사업주 책임'],
      '중처법': ['중대재해', '산업안전보건법', '사업주 책임']
    };
    const DEFAULT_SEARCH_SUGGESTIONS = ['노동조합', '형사소송법', '중대재해'];
    // 자동완성/유사어 제안에 쓰이는 키워드 풀: 언론 키워드(사전 key) + 매핑된 법률 용어(사전 value) 전체
    const KNOWN_SEARCH_TERMS = Array.from(new Set([
      ...Object.keys(MEDIA_KEYWORD_MAP),
      ...Object.values(MEDIA_KEYWORD_MAP).flat()
    ]));

    let lastSearchItems = [];
    let currentDetailItem = null;

    // 레벤슈타인 거리: 오타 포함 검색어와 사전 키워드 사이의 유사도를 순수 클라이언트 계산으로 측정(AI/API 미사용)
    function levenshteinDistance(a, b) {
      const m = a.length, n = b.length;
      if (m === 0) return n;
      if (n === 0) return m;
      const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;
      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          dp[i][j] = a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
      return dp[m][n];
    }

    function findClosestKeywords(query, limit) {
      const q = (query || '').trim();
      if (!q) return [];
      return KNOWN_SEARCH_TERMS
        .map(term => ({ term, dist: levenshteinDistance(q, term) }))
        .filter(x => x.term !== q && x.dist <= Math.max(2, Math.ceil(q.length / 2)))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, limit || 3)
        .map(x => x.term);
    }

    async function fetchBills(term) {
      const res = await fetch(`/api/nanet-search?q=${encodeURIComponent(term)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    }

    function dedupeBillItems(items) {
      const seen = new Set();
      const result = [];
      items.forEach(item => {
        const key = item.billNo || item.link || item.title;
        if (key && !seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      });
      return result;
    }

    // --- 관심 목록: localStorage 기반 (로그인 불필요) ---
    const BOOKMARK_STORAGE_KEY = 'krPolicyBookmarks';
    function getBookmarks() {
      try {
        const raw = localStorage.getItem(BOOKMARK_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }
    function saveBookmarks(list) {
      try { localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(list)); } catch (err) { /* 저장 공간 부족 등은 무시 */ }
    }
    function bookmarkKey(item) {
      return (item && (item.billNo || item.link || item.title)) || '';
    }
    function isBookmarked(item) {
      if (!item) return false;
      const key = bookmarkKey(item);
      return getBookmarks().some(b => bookmarkKey(b) === key);
    }
    function toggleBookmark(item) {
      if (!item) return;
      const list = getBookmarks();
      const key = bookmarkKey(item);
      const idx = list.findIndex(b => bookmarkKey(b) === key);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.unshift(Object.assign({}, item, { savedAt: new Date().toISOString() }));
      }
      saveBookmarks(list);
    }
    function removeBookmarkAt(i) {
      const list = getBookmarks();
      list.splice(i, 1);
      saveBookmarks(list);
    }
    function clearAllBookmarks() {
      saveBookmarks([]);
    }

    // --- 검색 결과 카드 / 관심 목록 카드 / 상세보기 모달 ---
    function renderSearchCard(item, i) {
      const bookmarked = isBookmarked(item);
      const statusBadge = item.status ? `<span class="pill" style="margin-left:8px;font-size:11px;padding:4px 10px">${escapeSearchHtml(item.status)}</span>` : '';
      const metaParts = [escapeSearchHtml(item.author || '저자 미상')];
      if (item.pubDate) metaParts.push(escapeSearchHtml(item.pubDate));
      else if (item.pubYear) metaParts.push(escapeSearchHtml(item.pubYear));
      if (item.committee) metaParts.push(escapeSearchHtml(item.committee));
      return `
        <div class="post" style="margin-top:10px;cursor:pointer" data-action="open-search-detail" data-idx="${i}">
          <div class="title">${escapeSearchHtml(item.title || '(제목 없음)')}${statusBadge}</div>
          <div class="meta">${metaParts.join(' · ')}</div>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button type="button" class="small-btn" style="padding:6px 10px;font-size:16px;line-height:1" data-action="toggle-save" data-idx="${i}" aria-label="${bookmarked ? '관심 목록에서 제거' : '관심 목록에 저장'}" title="${bookmarked ? '관심 목록에서 제거' : '관심 목록에 저장'}">${bookmarked ? '★' : '☆'}</button>
            ${item.link ? `<a href="${item.link}" target="_blank" rel="noopener" class="small-btn" style="padding:6px 12px;font-size:12px;text-decoration:none;display:inline-block" onclick="event.stopPropagation()">원문 보기 →</a>` : ''}
          </div>
        </div>`;
    }

    function renderBookmarkCard(item, i) {
      const metaParts = [escapeSearchHtml(item.author || '저자 미상')];
      if (item.pubDate) metaParts.push(escapeSearchHtml(item.pubDate));
      return `
        <div class="post" style="margin-top:10px;cursor:pointer" data-action="open-bookmark-detail" data-idx="${i}">
          <div class="title">${escapeSearchHtml(item.title || '(제목 없음)')}</div>
          <div class="meta">${metaParts.join(' · ')}</div>
          <button type="button" class="small-btn" style="margin-top:8px;padding:6px 12px;font-size:12px" data-action="remove-bookmark" data-idx="${i}">삭제</button>
        </div>`;
    }

    function openBillDetail(item) {
      if (!item) return;
      currentDetailItem = item;
      const bookmarked = isBookmarked(item);
      const body = `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div><strong style="color:var(--blue-text)">발의일</strong> · ${escapeSearchHtml(item.pubDate || item.pubYear || '-')}</div>
          <div><strong style="color:var(--blue-text)">제안자</strong> · ${escapeSearchHtml(item.author || '-')}</div>
          <div><strong style="color:var(--blue-text)">소관위원회</strong> · ${escapeSearchHtml(item.committee || '-')}</div>
          <div><strong style="color:var(--blue-text)">처리상태</strong> · ${escapeSearchHtml(item.status || '진행중')}</div>
          <div style="padding:12px;border-radius:10px;background:#f8fafc;color:var(--muted);font-size:13px;line-height:1.6">
            제안이유·주요내용 원문은 열린국회정보 「국회의원 발의법률안」 API에서 별도 제공되지 않아 이 화면에서는 요약할 수 없습니다. 아래 [국회 원문 보기]에서 전체 내용을 확인하실 수 있습니다.
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
            <button type="button" class="small-btn" style="padding:8px 14px;font-size:18px;line-height:1;background:var(--blue-primary);color:#fff;border-color:var(--blue-primary)" data-action="toggle-save-detail" aria-label="${bookmarked ? '관심 목록에서 제거' : '관심 목록에 저장'}" title="${bookmarked ? '관심 목록에서 제거' : '관심 목록에 저장'}">${bookmarked ? '★' : '☆'}</button>
            ${item.link ? `<a href="${item.link}" target="_blank" rel="noopener" class="small-btn" style="text-decoration:none;display:inline-block">국회 원문 보기 →</a>` : ''}
          </div>
        </div>`;
      openModal(item.title || '(제목 없음)', '법안 상세 정보', body, { hideAction: true });
    }

    // 관심 목록은 모달이 아닌 정책용어사전 옆(#bookmarkPanelList)에 상시 노출된다
    function renderBookmarkPanel() {
      const panelEl = document.getElementById('bookmarkPanelList');
      if (!panelEl) return;
      const list = getBookmarks();
      if (!list.length) {
        panelEl.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">저장된 법안이 없습니다. 검색 결과의 ☆ 아이콘을 눌러 추가해보세요.</div>';
        return;
      }
      const rows = list.map((item, i) => renderBookmarkCard(item, i)).join('');
      panelEl.innerHTML = `<div style="max-height:360px;overflow:auto">${rows}</div><div style="margin-top:14px;text-align:right"><button type="button" class="small-btn" data-action="clear-bookmarks">전체 삭제</button></div>`;
    }

    // --- 검색 결과 / 결과 없음 렌더링 ---
    function renderSearchSuccess(original, mediaKeyword, usedKeywords, items) {
      lastSearchItems = items;
      let header = '';
      if (mediaKeyword) {
        header = `<div style="padding:10px 12px;border-radius:10px;background:#eef2ff;margin-bottom:12px;font-size:13px;line-height:1.7">
          <div><strong style="color:var(--blue-text)">언론 키워드:</strong> ${escapeSearchHtml(mediaKeyword)}</div>
          <div><strong style="color:var(--blue-text)">관련 검색어:</strong> ${escapeSearchHtml(usedKeywords.join(', '))}</div>
          <div><strong style="color:var(--blue-text)">검색 결과:</strong> ${items.length}건</div>
        </div>`;
      }
      const rows = items.slice(0, 10).map((item, i) => renderSearchCard(item, i)).join('');
      const title = mediaKeyword
        ? `"${mediaKeyword}" 검색 결과 (${usedKeywords[0]} 관련 법안 기준)`
        : `"${original}"에 대한 검색 결과 ${items.length}건`;
      openModal('국회도서관 검색 결과', title, `${header}<div style="max-height:360px;overflow:auto">${rows}</div>`, { hideAction: true });
    }

    function renderSearchNoResult(original, mappedSuggestions) {
      let list = mappedSuggestions;
      let isFuzzy = false;
      if (!list || !list.length) {
        const closest = findClosestKeywords(original, 3);
        if (closest.length) { list = closest; isFuzzy = true; }
      }
      if (!list || !list.length) list = DEFAULT_SEARCH_SUGGESTIONS;
      const heading = isFuzzy ? '혹시 이 검색어를 찾으셨나요?' : '추천 검색';
      const suggestionHtml = list.map(s =>
        `<button type="button" class="chip" style="cursor:pointer;font:inherit" data-action="search-suggestion" data-keyword="${escapeSearchHtml(s)}">${escapeSearchHtml(s)}</button>`
      ).join('');
      openModal('관련 정책 키워드를 찾지 못했습니다.', `"${original}"에 대한 검색 결과가 없습니다.`, `<div style="margin-top:4px"><div style="font-weight:700;color:var(--blue-text);margin-bottom:10px">${heading}</div><div class="chips">${suggestionHtml}</div></div>`, { hideAction: true });
    }

    // --- 검색 메인 흐름: 1차(원본) -> 2차(언론 키워드 사전 확인) -> 3차(매핑 키워드 순차 검색) -> 4차(통합+중복제거) ---
    async function runNanetSearch(rawQuery) {
      const original = (rawQuery || '').trim();
      if (!original) {
        openModal('검색어를 입력해 주세요', '검색어를 입력하면 관련 법안과 발의자가 표시됩니다.');
        return;
      }
      openModal('국회도서관 검색 중...', `"${original}"에 대한 국회도서관 자료를 불러오는 중입니다.`, '<div style="padding:20px;text-align:center;color:var(--muted)">잠시만 기다려 주세요…</div>', { hideAction: true });
      try {
        // 1차: 원본 검색어로 검색
        let items = dedupeBillItems(await fetchBills(original));
        let mediaKeyword = null;
        let usedKeywords = [];

        if (items.length === 0) {
          // 2차: 언론 키워드 사전 확인
          const mapped = MEDIA_KEYWORD_MAP[original];
          if (mapped && mapped.length) {
            mediaKeyword = original;
            usedKeywords = mapped;
            // 3차: 매핑된 키워드들로 순차 검색 -> 4차: 통합 후 중복 제거
            const resultsByKeyword = await Promise.all(mapped.map(kw => fetchBills(kw).catch(() => [])));
            items = dedupeBillItems(resultsByKeyword.flat());
          }
        }

        if (items.length === 0) {
          const suggestions = MEDIA_KEYWORD_MAP[original] || null;
          renderSearchNoResult(original, suggestions);
          return;
        }

        renderSearchSuccess(original, mediaKeyword, usedKeywords, items);
      } catch (err) {
        openModal('검색 실패', '국회도서관 API 호출에 실패했습니다. 잠시 후 다시 시도해주세요.', `<div style="color:var(--muted);font-size:13px">${escapeSearchHtml(err.message || '')}</div>`, { hideAction: true });
      }
    }
    const searchInputEl = document.getElementById('searchInput');
    const searchAutocompleteEl = document.getElementById('searchAutocomplete');

    function renderAutocomplete(query) {
      if (!searchAutocompleteEl) return;
      const q = (query || '').trim();
      if (!q) { searchAutocompleteEl.innerHTML = ''; searchAutocompleteEl.style.display = 'none'; return; }
      const matches = KNOWN_SEARCH_TERMS.filter(t => t.includes(q)).slice(0, 6);
      if (!matches.length) { searchAutocompleteEl.innerHTML = ''; searchAutocompleteEl.style.display = 'none'; return; }
      searchAutocompleteEl.innerHTML = matches.map(t => {
        const isMediaKeyword = !!MEDIA_KEYWORD_MAP[t];
        return `<div class="search-autocomplete-item" data-action="autocomplete-pick" data-keyword="${escapeSearchHtml(t)}">${escapeSearchHtml(t)}${isMediaKeyword ? '<span class="ac-tag">언론 키워드</span>' : ''}</div>`;
      }).join('');
      searchAutocompleteEl.style.display = 'block';
    }

    if (searchInputEl) {
      searchInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (searchAutocompleteEl) searchAutocompleteEl.style.display = 'none';
          runNanetSearch(searchInputEl.value.trim());
        }
      });
      searchInputEl.addEventListener('input', () => renderAutocomplete(searchInputEl.value));
      searchInputEl.addEventListener('focus', () => renderAutocomplete(searchInputEl.value));
      searchInputEl.addEventListener('blur', () => {
        setTimeout(() => { if (searchAutocompleteEl) searchAutocompleteEl.style.display = 'none'; }, 150);
      });
    }

    // --- 검색/관심목록/용어사전 동적 콘텐츠(모달 + 상시 패널 모두)에 대한 이벤트 위임(document 단위) ---
    document.addEventListener('click', (e) => {
      const acItem = e.target.closest('[data-action="autocomplete-pick"]');
      if (acItem) {
        searchInputEl.value = acItem.dataset.keyword;
        if (searchAutocompleteEl) searchAutocompleteEl.style.display = 'none';
        runNanetSearch(acItem.dataset.keyword);
        return;
      }
      const suggBtn = e.target.closest('[data-action="search-suggestion"]');
      if (suggBtn) {
        runNanetSearch(suggBtn.dataset.keyword);
        return;
      }
      const saveBtn = e.target.closest('[data-action="toggle-save"]');
      if (saveBtn) {
        e.stopPropagation();
        const idx = Number(saveBtn.dataset.idx);
        const item = lastSearchItems[idx];
        toggleBookmark(item);
        const nowSaved = isBookmarked(item);
        saveBtn.textContent = nowSaved ? '★' : '☆';
        saveBtn.title = nowSaved ? '관심 목록에서 제거' : '관심 목록에 저장';
        saveBtn.setAttribute('aria-label', saveBtn.title);
        renderBookmarkPanel();
        return;
      }
      const saveDetailBtn = e.target.closest('[data-action="toggle-save-detail"]');
      if (saveDetailBtn) {
        if (!currentDetailItem) return;
        toggleBookmark(currentDetailItem);
        const nowSaved = isBookmarked(currentDetailItem);
        saveDetailBtn.textContent = nowSaved ? '★' : '☆';
        saveDetailBtn.title = nowSaved ? '관심 목록에서 제거' : '관심 목록에 저장';
        saveDetailBtn.setAttribute('aria-label', saveDetailBtn.title);
        renderBookmarkPanel();
        return;
      }
      const removeBtn = e.target.closest('[data-action="remove-bookmark"]');
      if (removeBtn) {
        e.stopPropagation();
        removeBookmarkAt(Number(removeBtn.dataset.idx));
        renderBookmarkPanel();
        return;
      }
      const clearBtn = e.target.closest('[data-action="clear-bookmarks"]');
      if (clearBtn) {
        clearAllBookmarks();
        renderBookmarkPanel();
        return;
      }
      const bmCard = e.target.closest('[data-action="open-bookmark-detail"]');
      if (bmCard) {
        const idx = Number(bmCard.dataset.idx);
        openBillDetail(getBookmarks()[idx]);
        return;
      }
      const card = e.target.closest('[data-action="open-search-detail"]');
      if (card) {
        const idx = Number(card.dataset.idx);
        openBillDetail(lastSearchItems[idx]);
        return;
      }
      const glossaryDetailBtn = e.target.closest('[data-action="glossary-detail"]');
      if (glossaryDetailBtn) {
        const g = glossaryTerms.find(t => t.term === glossaryDetailBtn.dataset.term);
        if (g) {
          openModal(g.term, '정책 용어 상세', `<div style="color:#475569;line-height:1.7;font-size:14px">${escapeGlossaryHtml(g.desc)}</div><div style="margin-top:16px"><a href="${g.url}" target="_blank" rel="noopener" style="color:var(--blue-primary);font-weight:700;font-size:13px">나비스(NABIS) 원문 보기 →</a></div>`, { hideAction: true });
        }
        return;
      }
    });

    renderBookmarkPanel();

    // --- 모달 유틸리티 ---
    function openModal(title, desc, bodyHTML, opts) {
      modalTitle.textContent = title;
      modalDesc.textContent = desc || '';
      modalBody.innerHTML = bodyHTML || '';
      modalAction.style.display = (opts && opts.hideAction) ? 'none' : '';
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
    }
    function closeModal() {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
    modalCancel.addEventListener('click', closeModal);
    modalAction.addEventListener('click', () => {
      closeModal();
      alert('데모 동작입니다. 실제 서비스는 백엔드 연동이 필요합니다.');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // --- 배너 버튼 이벤트 ---
    function openSignupModal() {
      openModal('회원가입', '이메일로 간단히 가입하여 맞춤 알림을 받아보세요.', `
        <div style="display:flex;flex-direction:column;gap:12px">
          <input placeholder="이메일" style="padding:12px;border-radius:12px;border:1px solid var(--card-border);background:#f8fafc"/>
          <input placeholder="비밀번호" type="password" style="padding:12px;border-radius:12px;border:1px solid var(--card-border);background:#f8fafc"/>
        </div>
      `);
    }
    function openLoginModal() {
      openModal('로그인', '이메일과 비밀번호를 입력해 로그인하세요.', `
        <div style="display:flex;flex-direction:column;gap:12px">
          <input placeholder="이메일" style="padding:12px;border-radius:12px;border:1px solid var(--card-border);background:#f8fafc"/>
          <input placeholder="비밀번호" type="password" style="padding:12px;border-radius:12px;border:1px solid var(--card-border);background:#f8fafc"/>
          <div style="text-align:left;margin-top:4px;font-size:13px;color:var(--muted)">
            계정이 없다면 새로 만드세요! <a href="#" id="gotoSignupLink" style="color:var(--blue-primary);font-weight:700">회원가입</a>
          </div>
        </div>
      `);
      const gotoSignupLink = document.getElementById('gotoSignupLink');
      if (gotoSignupLink) gotoSignupLink.addEventListener('click', (e) => { e.preventDefault(); openSignupModal(); });
    }
    document.getElementById('loginNavBtn').addEventListener('click', openLoginModal);

    document.getElementById('openTrendsModal').addEventListener('click', async () => {
      openModal('전체 최신 동향', '국회에 발의된 법률안을 최신순으로 확인합니다.', '<div style="padding:20px;text-align:center;color:var(--muted)">불러오는 중…</div>', { hideAction: true });
      const data = await fetchLatestBills(10);
      const rows = data.length
        ? data.map(d => `<div style="padding:12px 0;border-bottom:1px solid rgba(0,0,0,0.05)"><strong style="color:var(--blue-text)">${d.link ? `<a href="${d.link}" target="_blank" rel="noopener" style="color:var(--blue-text);text-decoration:none">${d.title}</a>` : d.title}</strong><div style="color:var(--muted);font-size:13px;margin-top:6px">${d.time}</div></div>`).join('')
        : '<div style="color:var(--muted);font-size:13px">최신 법률안을 불러오지 못했습니다.</div>';
      openModal('전체 최신 동향', '국회에 발의된 법률안을 최신순으로 확인합니다.', `<div style="max-height:300px;overflow:auto;padding-right:10px">${rows}</div>`, { hideAction: true });
    });

    document.getElementById('bottomFaqBtn').addEventListener('click', () => {
      openModal('자주 묻는 질문 (FAQ)', '많이 물어보시는 내용을 정리했습니다.', `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div><strong style="color:var(--blue-text)">Q. 정책 검색은 어떤 자료를 기반으로 하나요?</strong><p style="margin:6px 0 0;color:var(--muted);font-size:14px">국회 발의 법률안 데이터를 실시간으로 연동해 보여드립니다.</p></div>
          <div><strong style="color:var(--blue-text)">Q. 무료로 이용할 수 있나요?</strong><p style="margin:6px 0 0;color:var(--muted);font-size:14px">네, Free 계정으로도 국회 법률안 검색을 그대로 이용하실 수 있습니다. 유료 플랜은 심층 정책 분석 보고서, 열람 가능 자료 범위 확대, 해외 정책 열람 기능 등이 추가로 해금되는 옵션입니다.</p></div>
          <div><strong style="color:var(--blue-text)">Q. 문의는 어떻게 하나요?</strong><p style="margin:6px 0 0;color:var(--muted);font-size:14px">고객센터(paperplane@jnu.ac.kr)로 이메일 보내주시면 답변드립니다.</p></div>
        </div>
      `, { hideAction: true });
    });

    // --- 정책 용어사전 (출처: 나비스 NABIS 정책용어사전, nabis.go.kr) ---
    const glossaryTerms = [
      { term: '경제자유구역', desc: '외국인투자기업의 경영환경과 외국인의 생활여건을 개선하여 외국인투자를 촉진하고 지역 간 균형발전을 도모하기 위해 지정·운영되는 경제특구다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=12' },
      { term: '광역경제권', desc: '지역 간 연계 및 협력을 통해 지역경쟁력을 효율적으로 향상시키기 위해 기존 경제·산업권과 역사·문화적 동질성을 고려해 설정한 권역이다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=16' },
      { term: '균형발전지표', desc: '지역의 발전 수준을 객관적·주관적으로 종합 진단하기 위해 개발된 지표로, 핵심지표(인구증감률, 재정자립도)와 8개 부문의 객관·주관 지표로 구성된다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=344' },
      { term: '균형발전특별법', desc: '지역 특성에 맞는 발전과 지역 간 연계·협력 증진을 통해 지역경쟁력을 높이고 삶의 질을 향상시켜 균형 있는 발전에 이바지하고자 2004년 제정된 법률이다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=31' },
      { term: '균형발전특별회계', desc: '지역별 특화발전과 지역주민의 삶의 질 향상을 위한 사업을 효율적으로 추진하기 위해 설치된 회계로, 경제발전·생활기반 등 계정으로 구성된다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=30' },
      { term: '규제자유특구(규제프리존)', desc: '지역별 신산업 육성을 위해 규제샌드박스 등 규제특례와 지자체·정부 투자계획을 담은 특구계획에 따라 비수도권 지역에 지정된 구역이다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=335' },
      { term: '그린뉴딜', desc: '그린(Green)과 뉴딜(New Deal)의 합성어로, 저탄소 경제구조로 전환하며 기후위기에 대응하고 재생에너지·친환경산업 투자로 일자리를 창출하는 정책이다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=371' },
      { term: '도시재생뉴딜', desc: '인구감소·산업쇠퇴 등으로 쇠퇴한 도시를 지역역량 강화와 새로운 기능 도입을 통해 활성화시키는 도시재생사업에 재정을 집중 투입하는 사업이다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=336' },
      { term: '스마트시티(Smart City)', desc: '건설·정보통신기술을 융복합한 도시기반시설을 바탕으로 다양한 도시서비스를 실시간으로 제공하는 지속가능한 도시를 말한다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=322' },
      { term: '사회적기업', desc: '취약계층에게 일자리·사회서비스를 제공하거나 지역사회에 공헌하는 등 사회적 목적을 우선 추구하면서 영업활동을 수행하는 기업 및 조직을 말한다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=77' },
      { term: '협동조합', desc: '공동으로 소유하고 민주적으로 운영되는 사업체를 통해 공동의 경제적·사회적·문화적 필요와 욕구를 충족시키기 위해 자발적으로 모인 사람들의 자율적 단체다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=95' },
      { term: '재정자립도', desc: '재정수입의 자체 충당능력을 나타내는 세입분석지표로, 일반회계 세입 중 지방세와 세외수입의 비율로 측정하며 비율이 높을수록 세입징수 기반이 좋음을 의미한다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=105' },
      { term: '지방소비세 제도', desc: '지방재정의 자주재원 확충을 위해 국세인 부가가치세의 일부를 지방세로 전환한 제도로, 2010년부터 도입되었다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=213' },
      { term: '자치경찰제도', desc: '지역적 특수성에 부합하고 지역주민의 수요에 부응하기 위해 국가경찰과 별도로 지방자치단체가 담당하는 경찰 사무를 운영하는 제도다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=254' },
      { term: '젠트리피케이션', desc: '중산층 이상의 계층이 낙후된 도심 지역으로 유입되면서 지역이 고급화되고, 이로 인한 임대료 상승으로 기존 저소득층 주민이 밀려나는 현상을 말한다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=280' },
      { term: '고향납세', desc: '자신이 거주하는 지역 이외의 지방자치단체에 기부하면 세액공제 혜택을 주는 제도로, 일본에서 시작되어 국내 고향사랑기부제 논의의 모태가 되었다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=292' },
      { term: '지역화폐', desc: '국가의 공식화폐와 달리 특정 지역 내에서만 통용되는 화폐로, 법정화폐를 대체하는 것이 아니라 보완하며 지역 내 자원 순환과 경제 활성화를 목적으로 한다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=318' },
      { term: '혁신도시 시즌 2', desc: '수도권 공공기관 지방이전 중심이던 혁신도시 정책을 지역성장 거점으로 육성하기 위해 특화발전과 정주여건 개선, 상생발전에 중점을 두고 추진하는 후속 정책이다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=332' },
      { term: 'MZ세대', desc: '1980년대 초~2000년대 초 출생한 밀레니얼 세대와 1990년대 중반~2000년대 초반 출생한 Z세대를 통칭하는 말로, 디지털 환경에 익숙한 특징을 보인다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=357' },
      { term: '관계인구', desc: '실제로 거주하지 않지만 지역에 다양하게 참여하며 관계를 맺는 사람들을 뜻하며, 인구소멸시대의 새로운 지역 활성화 대안으로 제시된 개념이다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=367' },
      { term: '마이스(MICE)산업', desc: '회의(Meeting)·포상관광(Incentive)·컨벤션(Convention)·전시(Exhibition)를 아우르는 산업으로, 높은 부가가치를 창출하는 미래 성장동력산업으로 육성되고 있다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=201' },
      { term: '창조경제', desc: '국민의 상상력과 창의성을 과학기술과 ICT에 접목해 새로운 산업과 시장을 창출하고 기존 산업을 강화함으로써 좋은 일자리를 만드는 경제 전략이다.', url: 'https://www.nabis.go.kr/termsDetailView.do?menucd=189&gbnCode=S51&eventNo=178' }
    ];
    function escapeGlossaryHtml(value) { return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
    const glossaryFeaturedTerms = ['경제자유구역', '지역화폐'];
    const glossaryListEl = document.getElementById('glossaryList');
    const glossarySearchEl = document.getElementById('glossarySearch');
    const glossaryShowAllBtn = document.getElementById('glossaryShowAllBtn');
    let glossaryExpanded = false;

    function truncateGlossaryText(text, maxLen) {
      if (!text) return '';
      return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
    }

    function glossaryRow(g) {
      const shortDesc = truncateGlossaryText(g.desc, 55);
      const needsMore = g.desc && g.desc.length > 55;
      return `
        <div class="post" style="margin-top:10px">
          <div class="title">${escapeGlossaryHtml(g.term)}</div>
          <div class="meta" style="color:#475569;margin-top:6px;line-height:1.6">${escapeGlossaryHtml(shortDesc)}</div>
          ${needsMore ? `<button type="button" class="small-btn" style="margin-top:8px;padding:6px 12px;font-size:12px" data-action="glossary-detail" data-term="${escapeGlossaryHtml(g.term)}">자세히 보기</button>` : ''}
        </div>`;
    }

    function updateGlossaryToggleLabel() {
      if (glossaryShowAllBtn) {
        glossaryShowAllBtn.textContent = glossaryExpanded ? '접기' : '전체 보기';
      }
    }

    function renderGlossaryCompact() {
      glossaryExpanded = false;
      const featured = glossaryFeaturedTerms
        .map(name => glossaryTerms.find(g => g.term === name))
        .filter(Boolean);
      glossaryListEl.innerHTML = featured.map(g => glossaryRow(g)).join('');
      updateGlossaryToggleLabel();
    }

    function renderGlossaryFull(filterText) {
      glossaryExpanded = true;
      const kw = (filterText || '').trim().toLowerCase();
      const filtered = kw
        ? glossaryTerms.filter(g => g.term.toLowerCase().includes(kw) || g.desc.toLowerCase().includes(kw))
        : glossaryTerms;
      if (filtered.length === 0) {
        glossaryListEl.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:10px 0">일치하는 용어가 없습니다.</div>';
      } else {
        glossaryListEl.innerHTML = filtered.map(g => glossaryRow(g)).join('');
      }
      updateGlossaryToggleLabel();
    }

    if (glossaryListEl) {
      renderGlossaryCompact();
      if (glossarySearchEl) {
        glossarySearchEl.addEventListener('input', () => {
          const value = glossarySearchEl.value;
          if (!value.trim()) { renderGlossaryCompact(); return; }
          renderGlossaryFull(value);
        });
      }
      if (glossaryShowAllBtn) {
        glossaryShowAllBtn.addEventListener('click', () => {
          if (glossaryExpanded) {
            renderGlossaryCompact();
          } else {
            renderGlossaryFull(glossarySearchEl ? glossarySearchEl.value : '');
          }
        });
      }
    }

        document.getElementById('subscribeBtn').addEventListener('click', () => {
      openModal('월정액 요금제 안내', '무료 계정으로도 정책 검색을 자유롭게 이용하실 수 있습니다. 결제 시 심층 정책 분석과 해외 정책 열람까지 더 넓은 범위의 데이터가 해금됩니다.', `
        <div style="display:flex;flex-direction:column;gap:12px">
          <div style="padding:14px;border-radius:14px;border:1px solid var(--card-border);background:#f8fafc">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong style="color:var(--blue-text);font-size:15px">Free (기본 무료)</strong>
              <span style="font-size:12px;color:var(--muted);font-weight:700">0원</span>
            </div>
            <div style="margin-top:6px;color:#475569;font-size:13px;line-height:1.5">
              · 국회 발의 법률안 검색 기능 그대로 이용 가능<br>
              · 실시간 의안 동향 파악 및 정책 타자 체험
            </div>
          </div>

          <div style="padding:14px;border-radius:14px;border:2px solid var(--blue-primary);background:#f0f6ff">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong style="color:var(--blue-primary);font-size:15px">Plus (정책 심층 분석)</strong>
              <span style="font-size:13px;color:var(--blue-primary);font-weight:800">월 4,900원</span>
            </div>
            <div style="margin-top:6px;color:#1e3a8a;font-size:13px;line-height:1.5">
              · Free의 모든 검색 기능 포함<br>
              · <strong>열람 가능한 정책 자료 및 분석 범위 대폭 확대</strong><br>
              · 법안별 핵심 쟁점 심층 분석 리포트 & 맞춤 알림
            </div>
          </div>

          <div style="padding:14px;border-radius:14px;border:1px solid #c084fc;background:#faf5ff">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <strong style="color:#7e22ce;font-size:15px">Pro (글로벌 정책 & 전문가)</strong>
              <span style="font-size:13px;color:#7e22ce;font-weight:800">월 19,000원</span>
            </div>
            <div style="margin-top:6px;color:#581c87;font-size:13px;line-height:1.5">
              · Plus의 모든 심층 분석 기능 포함<br>
              · <strong>해외 주요국 정책 및 입법 동향 자료 열람 기능 해금</strong><br>
              · 다국가 정책 비교 데이터 제공 & API 연동 지원
            </div>
          </div>
        </div>
      `);
    });

    // --- 정책 궤도형 타자 체험 (주제 선택 가능) ---
    const typingTopics = {
      yellowEnvelope: {
        label: '노란봉투법',
        title: '노란봉투법, 짧게 나눠 입력해보세요',
        lede: '긴 설명을 3개의 짧은 문장으로 나눴습니다. 각 문장을 입력하고 확인하면 다음 문장으로 빠르게 넘어갑니다.',
        sentences: [
          '노란봉투법은 노동조합의 쟁의행위로 발생한 손해배상 청구를 제한하는 법안이다.',
          '하청 노동자의 교섭권을 넓히는 내용도 주요하게 담고 있다.',
          '노동자의 권리와 기업의 책임 범위를 함께 생각해볼 수 있다.'
        ]
      },
      supplementaryInvestigation: {
        label: '보완수사권',
        title: '보완수사권, 짧게 나눠 입력해보세요',
        lede: '검찰과 경찰의 수사 권한 조정을 둘러싼 정책 설명을 3개의 짧은 문장으로 나눴습니다.',
        sentences: [
          '보완수사권은 경찰이 송치한 사건을 검찰이 다시 수사할 수 있는 권한이다.',
          '수사 절차의 견제와 균형을 위해 필요하다는 주장이 있다.',
          '검찰과 경찰 간 권한 배분을 둘러싼 논쟁이 계속되고 있다.'
        ]
      }
    };
    let currentTopicKey = null;
    let typingSentences = [];
    let typingRoundIndex = 0, typingStartedAt = null, typingTotalChars = 0, typingTotalSeconds = 0;
    const typingAnswers = [];
    const typingAchievedA = {};
    const typingTargetEl = document.getElementById('typingTarget');
    const typingInput = document.getElementById('typingInput');
    const typingRound = document.getElementById('typingRound');
    const typingTimer = document.getElementById('typingTimer');
    const typingResult = document.getElementById('typingResult');
    const orbitDots = [...document.querySelectorAll('.typing-orbit-dot')];
    function escapeTypingHtml(value) { return value.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
    function renderTarget(sentence) {
      typingTargetEl.style.color = '';
      typingTargetEl.style.textAlign = '';
      typingTargetEl.style.fontFamily = '';
      typingTargetEl.innerHTML = [...sentence].map((ch, i) => `<span class="char" data-idx="${i}">${escapeTypingHtml(ch)}</span>`).join('');
    }
    function paintChars() {
      if (!currentTopicKey || !typingSentences[typingRoundIndex]) return;
      const target = typingSentences[typingRoundIndex];
      const value = typingInput.value;
      const spans = typingTargetEl.querySelectorAll('.char');
      spans.forEach((span, i) => {
        span.classList.remove('correct', 'wrong', 'current');
        if (i < value.length) span.classList.add(value[i] === target[i] ? 'correct' : 'wrong');
        else if (i === value.length) span.classList.add('current');
      });
    }
    function updateTypingFast() {
      if (!currentTopicKey) return;
      if (!typingStartedAt && typingInput.value) typingStartedAt = performance.now();
      const elapsed = typingStartedAt ? (performance.now() - typingStartedAt) / 1000 : 0;
      typingTimer.textContent = `시간 ${elapsed.toFixed(1)}초`;
      paintChars();
    }
    function refreshOrbit() {
      orbitDots.forEach((dot, i) => {
        if (!currentTopicKey) {
          dot.classList.remove('active', 'done');
        } else {
          dot.classList.toggle('active', i === typingRoundIndex);
          dot.classList.toggle('done', i < typingRoundIndex);
        }
      });
    }
    function finishTyping() {
      if (!currentTopicKey || !typingSentences[typingRoundIndex]) return;
      const target = typingSentences[typingRoundIndex], value = typingInput.value;
      const elapsed = typingStartedAt ? (performance.now() - typingStartedAt) / 1000 : 0;
      typingAnswers.push({ target, value, elapsed });
      typingTotalChars += value.length; typingTotalSeconds += elapsed; typingRoundIndex++;
      if (typingRoundIndex < typingSentences.length) {
        typingInput.value = ''; typingStartedAt = null;
        typingRound.textContent = `${typingRoundIndex + 1} / ${typingSentences.length}`;
        renderTarget(typingSentences[typingRoundIndex]);
        typingResult.classList.remove('show'); refreshOrbit(); updateTypingFast(); typingInput.focus();
      } else {
        const average = typingTotalSeconds ? Math.round(typingTotalChars / typingTotalSeconds * 60) : 0;
        const wrongChars = typingAnswers.reduce((sum, item) => {
          let wrong = Math.abs(item.value.length - item.target.length);
          for (let j = 0; j < Math.min(item.value.length, item.target.length); j++) if (item.value[j] !== item.target[j]) wrong++;
          return sum + wrong;
        }, 0);
        const isFail = average < 50;
        const grade = isFail ? null : (wrongChars <= 3 && average >= 200 ? 'A' : (wrongChars <= 7 && average >= 150 ? 'B' : 'C'));
        const gradeMessage = isFail
          ? '타자 속도가 너무 느려요. 다시 도전해보세요!'
          : (grade === 'A' ? '정확하고 빠른 정책 입력' : (grade === 'B' ? '안정적인 정책 입력' : '조금 더 연습해보세요'));
        typingInput.disabled = true; typingRound.textContent = '완료'; refreshOrbit();
        typingResult.classList.add('show');
        typingResult.classList.toggle('fail', isFail);
        const scoreHtml = isFail
          ? `<div class="typing-score fail"><strong>실패</strong><span>${gradeMessage}</span></div>`
          : `<div class="typing-score"><strong>${grade}</strong><span>${gradeMessage}</span></div>`;
        typingResult.innerHTML = `<strong>정책 타자 체험 완료!</strong>${scoreHtml}<div style="font-size:14px;line-height:1.7;color:var(--blue-text);margin-top:8px">총 입력 글자 수 <strong>${typingTotalChars}자</strong> · 틀린 타자 수 <strong>${wrongChars}자</strong><br>총 소요 시간 <strong>${typingTotalSeconds.toFixed(1)}초</strong> · 평균 타자 <strong>${average}자/분</strong></div>`;
        document.getElementById('typingReset').style.display = 'inline-block';
        if (grade === 'A' && currentTopicKey) {
          typingAchievedA[currentTopicKey] = true;
          const achievedBtn = document.querySelector(`.typing-topic-btn[data-topic="${currentTopicKey}"]`);
          if (achievedBtn) achievedBtn.classList.add('achieved-a');
        }
      }
    }
    function selectTopic(topicKey) {
      currentTopicKey = topicKey;
      const topic = typingTopics[topicKey];
      typingSentences = topic.sentences;
      typingRoundIndex = 0; typingStartedAt = null; typingTotalChars = 0; typingTotalSeconds = 0;
      typingAnswers.length = 0;
      document.getElementById('typing-title').textContent = topic.label;
      document.getElementById('typingPlayArea').classList.add('active');
      document.querySelectorAll('.typing-topic-btn').forEach(btn => {
        const isActive = btn.dataset.topic === topicKey;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      typingInput.value = ''; typingInput.disabled = false;
      typingInput.placeholder = '정책 문장을 입력하고 Enter를 누르세요.';
      document.getElementById('typingReset').style.display = 'none';
      typingRound.textContent = `1 / ${typingSentences.length}`;
      typingTimer.textContent = '시간 0.0초';
      renderTarget(typingSentences[typingRoundIndex]);
      typingResult.classList.remove('show'); typingResult.innerHTML = '';
      refreshOrbit(); updateTypingFast(); typingInput.focus();
    }
    document.getElementById('topicYellowEnvelope').addEventListener('click', () => selectTopic('yellowEnvelope'));
    document.getElementById('topicSupplementaryInvestigation').addEventListener('click', () => selectTopic('supplementaryInvestigation'));

    typingInput.addEventListener('input', updateTypingFast);
    typingInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); finishTyping(); } });
    document.getElementById('typingReset').addEventListener('click', () => {
      if (currentTopicKey) selectTopic(currentTopicKey);
    });
