// ===================================================================
// テイクアウト注文フォーム — Code.gs
//
// 【セットアップ手順】
// 1. Google スプレッドシートを新規作成し、そのURLの
//    /spreadsheets/d/XXXXX/edit の XXXXX を SPREADSHEET_ID にセット
// 2. STORE_EMAIL に店のGmailアドレスを入力
// 3. GASエディタで「デプロイ」→「新しいデプロイ」
//    種類: ウェブアプリ / 実行者: 自分 / アクセス: 全員（匿名ユーザーを含む）
// 4. デプロイURLを index.html の GAS_URL にセット
// ===================================================================

const CONFIG = {
  spreadsheetId: '1775-dNoJPgRZJRbW2g4rV18K3Tmma0suRaxp4PdQNmw',
  sheetName:     '注文一覧',
  storeEmail:    'arlem.company@gmail.com',
  storeName:     'Tricy',
  timezone:      'Asia/Tokyo',
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
      { name: '万ねぎ',         price: 250 },
      { name: 'アスパラ',       price: 250 },
      { name: 'ピーマンチーズ', price: 250 },
      { name: 'トマト',         price: 250 },
      { name: 'おもち',         price: 250 },
      { name: 'まいたけ',       price: 250 },
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

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : null;
  const data   = (action === 'menu') ? MENU_SECTIONS : { storeName: CONFIG.storeName };
  return json(data);
}

function doPost(e) {
  try {
    const data   = JSON.parse(e.postData.contents);
    const result = submitOrder(data);
    return json(result);
  } catch (err) {
    return json({ success: false, error: err.message });
  }
}

// ===== 注文処理 =====

function submitOrder(data) {
  try {
    const sheet = getOrCreateSheet();
    const now   = new Date();

    const orderNum  = 'T' + Utilities.formatDate(now, CONFIG.timezone, 'yyyyMMddHHmmss');
    const orderDate = Utilities.formatDate(now, CONFIG.timezone, 'yyyy/MM/dd HH:mm:ss');
    const orderText = data.items.map(i => `${i.name}×${i.qty}`).join('、');
    const total     = calcTotal(data.items);

    sheet.appendRow([
      orderNum,   // 注文番号
      orderDate,  // 受付日時
      data.name,  // 氏名
      data.email, // メール
      data.phone, // 電話番号
      orderText,  // 注文内容
      total,      // 合計金額(円)
      '受付済',   // ステータス
    ]);

    sendCustomerEmail(data, orderNum, orderText, total);
    sendStoreEmail(data, orderNum, orderText, total);

    return { success: true, orderNum, total };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ===== ヘルパー =====

function getOrCreateSheet() {
  const ss    = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let   sheet = ss.getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.sheetName);
    const headers = ['注文番号', '受付日時', '氏名', 'メール', '電話番号',
                     '注文内容', '合計金額(円)', 'ステータス'];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#fed7aa'); // オレンジ系ヘッダー
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160); // 注文番号
    sheet.setColumnWidth(2, 150); // 受付日時
    sheet.setColumnWidth(6, 300); // 注文内容
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

function sendCustomerEmail(data, orderNum, orderText, total) {
  const body = [
    `${data.name} 様`,
    '',
    'ご注文ありがとうございます。',
    '以下の内容で承りました。',
    '',
    '─────────────────────',
    `注文番号　：${orderNum}`,
    `お名前　　：${data.name}`,
    `お電話　　：${data.phone}`,
    '',
    '【ご注文内容】',
    orderText,
    '',
    `合計金額　：¥${total.toLocaleString()}（税込）`,
    '─────────────────────',
    '',
    '当日、店頭にてお支払いください。',
    'ご来店をお待ちしております。',
    '',
    CONFIG.storeName,
  ].join('\n');

  MailApp.sendEmail({
    to:      data.email,
    subject: `【テイクアウト注文確認】注文番号 ${orderNum} — ${CONFIG.storeName}`,
    body,
  });
}

function sendStoreEmail(data, orderNum, orderText, total) {
  const body = [
    '新しいテイクアウト注文が入りました。',
    '',
    `注文番号　：${orderNum}`,
    `お名前　　：${data.name}`,
    `メール　　：${data.email}`,
    `電話番号　：${data.phone}`,
    '',
    '【注文内容】',
    orderText,
    '',
    `合計金額　：¥${total.toLocaleString()}（税込）`,
  ].join('\n');

  MailApp.sendEmail({
    to:      CONFIG.storeEmail,
    subject: `【新規注文】${data.name} 様 — ${orderText.slice(0, 30)}`,
    body,
  });
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
