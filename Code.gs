// ===================================================================
// テイクアウト注文フォーム — Code.gs
//
// 【セットアップ手順】
// 1. Google スプレッドシートを新規作成し、そのURLの
//    /spreadsheets/d/XXXXX/edit の XXXXX を SPREADSHEET_ID にセット
// 2. STORE_EMAIL に店のGmailアドレスを入力
// 3. GASエディタで「デプロイ」→「新しいデプロイ」
//    種類: ウェブアプリ / 実行者: 自分 / アクセス: 全員
// 4. デプロイURLを index.html の GAS_URL にセット
// ===================================================================

const CONFIG = {
  spreadsheetId:  'YOUR_SPREADSHEET_ID', // ← スプレッドシートIDに変更
  sheetName:      '注文一覧',
  storeEmail:     'YOUR_STORE_EMAIL',    // ← 店のメールアドレスに変更
  storeName:      'Tricy',
  timezone:       'Asia/Tokyo',
  pickupStart:    '18:00',
  pickupEnd:      '22:00',
  pickupInterval: 30,
};

const MENU_SECTIONS = [
  {
    title: '霧島鶏のやきとり',
    note:  '¥200/本（5本：¥1,000 / 10本：¥2,000）',
    items: [
      { name: 'ねっく',    price: 200 },
      { name: 'ぼんじり',  price: 200 },
      { name: 'ねぎま',    price: 200 },
      { name: 'なんこつ',  price: 200 },
      { name: 'レバー',    price: 200 },
      { name: 'かわ',      price: 200 },
      { name: 'はつ',      price: 200 },
      { name: 'つくね',    price: 200 },
      { name: '砂肝',      price: 200 },
      { name: 'ささみ',    price: 200 },
    ],
  },
  {
    title: '野菜巻き',
    note:  '¥250/本（4本：¥1,000 / 8本：¥2,000）',
    items: [
      { name: '万ねぎ',             price: 250 },
      { name: 'アスパラ',           price: 250 },
      { name: 'ピーマンチーズ',     price: 250 },
      { name: 'トマト',             price: 250 },
      { name: 'おもち',             price: 250 },
      { name: 'まいたけ',           price: 250 },
    ],
  },
  {
    title: 'サイドメニュー',
    note:  '',
    items: [
      { name: '旨塩からあげ 3個',              price: 500  },
      { name: '旨塩からあげ 6個',              price: 1000 },
      { name: 'カレーのポテサラ',              price: 500  },
      { name: '鶏なんこつの梅水晶',            price: 500  },
      { name: 'ほくほく 厚切りフライドポテト', price: 500  },
      { name: '山芋のわさび漬け',              price: 500  },
      { name: 'なすのきんぴら',               price: 500  },
    ],
  },
];

// ===== GAS エントリポイント =====

// GitHub Pages からの fetch に応答（JSON API）
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : null;
  const data = (action === 'menu') ? MENU_SECTIONS : {
    storeName:      CONFIG.storeName,
    pickupStart:    CONFIG.pickupStart,
    pickupEnd:      CONFIG.pickupEnd,
    pickupInterval: CONFIG.pickupInterval,
  };
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// GitHub Pages からの fetch POST に応答
function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const result = submitOrder(data);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 注文処理
function submitOrder(data) {
  try {
    const sheet = getOrCreateSheet();
    const now   = new Date();

    const orderNum  = 'T' + Utilities.formatDate(now, CONFIG.timezone, 'yyyyMMddHHmmss');
    const orderDate = Utilities.formatDate(now, CONFIG.timezone, 'yyyy/MM/dd HH:mm:ss');

    const orderLines = data.items.map(i => `${i.name}×${i.qty}`).join('、');
    const total      = calcTotal(data.items);

    sheet.appendRow([orderNum, orderDate, data.name, data.email, data.phone,
                     orderLines, total, data.pickupTime, '受付済']);

    sendCustomerEmail(data, orderNum, orderLines, total);
    sendStoreEmail(data, orderNum, orderLines, total);

    return { success: true, orderNum, total };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ===== 内部ヘルパー =====

function getOrCreateSheet() {
  const ss    = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let   sheet = ss.getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.sheetName);
    const headers = ['注文番号', '受付日時', '氏名', 'メール', '電話番号',
                     '注文内容', '合計金額(円)', '受取時刻', 'ステータス'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#fef3c7');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function calcTotal(items) {
  const allItems = MENU_SECTIONS.flatMap(s => s.items);
  return items.reduce((sum, i) => {
    const m = allItems.find(m => m.name === i.name);
    return sum + (m ? m.price * i.qty : 0);
  }, 0);
}

function sendCustomerEmail(data, orderNum, orderLines, total) {
  const lines = [
    `${data.name} 様`,
    '',
    'ご注文ありがとうございます。',
    '以下の内容で承りました。',
    '',
    '─────────────────────',
    `注文番号　：${orderNum}`,
    `受取時刻　：${data.pickupTime}`,
    `お名前　　：${data.name}`,
    `お電話　　：${data.phone}`,
    '',
    '【ご注文内容】',
    orderLines,
    '',
    `合計金額　：¥${total.toLocaleString()}（税込）`,
    '─────────────────────',
    '',
    '当日、店頭にてお支払いください。',
    'ご来店をお待ちしております。',
    '',
    CONFIG.storeName,
  ];
  MailApp.sendEmail({
    to:      data.email,
    subject: `【テイクアウト注文確認】注文番号 ${orderNum}`,
    body:    lines.join('\n'),
  });
}

function sendStoreEmail(data, orderNum, orderLines, total) {
  const lines = [
    '新しいテイクアウト注文が入りました。',
    '',
    `注文番号　：${orderNum}`,
    `受取時刻　：${data.pickupTime}`,
    `お名前　　：${data.name}`,
    `メール　　：${data.email}`,
    `電話番号　：${data.phone}`,
    '',
    '【注文内容】',
    orderLines,
    '',
    `合計金額　：¥${total.toLocaleString()}（税込）`,
  ];
  MailApp.sendEmail({
    to:      CONFIG.storeEmail,
    subject: `【新規注文】${data.pickupTime} 受取 ${data.name} 様`,
    body:    lines.join('\n'),
  });
}
