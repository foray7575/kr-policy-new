// Vercel Serverless Function: 열린국회정보 「법률안 제안이유 및 주요내용」(BPMBILLSUMMARY) 프록시
//
// 사용법: /api/bill-summary?billNo=2221318
// 같은 인증키(NANET_API_KEY)를 사용하며, 응답은 짧은 요약(summary)과 원문 전체(full)를 함께 돌려줍니다.
// 요약은 규칙 기반입니다: 「제안이유」 첫 문단의 앞 문장들을 잘라 쓰고, 전체 원문은 펼쳐 보기로 제공합니다.

const SUMMARY_ENDPOINT = 'https://open.assembly.go.kr/portal/openapi/BPMBILLSUMMARY';
const CURRENT_AGE = '22';
const MAX_SUMMARY_CHARS = 260;

// 「제안이유」 본문의 첫 문단에서 문장 단위로 잘라 maxChars 이내로 만든다.
function makeShortSummary(text) {
  if (!text) return '';
  const cleaned = text.replace(/\r/g, '').trim();
  // 머리말 「제안이유」/「주요내용」 제목을 떼고 본문만 남긴다.
  const body = cleaned
    .replace(/^\s*제안이유\s*/, '')
    .split(/\n\s*\n|주요내용/)[0]
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = body.split(/(?<=[.다음])\s+/).filter(Boolean);
  let out = '';
  for (const s of sentences) {
    if ((out + ' ' + s).trim().length > MAX_SUMMARY_CHARS) break;
    out = (out + ' ' + s).trim();
  }
  if (!out) out = body.slice(0, MAX_SUMMARY_CHARS);
  return out;
}

module.exports = async function handler(req, res) {
  const billNo = (req.query && req.query.billNo ? String(req.query.billNo) : '').trim();
  if (!billNo || !/^[0-9A-Za-z_-]+$/.test(billNo)) {
    res.status(400).json({ error: '유효한 의안번호(billNo)가 필요합니다.' });
    return;
  }

  const apiKey = process.env.NANET_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'NANET_API_KEY 환경변수가 설정되지 않았습니다.' });
    return;
  }

  const params = new URLSearchParams({
    KEY: apiKey,
    Type: 'json',
    pIndex: '1',
    pSize: '5',
    AGE: CURRENT_AGE,
    BILL_NO: billNo,
  });

  try {
    const upstream = await fetch(`${SUMMARY_ENDPOINT}?${params.toString()}`);
    const data = await upstream.json();
    const payload = data && data.BPMBILLSUMMARY;
    if (!payload || payload.length < 2) {
      const info = (data && data.RESULT) || {};
      res.status(200).json({ billNo, summary: '', full: '', notice: info.MESSAGE || '제안이유 정보를 찾지 못했습니다.' });
      return;
    }
    const row = (payload[1] && payload[1].row && payload[1].row[0]) || null;
    const full = row && row.SUMMARY ? String(row.SUMMARY).trim() : '';
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.status(200).json({
      billNo,
      billId: row ? row.BILL_ID || '' : '',
      summary: makeShortSummary(full),
      full,
    });
  } catch (err) {
    res.status(502).json({ error: '열린국회정보 제안이유 API 연결 중 오류가 발생했습니다.', detail: String((err && err.message) || err) });
  }
};

module.exports.makeShortSummary = makeShortSummary;
