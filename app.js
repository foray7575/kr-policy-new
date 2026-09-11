const features = Array.from(document.querySelectorAll('.feature'));
    const trendList = document.getElementById('trendList');
    const trendsContent = document.getElementById('trendsContent');
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

    async function renderTrendsInline() {
      trendsContent.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:8px 0">최신 법률안을 불러오는 중...</div>';
      const data = await fetchLatestBills(3);
      renderTrendItems(trendsContent, data, { side: false });
    }

    renderTrendsToSide();
    renderTrendsInline();

    document.getElementById('refreshTrends').addEventListener('click', () => {
      const btn = document.getElementById('refreshTrends');
      btn.textContent = '갱신 중...';
      renderTrendsToSide().then(() => { btn.textContent = '새로고침'; });
    });
    document.getElementById('refreshInline').addEventListener('click', () => {
      renderTrendsInline();
    });

    // --- 검색: 국회도서관 Open API 연동 ---
    function escapeSearchHtml(value) {
      return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    }
    async function runNanetSearch(query) {
      openModal('국회도서관 검색 중...', `"${query}"에 대한 국회도서관 자료를 불러오는 중입니다.`, '<div style="padding:20px;text-align:center;color:var(--muted)">잠시만 기다려 주세요…</div>', { hideAction: true });
      try {
        const res = await fetch(`/api/nanet-search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        if (items.length === 0) {
          openModal('검색 결과 없음', `"${query}"에 대한 국회도서관 검색 결과가 없습니다.`, '', { hideAction: true });
          return;
        }
        const rows = items.slice(0, 10).map(item => {
          const metaParts = [escapeSearchHtml(item.author || '저자 미상')];
          if (item.pubDate) metaParts.push(escapeSearchHtml(item.pubDate));
          else if (item.pubYear) metaParts.push(escapeSearchHtml(item.pubYear));
          if (item.committee) metaParts.push(escapeSearchHtml(item.committee));
          const statusBadge = item.status ? `<span class="pill" style="margin-left:8px;font-size:11px;padding:4px 10px">${escapeSearchHtml(item.status)}</span>` : '';
          return `
          <div class="post" style="margin-top:10px">
            <div class="title">${escapeSearchHtml(item.title || '(제목 없음)')}${statusBadge}</div>
            <div class="meta">${metaParts.join(' · ')}</div>
            ${item.link ? `<div style="margin-top:8px"><a href="${item.link}" target="_blank" rel="noopener" style="color:var(--blue-primary);font-weight:700">원문/상세 보기 →</a></div>` : ''}
          </div>`;
        }).join('');
        openModal('국회도서관 검색 결과', `"${query}"에 대한 검색 결과 ${items.length}건`, `<div style="max-height:360px;overflow:auto">${rows}</div>`, { hideAction: true });
      } catch (err) {
        openModal('검색 실패', '국회도서관 API 호출에 실패했습니다. 잠시 후 다시 시도해주세요.', `<div style="color:var(--muted);font-size:13px">${escapeSearchHtml(err.message || '')}</div>`, { hideAction: true });
      }
    }
    document.getElementById('searchBtn').addEventListener('click', () => {
      const q = document.getElementById('searchInput').value.trim();
      if (!q) {
        openModal('검색어를 입력해 주세요', '검색어를 입력하면 관련 법안과 발의자가 표시됩니다.');
        return;
      }
      runNanetSearch(q);
    });
    document.getElementById('searchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('searchBtn').click();
      }
    });

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

    // --- 커뮤니티 / 게시판 ---
    document.getElementById('openCommunity').addEventListener('click', () => {
      openModal('게시판으로 이동', '다른 사용자들의 토론과 자료를 확인하고 작성할 수 있습니다.', `
        <div style="display:flex;gap:10px;flex-direction:column">
          <div class="post"><div class="title">[토론] 교육개혁의 방향</div><div class="meta">작성자: 시험 · 2026-06-07</div></div>
          <div style="margin-top:10px"><button class="small-btn" onclick="alert('게시판 전체보기')">전체 게시판 보기</button></div>
        </div>
      `);
    });

    document.getElementById('openNewPost').addEventListener('click', () => {
      openModal('새 글 작성', '본문을 입력하고 제출하면 샘플 게시물이 추가됩니다.', `
        <div style="display:flex;flex-direction:column;gap:12px">
          <input id="postTitle" placeholder="제목 입력" style="padding:12px;border-radius:12px;border:1px solid var(--card-border);background:#f8fafc"/>
          <textarea id="postBody" placeholder="내용 입력 (데모)" style="padding:12px;border-radius:12px;border:1px solid var(--card-border);min-height:120px;background:#f8fafc"></textarea>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button class="small-btn" onclick="submitDemoPost()">게시하기</button>
          </div>
        </div>
      `);
      modalAction.style.display = 'none';
    });

    function submitDemoPost() {
      const title = document.getElementById('postTitle').value.trim() || '제목 없음';
      const body = document.getElementById('postBody').value.trim() || '';
      const postsArea = document.getElementById('postsArea');
      const el = document.createElement('div');
      el.className = 'post';
      el.innerHTML = `<div class="title">${title}</div><div class="meta">작성자: 나 · 지금</div><div style="margin-top:10px;color:var(--muted);font-size:14px;line-height:1.6">${body}</div>`;
      postsArea.insertBefore(el, postsArea.firstChild);
      closeModal();
      modalAction.style.display = '';
    }

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
    document.getElementById('startBannerBtn').addEventListener('click', () => {
      openModal('무료 시작', '지금 바로 무료 계정으로 핵심 기능을 이용해보세요.');
    });

    document.getElementById('openSubscribe').addEventListener('click', () => {
      openModal('구독 플랜 선택', '기본 검색은 무료 계정으로 이용하실 수 있습니다. 유료 구독 시 심층 분석과 해외 정책 열람 기능이 해금됩니다.', `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;gap:10px">
            <button class="small-btn" style="flex:1;background:var(--blue-primary);color:#fff;border-color:var(--blue-primary);padding:10px" onclick="alert('Plus 플랜: 정책 심층 분석 및 열람 자료 범위 확대 (월 4,900원)')">Plus (월 4,900원) — 심층 분석</button>
            <button class="small-btn" style="flex:1;background:#7e22ce;color:#fff;border-color:#7e22ce;padding:10px" onclick="alert('Pro 플랜: 해외 정책 자료 열람 해금 & API 지원 (월 19,000원)')">Pro (월 19,000원) — 해외 정책</button>
          </div>
          <div style="font-size:12px;color:var(--muted);text-align:center;margin-top:4px">
            자세한 혜택 비교는 하단의 [월정액 요금제 보기]에서 확인하실 수 있습니다.
          </div>
        </div>
      `);
    });

    document.getElementById('openTrendsModal').addEventListener('click', async () => {
      openModal('전체 최신 동향', '국회에 발의된 법률안을 최신순으로 확인합니다.', '<div style="padding:20px;text-align:center;color:var(--muted)">불러오는 중…</div>', { hideAction: true });
      const data = await fetchLatestBills(10);
      const rows = data.length
        ? data.map(d => `<div style="padding:12px 0;border-bottom:1px solid rgba(0,0,0,0.05)"><strong style="color:var(--blue-text)">${d.link ? `<a href="${d.link}" target="_blank" rel="noopener" style="color:var(--blue-text);text-decoration:none">${d.title}</a>` : d.title}</strong><div style="color:var(--muted);font-size:13px;margin-top:6px">${d.time}</div></div>`).join('')
        : '<div style="color:var(--muted);font-size:13px">최신 법률안을 불러오지 못했습니다.</div>';
      openModal('전체 최신 동향', '국회에 발의된 법률안을 최신순으로 확인합니다.', `<div style="max-height:300px;overflow:auto;padding-right:10px">${rows}</div>`, { hideAction: true });
    });

    document.getElementById('openCommunityFull').addEventListener('click', () => {
      openModal('게시판 전체', '활성화된 게시글을 시간순으로 확인하고 참여할 수 있습니다.');
    });

    document.getElementById('bottomFaqBtn').addEventListener('click', () => {
      openModal('자주 묻는 질문 (FAQ)', '많이 물어보시는 내용을 정리했습니다.', `
        <div style="display:flex;flex-direction:column;gap:14px">
          <div><strong style="color:var(--blue-text)">Q. 정책 검색은 어떤 자료를 기반으로 하나요?</strong><p style="margin:6px 0 0;color:var(--muted);font-size:14px">국회 발의 법률안 데이터를 실시간으로 연동해 보여드립니다.</p></div>
          <div><strong style="color:var(--blue-text)">Q. 무료로 이용할 수 있나요?</strong><p style="margin:6px 0 0;color:var(--muted);font-size:14px">네, Free 계정으로도 국회 법률안 검색을 그대로 이용하실 수 있습니다. 유료 플랜은 심층 정책 분석 보고서, 열람 가능 자료 범위 확대, 해외 정책 열람 기능 등이 추가로 해금되는 옵션입니다.</p></div>
          <div><strong style="color:var(--blue-text)">Q. 문의는 어떻게 하나요?</strong><p style="margin:6px 0 0;color:var(--muted);font-size:14px">고객센터(paperplane@jnu.ac.kr)로 이메일 보내주시면 답변드립니다.</p></div>
        </div>
      `);
    });

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

    // 기타 기능 버튼들
    document.getElementById('demoAddAlert').addEventListener('click', () => {
      alert('알림 설정을 완료했습니다.');
    });
    document.getElementById('demoExport').addEventListener('click', () => {
      alert('데이터를 CSV 형식으로 내보냅니다.');
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
        const grade = wrongChars <= 3 && average >= 250 ? 'A' : (wrongChars <= 7 && average >= 150 ? 'B' : 'C');
        const gradeMessage = grade === 'A' ? '정확하고 빠른 정책 입력' : (grade === 'B' ? '안정적인 정책 입력' : '조금 더 연습해보세요');
        typingInput.disabled = true; typingRound.textContent = '완료'; refreshOrbit();
        typingResult.classList.add('show');
        typingResult.innerHTML = `<strong>정책 타자 체험 완료!</strong><div class="typing-score"><strong>${grade}</strong><span>${gradeMessage}</span></div><div style="font-size:14px;line-height:1.7;color:var(--blue-text);margin-top:8px">총 입력 글자 수 <strong>${typingTotalChars}자</strong> · 틀린 타자 수 <strong>${wrongChars}자</strong><br>총 소요 시간 <strong>${typingTotalSeconds.toFixed(1)}초</strong> · 평균 타자 <strong>${average}자/분</strong></div>`;
        document.getElementById('typingReset').style.display = 'inline-block';
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