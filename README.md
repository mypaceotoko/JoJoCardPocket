# Stand Pocket

**今日の運命は、誰のスタンドか。**  
JoJo風ネオン演出のスマホ向けデイリーカードコレクションWebアプリです。

## 概要
- 1日1回、キャラカード1枚とスタンドカード1枚を引ける静的Webアプリ
- GitHub Pagesでそのまま公開可能（ビルド不要）
- API失敗時はローカルフォールバックで継続動作

## 機能
- ホーム / ドロー / コレクション / 履歴 / 設定
- レアリティ: N, R, SR, SSR, UR
- 重複時は初回レアリティ維持 + duplicateCount蓄積
- localStorage保存（デイリー制限、所持カード、履歴）
- 今日の結果をコピー可能

## 使用API
- https://jojos-bizarre-api.netlify.app
- 取得失敗時: `fallback-data.js` を使用

## GitHub Pages公開方法
1. 本リポジトリをGitHubへpush
2. GitHub > Settings > Pages
3. Sourceを `Deploy from a branch` に設定
4. Branchを `main`（または公開ブランチ） + `/root` に設定
5. 数分後に公開URLへアクセス

## ローカル起動方法
- `index.html` をブラウザで開く（または任意の静的サーバーで配信）

## 注意
- 本アプリは**非公式ファンメイド**です。
- キャラクター画像・名称・APIデータ等の権利は各権利者に帰属します。
