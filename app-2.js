    // --- 정책 궤도형 타자 체험 (주제 선택 가능) ---
    // 타자 문장 출처: 나비스(NABIS) 정책용어사전 정의문 (glossaryTerms와 동일 데이터, 원문 그대로 사용)
    const typingTopicGroups = [
      { key: 'balancedDevelopment', label: '지역균형발전', terms: ['균형발전특별법', '균형발전지표', '균형발전특별회계'] },
      { key: 'regionalEconomy', label: '지역경제 성장', terms: ['경제자유구역', '광역경제권', '규제자유특구(규제프리존)'] },
      { key: 'regionalFinance', label: '지역 재정', terms: ['재정자립도', '지방소비세 제도', '고향납세'] },
      { key: 'localCurrency', label: '지역화폐와 협동', terms: ['지역화폐', '사회적기업', '협동조합'] },
      { key: 'urbanRegeneration', label: '도시 재생', terms: ['도시재생뉴딜', '젠트리피케이션', '혁신도시 시즌 2'] },
      { key: 'futureTransition', label: '미래 산업 전환', terms: ['그린뉴딜', '스마트시티(Smart City)', '창조경제'] },
      { key: 'regionalPeople', label: '지역 인재·행정', terms: ['관계인구', 'MZ세대', '마이스(MICE)산업', '자치경찰제도'] }
    ];
    const typingTopics = {};
    typingTopicGroups.forEach(group => {
      const sentences = group.terms
        .map(name => glossaryTerms.find(g => g.term === name))
        .filter(Boolean)
        .map(g => g.desc);
      typingTopics[group.key] = {
        label: group.label,
        sentences,
        terms: group.terms
      };
    });
    function renderTypingTopicButtons() {
      const picker = document.getElementById('typingTopicPicker');
      if (!picker) return;
      picker.innerHTML = typingTopicGroups.map(group =>
        `<button type="button" class="typing-topic-btn" data-topic="${group.key}" aria-pressed="false">${escapeGlossaryHtml(group.label)}</button>`
      ).join('');
      picker.querySelectorAll('.typing-topic-btn').forEach(btn => {
        btn.addEventListener('click', () => selectTopic(btn.dataset.topic));
      });
    }
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
      document.getElementById('typing-title').textContent = `${topic.label} · 나비스 정책용어 입력`;
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
    renderTypingTopicButtons();

    typingInput.addEventListener('input', updateTypingFast);
    typingInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); finishTyping(); } });
    document.getElementById('typingReset').addEventListener('click', () => {
      if (currentTopicKey) selectTopic(currentTopicKey);
    });

    // ===== 분야별 정책 찾기 (제목 키워드 기준 자동 분류) =====
    const POLICY_CATEGORIES = [
      { key: 'edu', label: '교육', keywords: ['교육','학교','학생','대학','장학','훈련','학습','교원','유아','평생','직업','학위'] },
      { key: 'soc', label: '사회', keywords: ['복지','노인','장애','아동','주거','의료','연금','고용','청년','돌봄','안전','보건','임산부','기초생활','생활','가족','출산','사회','세대','근로'] },
      { key: 'sci', label: '과학', keywords: ['과학','기술','연구','R&D','반도체','인공지능','AI','우주','데이터','디지털','정보통신','바이오','로봇','ICT','연구개발'] },
      { key: 'dip', label: '외교', keywords: ['외교','통상','국제','해외','재외','협정','조약','무역','FTA','원조','동맹','수출','동포'] },
      { key: 'cul', label: '문화', keywords: ['문화','예술','관광','체육','콘텐츠','방송','영화','전통','도서','공연','저작권','미디어','스포츠','언론'] }
    ];
    function classifyPolicyTitle(title) {
      const t = (title || '').toUpperCase();
      let best = null, bestScore = 0;
      POLICY_CATEGORIES.forEach(cat => {
        const score = cat.keywords.reduce((sum, kw) => sum + (t.includes(kw.toUpperCase()) ? 1 : 0), 0);
        if (score > bestScore) { best = cat.key; bestScore = score; }
      });
      return best;
    }
    let policyBillsByCat = null;
    let currentPolicyCat = POLICY_CATEGORIES[0].key;
    function escapeCatHtml(v) { return String(v || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

    async function loadPolicyBills() {
      const listEl = document.getElementById('catList');
      if (!listEl) return;
      listEl.innerHTML = '<div style="color:var(--muted);font-size:14px;padding:8px 0">법률안을 불러오는 중…</div>';
      try {
        const res = await fetch('/api/nanet-search?latest=1&pSize=1000');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data.items) ? data.items : [];
        policyBillsByCat = {};
        POLICY_CATEGORIES.forEach(c => policyBillsByCat[c.key] = []);
        let unclassified = 0;
        items.forEach(it => {
          const k = classifyPolicyTitle(it.title);
          if (k) policyBillsByCat[k].push(it); else unclassified++;
        });
        document.getElementById('catSnapCount').textContent = items.length.toLocaleString('ko-KR');
        document.getElementById('catUnclassCount').textContent = unclassified.toLocaleString('ko-KR');
      } catch (err) {
        policyBillsByCat = null;
      }
      renderPolicyTabs();
      renderPolicyCategory();
    }

    function renderPolicyTabs() {
      const wrap = document.getElementById('catTabs');
      if (!wrap) return;
      wrap.innerHTML = POLICY_CATEGORIES.map(c => {
        const count = policyBillsByCat ? policyBillsByCat[c.key].length : 0;
        return `<button type="button" class="typing-topic-btn ${c.key === currentPolicyCat ? 'active' : ''}" data-cat="${c.key}" aria-pressed="${c.key === currentPolicyCat}">${c.label}<span class="cat-tab-count">${count}</span></button>`;
      }).join('');
      wrap.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
        currentPolicyCat = btn.dataset.cat;
        renderPolicyTabs();
        renderPolicyCategory();
      }));
    }

    function renderPolicyCategory() {
      const cat = POLICY_CATEGORIES.find(c => c.key === currentPolicyCat);
      const kwEl = document.getElementById('catKeywords');
      const listEl = document.getElementById('catList');
      if (!cat || !kwEl || !listEl) return;
      kwEl.innerHTML = '<strong style="font-size:13px;color:var(--blue-text);margin-right:4px">분류 키워드</strong>' +
        cat.keywords.map(k => `<span>${escapeCatHtml(k)}</span>`).join('');
      if (!policyBillsByCat) {
        listEl.innerHTML = '<div style="color:var(--muted);font-size:14px">법률안 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';
        return;
      }
      const all = policyBillsByCat[cat.key];
      const list = all.slice(0, 8);
      listEl.innerHTML = list.length
        ? `<div style="font-size:13px;color:var(--muted);margin-bottom:6px">${cat.label} 분야 법률안 ${all.length}건 중 최신 ${list.length}건</div>` +
          list.map(b => `<div class="bill-row"><a href="${escapeCatHtml(b.link)}" target="_blank" rel="noopener">${escapeCatHtml(b.title)}</a><div class="meta">${escapeCatHtml(b.pubDate)} · ${escapeCatHtml(b.author)}</div></div>`).join('')
        : '<div style="color:var(--muted);font-size:14px">해당 분야로 분류된 법률안이 없습니다.</div>';
    }

    // ===== 나에게 맞는 국가 혜택 확인 (샘플 데이터) =====
    const BENEFIT_CONDITIONS = [
      { key: 'child', label: '만 8세 미만 자녀 양육' },
      { key: 'newborn', label: '출생아(신생아) 부모' },
      { key: 'pregnant', label: '임신 중' },
      { key: 'disabled', label: '장애 등록' },
      { key: 'low_income', label: '기초생활·차상위 해당' },
      { key: 'student', label: '대학생' },
      { key: 'job_seeker', label: '구직·재직 중' },
      { key: 'overseas', label: '해외 진출 희망' }
    ];
    const BOKJIRO = 'https://www.bokjiro.go.kr';
    const GOV24 = 'https://www.gov.kr';
    // minAge/maxAge: 나이 조건, need: 상황 조건(없으면 나이 조건만으로 판단)
    const BENEFITS = [
      { name: '아동수당', org: '보건복지부', field: '사회', minAge: 0, maxAge: 7, need: null, desc: '만 8세 미만 아동을 양육하는 가정에 아동 수당을 지급합니다.', url: BOKJIRO },
      { name: '부모급여', org: '보건복지부', field: '사회', minAge: 0, maxAge: 1, need: 'child', desc: '0~1세 영아를 가정에서 양육하는 경우 현금을 지원합니다.', url: BOKJIRO },
      { name: '첫만남이용권', org: '고용노동부', field: '사회', minAge: 0, maxAge: 1, need: 'newborn', desc: '출생아 가정에 출산 이후 바우처를 지급합니다.', url: GOV24 },
      { name: '임신·출산 의료비 지원', org: '보건복지부', field: '사회', minAge: null, maxAge: null, need: 'pregnant', desc: '임신부의 진료비 부담을 줄이기 위한 지원입니다. 세부 기준은 기관에서 확인하세요.', url: BOKJIRO },
      { name: '청년도약계좌', org: '금융위원회', field: '사회', minAge: 19, maxAge: 34, need: null, desc: '청년의 자산 형성을 돕는 금융 상품으로, 소득 요건이 있습니다.', url: GOV24 },
      { name: '청년 월세 특별지원', org: '국토교통부', field: '사회', minAge: 19, maxAge: 34, need: null, desc: '무주택 청년의 월세 부담을 줄이기 위한 지원입니다. 소득·재산 요건이 있습니다.', url: GOV24 },
      { name: '기초연금', org: '보건복지부', field: '사회', minAge: 65, maxAge: null, need: null, desc: '만 65세 이상 중 소득 기준을 충족하는 어르신에게 연금을 지급합니다.', url: BOKJIRO },
      { name: '노인일자리 및 사회활동 지원', org: '보건복지부', field: '사회', minAge: 65, maxAge: null, need: null, desc: '어르신의 공익활동과 일자리 참여를 연계합니다.', url: BOKJIRO },
      { name: '장애인연금', org: '보건복지부', field: '사회', minAge: null, maxAge: null, need: 'disabled', desc: '중증 장애인 중 소득 기준을 충족하는 분에게 연금을 지급합니다.', url: BOKJIRO },
      { name: '기초생활보장(생계급여)', org: '보건복지부', field: '사회', minAge: null, maxAge: null, need: 'low_income', desc: '소득·재산이 기준 이하인 가구의 생계를 지원합니다.', url: BOKJIRO },
      { name: '국가장학금', org: '교육부', field: '교육', minAge: 18, maxAge: null, need: 'student', desc: '대학생의 소득분위 기준에 따라 장학금을 지원합니다.', url: GOV24 },
      { name: '국민내일배움카드', org: '고용노동부', field: '교육', minAge: 15, maxAge: null, need: 'job_seeker', desc: '구직자·재직자의 직업훈련 비용을 지원합니다.', url: GOV24 },
      { name: '과학기술 인재 양성 지원', org: '과학기술정보통신부', field: '과학', minAge: null, maxAge: null, need: 'student', desc: '이공계 인재 양성을 위한 장학·연구 지원입니다. 사업별 조건이 다릅니다.', url: GOV24 },
      { name: '청년 해외진출 지원', org: '교육부·고용노동부', field: '외교', minAge: 18, maxAge: 34, need: 'overseas', desc: '청년의 해외 인턴·취업 준비를 지원합니다.', url: GOV24 },
      { name: '문화누리카드', org: '문화체육관광부', field: '문화', minAge: null, maxAge: null, need: 'low_income', desc: '저소득층의 문화·예술·체육 관람을 지원하는 바우처입니다.', url: BOKJIRO }
    ];
    const selectedBenefitConds = new Set();

    function renderBenefitChecks() {
      const wrap = document.getElementById('benefitChecks');
      if (!wrap) return;
      wrap.innerHTML = BENEFIT_CONDITIONS.map(c =>
        `<label class="check-chip"><input type="checkbox" value="${c.key}" ${selectedBenefitConds.has(c.key) ? 'checked' : ''}> ${escapeCatHtml(c.label)}</label>`
      ).join('');
      wrap.querySelectorAll('input').forEach(input => input.addEventListener('change', () => {
        input.checked ? selectedBenefitConds.add(input.value) : selectedBenefitConds.delete(input.value);
        renderBenefits();
      }));
    }

    function matchBenefits(age) {
      return BENEFITS.filter(b => {
        if (b.need && !selectedBenefitConds.has(b.need)) return false;
        if (!b.need && age === null) return false; // 나이만으로 판단하는 혜택은 나이 입력이 필요
        if (age !== null) {
          if (b.minAge !== null && age < b.minAge) return false;
          if (b.maxAge !== null && age > b.maxAge) return false;
        }
        return true;
      });
    }

    function renderBenefits() {
      const el = document.getElementById('benefitResult');
      const ageInput = document.getElementById('benefitAge');
      if (!el || !ageInput) return;
      const age = ageInput.value === '' ? null : Number(ageInput.value);
      if (!selectedBenefitConds.size && age === null) {
        el.innerHTML = '<div style="color:var(--muted);font-size:14px;padding:8px 0">나이를 입력하거나 해당하는 상황을 선택하면 혜택 목록이 나타납니다.</div>';
        return;
      }
      const result = matchBenefits(age);
      if (!result.length) {
        el.innerHTML = '<div style="color:var(--muted);font-size:14px;padding:8px 0">선택한 조건에 맞는 혜택이 없습니다. 상황을 더 선택해 보세요.</div>';
        return;
      }
      el.innerHTML = `<div style="font-size:13px;color:var(--muted);margin-top:8px">조건에 맞을 가능성이 있는 혜택 ${result.length}건</div>` +
        result.map(b => `
          <div class="benefit-card">
            <span class="field-badge">${escapeCatHtml(b.field)}</span><span style="font-size:12px;color:var(--muted)">${escapeCatHtml(b.org)}</span>
            <h4>${escapeCatHtml(b.name)}</h4>
            <p>${escapeCatHtml(b.desc)}</p>
            <p style="margin-top:8px"><a href="${b.url}" target="_blank" rel="noopener" style="color:var(--blue-primary);font-weight:700;font-size:13px">신청·자격 확인 →</a></p>
          </div>`).join('');
    }

    const benefitAgeEl = document.getElementById('benefitAge');
    if (benefitAgeEl) benefitAgeEl.addEventListener('input', renderBenefits);
    renderBenefitChecks();
    renderBenefits();
    loadPolicyBills();
