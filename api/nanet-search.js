// Vercel Serverless Function: 열린국회정보(open.assembly.go.kr) 국회의원 발의법률안 API 프록시
//
// 프론트엔드(index.html)의 검색창에서 /api/nanet-search?q=검색어 로 호출합니다.
// 브라우저에서 직접 호출하면 CORS 차단 + 인증키 노출 문제가 있어 이 서버리스 함수가 대신 호출합니다.
//
// 검색어는 법률안명(BILL_NAME)과 발의자(PROPOSER) 두 필드로 각각 조회한 뒤 병합합니다.
// 즉, "노동조합" 같은 키워드는 물론 "강경식" 같은 발의자 이름을 입력해도 결과를 찾을 수 있습니다.
//
// 사전 준비:
// 1) https://open.assembly.go.kr 에서 회원가입 후 인증키 발급 (마이페이지 > Open API 인증키 발급/확인)
// 2) 발급받은 인증키를 Vercel 프로젝트 환경변수 NANET_API_KEY 로 등록
// 3) API: 국회의원 발의법률안 (nzmimeepazxkubdpn), AGE(대수)는 현재 국회 기준 22로 고정

const BILL_ENDPOINT = 'https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn';
const CURRENT_AGE = '22';

function mapRow(row) {
  return {
    title: row.BILL_NAME || '',
    author: row.PROPOSER || '',
    pubYear: (row.PROPOSE_DT || '').slice(0, 4),
    pubDate: row.PROPOSE_DT || '',
    committee: row.COMMITTEE || '',
    status: row.PROC_RESULT || row.LAW_PROC_RESULT_CD || row.CMT_PROC_RESULT_CD || '',
    billNo: row.BILL_NO || '',
    link: row.DETAIL_LINK || '',
  };
}

function rowKey(row) {
  return row.BILL_ID || row.BILL_NO || `${row.BILL_NAME}__${row.PROPOSER}`;
}

module.exports = async function handler(req, res) {
  const isLatest = req.query && (req.query.latest === '1' || req.query.latest === 'true');
  const query = (req.query && req.query.q ? String(req.query.q) : '').trim();
  if (!isLatest && !query) {
    res.status(400).json({ error: '검색어(q)가 필요합니다.' });
    return;
  }

  const apiKey = process.env.NANET_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'NANET_API_KEY 환경변수가 설정되지 않았습니다.' });
    return;
  }

  const pSize = (req.query && req.query.pSize ? String(req.query.pSize) : '10');

  async function fetchRows(extraParams) {
    const params = new URLSearchParams({
      KEY: apiKey,
      Type: 'json',
      pIndex: '1',
      pSize,
      AGE: CURRENT_AGE,
      ...extraParams,
    });
    const upstream = await fetch(`${BILL_ENDPOINT}?${params.toString()}`);
    const data = await upstream.json();
    const payload = data && data.nzmimeepazxkubdpn;
    if (!payload) return { rows: [], notice: (data && data.RESULT && data.RESULT.MESSAGE) || undefined };
    const resultInfo = payload[0] && payload[0].head && payload[0].head[1] && payload[0].head[1].RESULT;
    const rows = (payload[1] && payload[1].row) || [];
    return { rows, notice: resultInfo ? resultInfo.MESSAGE : undefined };
  }

  try {
    if (isLatest) {
      const { rows, notice } = await fetchRows({});
      const items = rows.map(mapRow);
      res.status(200).json({ query, count: items.length, items, notice });
      return;
    }

    // 법률안명 검색 + 발의자(대표발의자) 검색을 병렬로 호출한 뒤 중복 제거하여 병합
    const [byName, byProposer] = await Promise.all([
      fetchRows({ BILL_NAME: query }),
      fetchRows({ PROPOSER: query }),
    ]);

    const merged = new Map();
    [...byName.rows, ...byProposer.rows].forEach(row => {
      const key = rowKey(row);
      if (!merged.has(key)) merged.set(key, row);
    });

    const items = Array.from(merged.values()).slice(0, Number(pSize) || 10).map(mapRow);
    const notice = byName.notice || byProposer.notice;
    res.status(200).json({ query, count: items.length, items, notice });
  } catch (err) {
    res.status(502).json({ error: '열린국회정보 API 연결 중 오류가 발생했습니다.', detail: String(err && err.message || err) });
  }
};
