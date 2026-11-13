// Vercel Serverless Function: 열린국회정보(open.assembly.go.kr) 국회의원 발의법률안 API를 이용한
// 월별 법안 발의 건수 집계 프록시
//
// 사용법: /api/bill-trend?from=2026-01&to=2026-09
//  - from: 시작 월(YYYY-MM), to: 종료 월(YYYY-MM). 둘 다 생략하면 최근 12개월.
//  - 범위는 최대 36개월. 시작 월이 종료 월보다 늦으면 두 값을 바꿔 적용합니다.
//
// 데이터는 발의일 최신순으로 제공되므로, 조회 범위의 시작 월보다 오래된 행이 나오면 페이지 조회를 멈춥니다.
// 같은 인증키(NANET_API_KEY)를 사용합니다.

const BILL_ENDPOINT = 'https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn';
const CURRENT_AGE = '22';
const PAGE_SIZE = 1000;      // 열린국회정보 API 최대 요청 건수
const BATCH_SIZE = 4;        // 동시에 요청할 페이지 수
const MAX_PAGES = 40;        // 안전장치 (최대 40,000건)
const MAX_MONTHS = 36;
const DEFAULT_MONTHS = 12;

function pad(n) { return String(n).padStart(2, '0'); }

function parseMonth(value) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}`;
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function listMonths(from, to) {
  const months = [];
  let cur = from;
  while (cur <= to) {
    months.push(cur);
    cur = shiftMonth(cur, 1);
  }
  return months;
}

async function fetchPage(apiKey, page) {
  const params = new URLSearchParams({
    KEY: apiKey,
    Type: 'json',
    pIndex: String(page),
    pSize: String(PAGE_SIZE),
    AGE: CURRENT_AGE,
  });
  const upstream = await fetch(`${BILL_ENDPOINT}?${params.toString()}`);
  const data = await upstream.json();
  const payload = data && data.nzmimeepazxkubdpn;
  if (!payload || payload.length < 2) return [];
  return (payload[1] && payload[1].row) || [];
}

module.exports = async function handler(req, res) {
  const apiKey = process.env.NANET_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'NANET_API_KEY 환경변수가 설정되지 않았습니다.' });
    return;
  }

  const now = currentMonth();
  let from = parseMonth(req.query && req.query.from);
  let to = parseMonth(req.query && req.query.to);
  if (!to) to = now;
  if (!from) from = shiftMonth(to, -(DEFAULT_MONTHS - 1));
  if (from > to) [from, to] = [to, from];
  if (listMonths(from, to).length > MAX_MONTHS) from = shiftMonth(to, -(MAX_MONTHS - 1));

  const months = listMonths(from, to);
  const counts = Object.fromEntries(months.map(m => [m, 0]));

  try {
    let done = false;
    for (let start = 1; start <= MAX_PAGES && !done; start += BATCH_SIZE) {
      const pages = [];
      for (let p = start; p < start + BATCH_SIZE && p <= MAX_PAGES; p++) pages.push(p);
      const results = await Promise.all(pages.map(p => fetchPage(apiKey, p)));

      for (const rows of results) {
        rows.forEach(row => {
          const key = String(row.PROPOSE_DT || '').slice(0, 7);
          if (key && Object.prototype.hasOwnProperty.call(counts, key)) counts[key] += 1;
        });
        // 마지막 행이 조회 시작 월보다 과거이거나 페이지가 가득 차지 않았다면 더 조회할 필요가 없음
        const last = rows[rows.length - 1];
        const lastKey = last ? String(last.PROPOSE_DT || '').slice(0, 7) : '';
        if (rows.length < PAGE_SIZE || (lastKey && lastKey < from)) {
          done = true;
          break;
        }
      }
    }

    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({
      from,
      to,
      months: months.map(m => ({ month: m, count: counts[m] })),
    });
  } catch (err) {
    res.status(502).json({ error: '열린국회정보 API 연결 중 오류가 발생했습니다.', detail: String((err && err.message) || err) });
  }
};
