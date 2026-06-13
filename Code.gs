var CONFIG = {
  spreadsheetId: '1775-dNoJPgRZJRbW2g4rV18K3Tmma0suRaxp4PdQNmw',
  sheetName:     '注文一覧',
  storeEmail:    'arlem.company@gmail.com',
  storeName:     'Tricy',
  timezone:      'Asia/Tokyo'
};

// 列番号の定義
var COL = {
  orderNum:  1,
  orderDate: 2,
  name:      3,
  phone:     4,
  email:     5,
  itemName:  6,
  qty:       7,
  subtotal:  8,
  total:     9,
  status:    10,
  done:      11
};

var MENU_SECTIONS = [
  {
    title: '霧島鶏のやきとり',
    note:  '200円/本',
    items: [
      { name: 'ねっく',   price: 200 },
      { name: 'ぼんじり', price: 200 },
      { name: 'ねぎま',   price: 200 },
      { name: 'なんこつ', price: 200 },
      { name: 'レバー',   price: 200 },
      { name: 'かわ',     price: 200 },
      { name: 'はつ',     price: 200 },
      { name: 'つくね',   price: 200 },
      { name: '砂肝',     price: 200 },
      { name: 'ささみ',   price: 200 }
    ]
  },
  {
    title: '野菜巻き',
    note:  '250円/本',
    items: [
      { name: '万ねぎ',         price: 250 },
      { name: 'アスパラ',       price: 250 },
      { name: 'ピーマンチーズ', price: 250 },
      { name: 'トマト',         price: 250 },
      { name: 'おもち',         price: 250 },
      { name: 'まいたけ',       price: 250 }
    ]
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
      { name: 'なすのきんぴら',               price: 500  }
    ]
  }
];

// ===== スプレッドシートにメニューを追加 =====

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tricy')
    .addItem('完成メールの下書きを作成', 'createReadyDraft')
    .addToUi();
}

// ===== 完成メール下書き作成 =====

function createReadyDraft() {
  var ui    = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetName);
  if (!sheet) { ui.alert('注文一覧シートが見つかりません。'); return; }

  var activeRow = sheet.getActiveCell().getRow();
  if (activeRow <= 1) { ui.alert('注文の行を選択してから実行してください。'); return; }

  var orderNum = sheet.getRange(activeRow, COL.orderNum).getValue();
  if (!orderNum) { ui.alert('注文番号が見つかりません。'); return; }

  // 同じ注文番号の全行を収集
  var lastRow = sheet.getLastRow();
  var allData = sheet.getRange(2, 1, lastRow - 1, COL.done).getValues();

  var customerName  = '';
  var customerEmail = '';
  var customerPhone = '';
  var orderDate     = '';
  var orderTotal    = 0;
  var itemLines     = [];
  var allDone       = true;

  for (var i = 0; i < allData.length; i++) {
    if (allData[i][COL.orderNum - 1] === orderNum) {
      if (!customerName) {
        customerName  = allData[i][COL.name  - 1];
        customerEmail = allData[i][COL.email - 1];
        customerPhone = allData[i][COL.phone - 1];
        orderDate     = allData[i][COL.orderDate - 1];
        orderTotal    = allData[i][COL.total - 1];
      }
      itemLines.push(allData[i][COL.itemName - 1] + ' x' + allData[i][COL.qty - 1]);
      if (!allData[i][COL.done - 1]) { allDone = false; }
    }
  }

  if (!customerEmail) { ui.alert('メールアドレスが見つかりません。'); return; }

  // 未チェックがある場合は確認
  if (!allDone) {
    var res = ui.alert(
      'まだチェックされていない品目があります。\nこのまま下書きを作成しますか？',
      ui.ButtonSet.YES_NO
    );
    if (res !== ui.Button.YES) { return; }
  }

  var body = customerName + ' 様\n\n'
    + 'お待たせいたしました。\n'
    + 'ご注文のお品物の準備ができました。\n\n'
    + '─────────────────\n'
    + '注文番号：' + orderNum + '\n\n'
    + '《ご注文内容》\n'
    + itemLines.join('\n') + '\n\n'
    + '合計金額：' + orderTotal + '円（税込）\n'
    + '─────────────────\n\n'
    + '店頭にてお支払いください。\n'
    + 'ご来店をお待ちしております。\n\n'
    + CONFIG.storeName;

  GmailApp.createDraft(
    customerEmail,
    'ご注文の準備ができました — ' + CONFIG.storeName,
    body
  );

  ui.alert('Gmailの下書きに追加しました。\n確認して送信してください。');
}

// ===== GAS ウェブアプリ =====

function doGet(e) {
  var action = (e && e.parameter) ? e.parameter.action : null;
  var data   = (action === 'menu') ? MENU_SECTIONS : { storeName: CONFIG.storeName };
  return makeJson(data);
}

function doPost(e) {
  try {
    var data   = JSON.parse(e.postData.contents);
    var result = submitOrder(data);
    return makeJson(result);
  } catch (err) {
    return makeJson({ success: false, error: err.message });
  }
}

// ===== 注文処理 =====

function submitOrder(data) {
  try {
    var sheet     = getOrCreateSheet();
    var now       = new Date();
    var orderNum  = 'T' + Utilities.formatDate(now, CONFIG.timezone, 'yyyyMMddHHmmss');
    var orderDate = Utilities.formatDate(now, CONFIG.timezone, 'yyyy/MM/dd HH:mm:ss');
    var total     = calcTotal(data.items);

    var allItems = [];
    var s, n;
    for (s = 0; s < MENU_SECTIONS.length; s++) {
      for (n = 0; n < MENU_SECTIONS[s].items.length; n++) {
        allItems.push(MENU_SECTIONS[s].items[n]);
      }
    }

    for (var i = 0; i < data.items.length; i++) {
      var item  = data.items[i];
      var price = 0;
      for (var k = 0; k < allItems.length; k++) {
        if (allItems[k].name === item.name) { price = allItems[k].price; break; }
      }
      var subtotal = price * item.qty;
      sheet.appendRow([
        orderNum,                  // 1: 注文番号
        orderDate,                 // 2: 受付日時
        data.name,                 // 3: 氏名
        data.phone,                // 4: 電話番号
        data.email,                // 5: メール
        item.name,                 // 6: 品名
        item.qty,                  // 7: 個数
        subtotal,                  // 8: 小計(円)
        i === 0 ? total    : '',   // 9: 合計(円)
        i === 0 ? '受付済' : '',   // 10: ステータス
        false                      // 11: できあがり
      ]);
      sheet.getRange(sheet.getLastRow(), COL.done).insertCheckboxes();
    }

    var orderText = '';
    for (var j = 0; j < data.items.length; j++) {
      if (j > 0) { orderText += '、'; }
      orderText += data.items[j].name + 'x' + data.items[j].qty;
    }

    sendCustomerEmail(data, orderNum, orderText, total);
    sendStoreEmail(data, orderNum, orderText, total);

    return { success: true, orderNum: orderNum, total: total };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ===== ヘルパー =====

function getOrCreateSheet() {
  var ss    = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = ss.getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.sheetName);
    var headers = [
      '注文番号', '受付日時', '氏名', '電話番号', 'メール',
      '品名', '個数', '小計(円)', '合計(円)', 'ステータス', 'できあがり'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#fed7aa');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1,  160);
    sheet.setColumnWidth(2,  150);
    sheet.setColumnWidth(5,  180);
    sheet.setColumnWidth(6,  200);
    sheet.setColumnWidth(11,  90);
  }
  return sheet;
}

function calcTotal(items) {
  var allItems = [];
  var s, i;
  for (s = 0; s < MENU_SECTIONS.length; s++) {
    for (i = 0; i < MENU_SECTIONS[s].items.length; i++) {
      allItems.push(MENU_SECTIONS[s].items[i]);
    }
  }
  var total = 0;
  var j, k;
  for (j = 0; j < items.length; j++) {
    for (k = 0; k < allItems.length; k++) {
      if (allItems[k].name === items[j].name) {
        total += allItems[k].price * items[j].qty;
        break;
      }
    }
  }
  return total;
}

function sendCustomerEmail(data, orderNum, orderText, total) {
  var body = data.name + ' 様\n\n'
    + 'ご注文ありがとうございます。\n'
    + '以下の内容で承りました。\n\n'
    + '─────────────────\n'
    + '注文番号：' + orderNum + '\n'
    + 'お名前：' + data.name + '\n'
    + 'お電話：' + data.phone + '\n\n'
    + '《ご注文内容》\n'
    + orderText + '\n\n'
    + '合計金額：' + total + '円（税込）\n'
    + '─────────────────\n\n'
    + '当日、店頭にてお支払いください。\n'
    + 'ご来店をお待ちしております。\n\n'
    + CONFIG.storeName;

  MailApp.sendEmail({
    to:      data.email,
    subject: 'テイクアウト注文確認 ' + orderNum,
    body:    body
  });
}

function sendStoreEmail(data, orderNum, orderText, total) {
  var body = '新しいテイクアウト注文が入りました。\n\n'
    + '注文番号：' + orderNum + '\n'
    + 'お名前：' + data.name + '\n'
    + 'メール：' + data.email + '\n'
    + '電話番号：' + data.phone + '\n\n'
    + '《注文内容》\n'
    + orderText + '\n\n'
    + '合計金額：' + total + '円（税込）';

  MailApp.sendEmail({
    to:      CONFIG.storeEmail,
    subject: '新規注文 ' + data.name + ' 様',
    body:    body
  });
}

function makeJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
