var CONFIG = {
  spreadsheetId: '1775-dNoJPgRZJRbW2g4rV18K3Tmma0suRaxp4PdQNmw',
  sheetName:     '注文一覧',
  storeEmail:    'arlem.company@gmail.com',
  storeName:     'Tricy',
  timezone:      'Asia/Tokyo'
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

function submitOrder(data) {
  try {
    var sheet     = getOrCreateSheet();
    var now       = new Date();
    var orderNum  = 'T' + Utilities.formatDate(now, CONFIG.timezone, 'yyyyMMddHHmmss');
    var orderDate = Utilities.formatDate(now, CONFIG.timezone, 'yyyy/MM/dd HH:mm:ss');
    var total     = calcTotal(data.items);

    // 単価テーブルを作成
    var allItems = [];
    var s;
    for (s = 0; s < MENU_SECTIONS.length; s++) {
      for (var n = 0; n < MENU_SECTIONS[s].items.length; n++) {
        allItems.push(MENU_SECTIONS[s].items[n]);
      }
    }

    // 品目ごとに1行ずつ追記
    for (var i = 0; i < data.items.length; i++) {
      var item  = data.items[i];
      var price = 0;
      for (var k = 0; k < allItems.length; k++) {
        if (allItems[k].name === item.name) { price = allItems[k].price; break; }
      }
      var subtotal = price * item.qty;
      sheet.appendRow([
        orderNum,
        orderDate,
        data.name,
        data.phone,
        item.name,
        item.qty,
        subtotal,
        i === 0 ? total : '',
        i === 0 ? '受付済' : '',
        false  // できあがり（チェックボックス）
      ]);
      // 追加した行のできあがり列にチェックボックスを設定
      var lastRow = sheet.getLastRow();
      sheet.getRange(lastRow, 10).insertCheckboxes();
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

function getOrCreateSheet() {
  var ss    = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  var sheet = ss.getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.sheetName);
    var headers = [
      '注文番号', '受付日時', '氏名', '電話番号',
      '品名', '個数', '小計(円)', '合計(円)', 'ステータス', 'できあがり'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
         .setFontWeight('bold')
         .setBackground('#fed7aa');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(6, 300);
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
