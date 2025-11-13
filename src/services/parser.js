// src/utils/parser.js
// Parser OCR word-level + hình học cho CCCD VN

// ===== Regex cơ bản =====
const RE_CCCD = /\b\d{12}\b/;
const RE_CMND = /\b\d{9}\b/;
const RE_DATE = /\b(\d{2}[\/\-.]\d{2}[\/\-.]\d{4})\b/;

// Loại bỏ các tiêu ngữ dễ nhiễu khi đoán tên
const BAN_NAME = [
  /cộng\s*hòa\s*xã\s*hội/i,
  /độc\s*lập\s*-\s*tự\s*do\s*-\s*hạnh\s*phúc/i,
  /căn\s*cước\s*công\s*dân/i,
  /việt\s*nam|viet\s*nam/i,
];

// Nhãn chính
const LABEL_NAME = [
  /họ[, ]*\s*chữ\s*đệm\s*và\s*tên\s*khai\s*sinh/i,
  /họ\s*(và)?\s*tên/i,
  /full\s*name/i,
  /\bname\b/i,
];

const LABEL_GENDER = [/giới\s*tính|gioi\s*tinh|sex|gender/i];

const LABEL_ADDR = [
  /nơi\s*cư\s*trú/i, /noi\s*cu\s*tru/i,
  /thường\s*trú/i, /thuong\s*tru/i,
  /địa\s*chỉ/i, /dia\s*chi/i,
  /address/i, /place\s*of\s*residence/i,
];

const LABEL_ID = [/số\s*(định\s*danh|cccd|cmnd)/i];
const LABEL_DOB = [/ngày\s*sinh|dob|date\s*of\s*birth/i];

const STOP_LABELS = [
  ...LABEL_NAME, ...LABEL_GENDER, ...LABEL_ADDR, ...LABEL_ID, ...LABEL_DOB,
  /quốc\s*tịch|nationality/i,
  /quê\s*quán|place\s*of\s*origin/i,
  /cấp\s*ngày|issue/i,
];

// ===== Helpers =====
const cleanName = (s='') =>
  s.replace(/[^A-Za-zÀ-ỹ\s']/g,' ')
   .replace(/\s{2,}/g,' ')
   .trim();

const isLikelyName = (t='') =>
  !!t &&
  !/^\d+$/.test(t) &&
  !BAN_NAME.some(r => r.test(t)) &&
  /[A-Za-zÀ-ỹ]/.test(t) &&
  t.length >= 5;

/** Chuẩn hoá về mảng dòng, mỗi dòng gồm text + frame + elements (word + bbox) */
function toRichLines(blocks = []) {
  const out = [];
  (blocks || []).forEach((b) => {
    (b?.lines || []).forEach((ln) => {
      const text = (ln?.text || '').trim();
      if (!text) return;
      const bb = ln?.frame || ln?.bounding || {};
      const elements = (ln?.elements || []).map((el) => {
        const eb = el?.frame || el?.bounding || {};
        return {
          text: (el?.text || '').trim(),
          x: eb?.left ?? eb?.x ?? 0,
          y: eb?.top ?? eb?.y ?? 0,
          w: eb?.width ?? 0,
          h: eb?.height ?? 0,
        };
      });
      out.push({
        text,
        x: bb?.left ?? bb?.x ?? 0,
        y: bb?.top ?? bb?.y ?? 0,
        w: bb?.width ?? 0,
        h: bb?.height ?? 0,
        elements,
      });
    });
  });
  // sắp theo y rồi x
  out.sort((a, b) => (a.y - b.y) || (a.x - b.x));
  return out;
}

function findLineIdx(lines, regexArr) {
  for (let i = 0; i < lines.length; i++) {
    if (regexArr.some((r) => r.test(lines[i].text))) return i;
  }
  return -1;
}

/** Lấy token (word) nằm bên phải nhãn trên cùng dòng; nếu rỗng thì lấy dòng dưới cùng cột */
function readRightOrBelow(
  lines,
  idx,
  {
    dxRight = 20,       // khoảng cách tối thiểu sang phải để tính là “bên phải”
    rightPadding = 650, // độ rộng vùng đọc bên phải
    belowDy = 220,      // vùng chiều cao đọc ở dưới
    sameColTol = 150,   // độ lệch cột cho phép
    joinMulti = true,   // có ghép nhiều dòng không
    stopOnLabel = true
  } = {}
) {
  if (idx < 0) return '';

  const src = lines[idx];

  // 1) đọc cùng dòng: các token nằm bên phải nhãn
  const lineRightTokens = [];
  if (src.elements?.length) {
    const labelRightEdge = src.x + src.w * 0.45; // nhãn thường ở nửa trái dòng
    const minX = labelRightEdge + dxRight;
    const maxX = src.x + src.w + rightPadding;

    src.elements.forEach((tok) => {
      if (!tok.text) return;
      const cx = tok.x + tok.w / 2;
      if (cx >= minX && cx <= maxX) {
        lineRightTokens.push(tok.text);
      }
    });
  }
  const sameLine = lineRightTokens.join(' ').replace(/\s{2,}/g, ' ').trim();
  if (sameLine) return sameLine;

  // 2) nếu cùng dòng rỗng: đọc các dòng phía dưới cùng cột
  const left = src.x - sameColTol,
    right = src.x + src.w + sameColTol;
  const top = src.y + src.h - 2,
    bottom = src.y + src.h + belowDy;

  const buf = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.y > bottom) break; // quá xa
    if (ln.y < top) continue; // vẫn trên
    if (ln.x + ln.w < left || ln.x > right) continue; // lệch cột

    if (stopOnLabel && STOP_LABELS.some((r) => r.test(ln.text))) break;
    buf.push(ln.text);
    if (!joinMulti) break;
    if (buf.join(' ').length > 40 && joinMulti) break; // đủ dài
  }
  return buf.join(' ').replace(/\s{2,}/g, ' ').trim();
}

function pickIdAnywhere(lines, fullText = '') {
  const tight = fullText.match(RE_CCCD)?.[0];
  if (tight) return tight;
  const cmnd = fullText.match(RE_CMND)?.[0];
  if (cmnd) return cmnd;
  // ghép số nếu OCR tách
  const digits = (fullText.match(/[\d\s]/g) || []).join('').replace(/\s/g, '');
  const twelve = (digits.match(/\d{12}/g) || [])[0];
  return twelve || null;
}

/** ===== API chính: truyền nguyên kết quả TextRecognition.recognize(frontUri/backUri) ===== */
function extractFieldsFromBlocks(frontRes = {}, backRes = {}) {
  const lines = [
    ...toRichLines(frontRes?.blocks),
    ...toRichLines(backRes?.blocks),
  ];
  const fullText = (frontRes?.text || '') + '\n' + (backRes?.text || '');

  // 1) ID
  let identityCard = pickIdAnywhere(lines, fullText);

  // 2) NAME
  let fullName = '';
  const nameIdx = findLineIdx(lines, LABEL_NAME);
  fullName = readRightOrBelow(lines, nameIdx, {
    dxRight: 20,
    rightPadding: 700,
    belowDy: 180,
    sameColTol: 120,
    joinMulti: false,
  });
  // fallback: ngay dòng dưới nhãn "Số định danh..."
  if (!isLikelyName(fullName)) {
    const idLbl = findLineIdx(lines, LABEL_ID);
    const cand = readRightOrBelow(lines, idLbl, {
      dxRight: 20,
      rightPadding: 700,
      belowDy: 160,
      sameColTol: 120,
      joinMulti: false,
    });
    if (isLikelyName(cand)) fullName = cand;
  }
  fullName = cleanName(fullName);

  // 3) DOB
  let dateOfBirth = '';
  const dobIdx = findLineIdx(lines, LABEL_DOB);
  if (dobIdx >= 0) {
    const win = [
      lines[dobIdx].text,
      readRightOrBelow(lines, dobIdx, { joinMulti: false }),
    ]
      .filter(Boolean)
      .join(' ');
    dateOfBirth =
      (win.match(RE_DATE) || [])[1] || (fullText.match(RE_DATE) || [])[1] || '';
  } else {
    dateOfBirth = (fullText.match(RE_DATE) || [])[1] || '';
  }

  // 4) GENDER
  let gender = 'other';
  const gIdx = findLineIdx(lines, LABEL_GENDER);
  if (gIdx >= 0) {
    const near = [
      lines[gIdx - 1]?.text,
      lines[gIdx]?.text,
      readRightOrBelow(lines, gIdx, { joinMulti: false }),
    ]
      .filter(Boolean)
      .join(' ');
    if (/\b(nam|male|m)\b/i.test(near)) gender = 'male';
    else if (/\b(nữ|nu|female|f)\b/i.test(near)) gender = 'female';
  }
  if (gender === 'other') {
    const solo = lines.find((l) =>
      /^\b(nam|nữ|nu|male|female)\b$/i.test(l.text || '')
    );
    if (solo) gender = /\b(nam|male)\b/i.test(solo.text) ? 'male' : 'female';
  }

  // 5) ADDRESS (ưu tiên Nơi cư trú / Thường trú / Địa chỉ)
  let address = '';
  const aIdx = findLineIdx(lines, LABEL_ADDR);
  if (aIdx >= 0) {
    address = readRightOrBelow(lines, aIdx, {
      dxRight: 20,
      rightPadding: 900,
      belowDy: 520,
      sameColTol: 220,
      joinMulti: true,
    });
  }
  address = address.replace(/\s{2,}/g, ' ').trim();

  return { identityCard, fullName, dateOfBirth, gender, address };
}

module.exports = {
  extractFieldsFromBlocks,
};
