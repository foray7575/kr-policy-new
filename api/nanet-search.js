// Vercel Serverless Function: 국회도서관(NANET) 자료검색 Open API 프록시
//
// 프론트엔드(index.html)의 검색창에서 /api/nanet-search?q=검색어 로 호출합니다.
// 브라우저에서 직접 국회도서관 API를 호출하면 CORS 차단 + 인증키 노출 문제가 있어
// 이 서버리스 함수가 대신 호출하고 결과만 JSON으로 정리해 돌려줍니다.
//
// 사전 준비:
// 1) https://www.data.go.kr 에서 "국회 국회도서관_자료검색 서비스" 활용신청
// 2) 발급받은 "일반 인증키(Decoding)" 값을 Vercel 프로젝트 환경변수 NANET_API_KEY 로 등록
// 3) 실제 요청 URL/파라미터명은 활용신청 승인 후 제공되는 "참고문서"에 명시된 값과
//    다를 수 있습니다. 아래 NANET_ENDPOINT / 파라미터명이 다르면 이 부분만 맞춰 수정하세요.

const NANET_ENDPOINT = 'https://apis.data.go.kr/9720000/searchservice/search';

module.exports = async function handler(req, res) {
  const query = (req.query && req.query.q ? String(req.query.q) : '').trim();
  if (!query) {
    res.status(400).json({ error: '검색어(q)가 필요합니다.' });
    return;
  }

  const serviceKey = process.env.NANET_API_KEY;
  if (!serviceKey) {
    res.status(500).json({ error: 'NANET_API_KEY 환경변수가 설정되지 않았습니다.' });
    return;
  }

  const params = new URLSearchParams({
    serviceKey,
    kwd: query,
    displayCount: '10',
    startCount: '0',
    systemType: 'SYSTEM_ALL',
  });

  try {
    const upstream = await fetch(`${NANET_ENDPOINT}?${params.toString()}`);
    const xml = await upstream.text();

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: '국회도서관 API 호출 실패', detail: xml.slice(0, 300) });
      return;
    }

    const items = parseNanetXml(xml);
    res.status(200).json({ query, count: items.length, items });
  } catch (err) {
    res.status(502).json({ error: '국회도서관 API 연결 중 오류가 발생했습니다.', detail: String(err && err.message || err) });
  }
};

// 간단한 XML -> JSON 파서 (외부 라이브러리 없이 정규식으로 <item>...</item> 블록을 추출)
// 실제 응답의 태그명(TITLE/AUTHOR/PUB_YEAR 등)이 다르면 아래 필드 매핑만 수정하면 됩니다.
function parseNanetXml(xml) {
  const items = [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  for (const block of itemBlocks) {
    items.push({
      title: pickTag(block, 'title') || pickTag(block, 'titleInfo'),
      author: pickTag(block, 'author') || pickTag(block, 'authorInfo'),
      pubYear: pickTag(block, 'pubYear') || pickTag(block, 'issuedDate'),
      link: pickTag(block, 'link') || pickTag(block, 'detailLink'),
    });
  }
  return items;
}

function pickTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  if (!match) return '';
  return match[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
    .trim();
}
