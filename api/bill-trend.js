// Vercel Serverless Function: 열린국회정보(open.assembly.go.kr) 국회의원 발의법률안 API를 이용한
// 월간 법안 발의 추이 집계 프록시
//
// 프론트엔드(app.js)의 "최신 소식" 섹션 하단 그래프에서 /api/bill-trend 로 호출합니다.
// 최근 발의된 법률안을 다건 조회한 뒤, PROPOSE_DT(발의일자) 기준으로 최근 12개월 건수를 월별로 집계해 반환합니다.
//
// 참고: nanet-search.js 와 동일한 엔드포인트/인증키(NANET_API_KEY)를 사용합니다.

const BILL_ENDPOINT = 'https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn';
const CURRENT_AGE = '22';
const PAGE_SIZE = 300; // 최근 12개월 집계를 위해 넉넉히 조회
const MONTH_COUNT = 12;

function monthKey(dateStr) {
  if (!dateStr || dateStr.length < 7) return null;
  return dateStr.slice(0, 7); // YYYY-MM
}

function buildLast12Months() {
  const months = [];
  const now = new Date();
  for (let i = MONTH_COUNT - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push(key);
  }
  return months;
}

module.exports = async function handler(req, res) {
  const apiKey = process.env.NANET_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'NANET_API_KEY 환경변수가 설정되지 않았습니다.' });
    return;
  }

  const params = new URLSearchParams({
    KEY: apiKey,
    Type: 'json',
    pIndex: '1',
    pSize: String(PAGE_SIZE),
    AGE: CURRENT_AGE,
  });

  try {
    const upstream = await fetch(`${BILL_ENDPOINT}?${params.toString()}`);
    const data = await upstream.json();

    const payload = data && data.nzmimeepazxkubdpn;
    const months = buildLast12Months();
    const counts = Object.fromEntries(months.map(m => [m, 0]));

    if (payload) {
      const rows = (payload[1] && payload[1].row) || [];
      rows.forEach(row => {
        const key = monthKey(row.PROPOSE_DT);
        if (key && Object.prototype.hasOwnProperty.call(counts, key)) {
          counts[key] += 1;
        }
      });
    }

    const items = months.map(m => ({ month: m, count: counts[m] }));
    res.status(200).json({ months: items });
  } catch (err) {
    res.status(502).json({ error: '열린국회정보 API 연결 중 오류가 발생했습니다.', detail: String(err && err.message || err) });
  }
};
