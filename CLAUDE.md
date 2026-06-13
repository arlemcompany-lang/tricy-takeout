# CLAUDE.md — テイクアウトGAS

## プロジェクト概要
焼き鳥屋「Tricy」のテイクアウト注文フォームシステム。  
GitHub Pages でフォームを公開し、Google Apps Script をバックエンドAPIとして使う構成。

## URL
| 用途 | URL |
|------|-----|
| 注文フォーム（公開） | https://arlemcompany-lang.github.io/tricy-takeout/ |
| GitHubリポジトリ | https://github.com/arlemcompany-lang/tricy-takeout |
| スプレッドシート | https://docs.google.com/spreadsheets/d/1775-dNoJPgRZJRbW2g4rV18K3Tmma0suRaxp4PdQNmw |

## ファイル構成
| ファイル | 役割 |
|---------|------|
| `index.html` | GitHub Pages 用フロントエンド（注文フォーム） |
| `Code.gs` | GAS ウェブアプリ（注文受付・スプレッドシート記録・メール送信） |
| `Form.html` | 旧GAS HTMLService版（参照用、未使用） |

## アーキテクチャ
```
お客様
  ↓ フォーム入力
GitHub Pages (index.html)
  ↓ POST (JSON)
Google Apps Script (Code.gs) ← ウェブアプリとしてデプロイ
  ├─ スプレッドシートに記録
  ├─ お客様へ注文確認メール送信
  └─ 店舗へ新規注文通知メール送信
```

## GAS設定
| 項目 | 値 |
|------|-----|
| デプロイURL | `https://script.google.com/macros/s/AKfycbznFbRd69T11dH3KwMg3J21iLgDK54K6dCUrgHxkghhcmwowlnDjLA_VoLIL-mzhGo72A/exec` |
| 実行者 | 自分 |
| アクセス | 全員（匿名ユーザーを含む） |
| スプレッドシートID | `1775-dNoJPgRZJRbW2g4rV18K3Tmma0suRaxp4PdQNmw` |
| 店舗メール | `arlem.company@gmail.com` |

## スプレッドシート構成
シート名：**注文一覧**

| 列 | 項目 | 備考 |
|----|------|------|
| A | 注文番号 | T + タイムスタンプ（例: T20260613134114） |
| B | 受付日時 | yyyy/MM/dd HH:mm:ss |
| C | 氏名 | |
| D | 電話番号 | |
| E | メール | |
| F | 品名 | 品目ごとに1行 |
| G | 個数 | |
| H | 小計(円) | |
| I | 合計(円) | 注文の先頭行のみ |
| J | ステータス | 注文の先頭行のみ（受付済） |
| K | できあがり | チェックボックス（手動） |

## スプレッドシートのカスタムメニュー（完成メール下書き）
スプレッドシートに「拡張機能 → Apps Script」から別スクリプトを設置済み。  
全品目できあがり後、注文の行を選択して **「Tricy → 完成メールの下書きを作成」** を実行すると、  
Gmailの下書きにお客様宛メールが自動追加される。

> 注意：スクリプトを実行したGoogleアカウントのGmailに下書きが入る。

## メニュー
### 霧島鶏のやきとり（200円/本）
ねっく / ぼんじり / ねぎま / なんこつ / レバー / かわ / はつ / つくね / 砂肝 / ささみ

### 野菜巻き（250円/本）
万ねぎ / アスパラ / ピーマンチーズ / トマト / おもち / まいたけ

### サイドメニュー
| 品名 | 価格 |
|------|------|
| 旨塩からあげ 3個 | 500円 |
| 旨塩からあげ 6個 | 1,000円 |
| カレーのポテサラ | 500円 |
| 鶏なんこつの梅水晶 | 500円 |
| ほくほく 厚切りフライドポテト | 500円 |
| 山芋のわさび漬け | 500円 |
| なすのきんぴら | 500円 |

## index.html の仕様
- ライト＋温かみ系デザイン（白背景・オレンジアクセント）
- メニューは `index.html` 内の `FALLBACK_MENU` を使用（GASからは取得しない）
- 注文送信のみGASにPOST
- スティッキーカートバー（1品追加で表示、バネアニメーション）
- 写真対応：`PHOTOS` オブジェクトにパスを追加するだけで即反映

## GASの再デプロイ手順
1. `Code.gs` をメモ帳で開いてコピー
2. [script.google.com](https://script.google.com) のプロジェクトに貼り付けて保存
3. 「デプロイ」→「デプロイを管理」→ 鉛筆アイコン →「新しいバージョン」→「デプロイ」

## index.html の更新・公開手順
1. `index.html` を編集
2. `git add index.html && git commit -m "..." && git push origin main`
3. 1〜2分後に GitHub Pages へ自動反映
