# 体重のクラウド保存（設計メモ）

## 決定事項
- 体重はクラウド（Firebase）に保存する。
- ログインは Google アカウントで行う。
- 歩数は引き続き Health Connect から読む（保存しない）。

## 構成
- 認証: Firebase Authentication（Google プロバイダ）。
- 保存: Cloud Firestore。`users/{uid}/weights/{id}` に1件ずつ保存する。
  - フィールド: `kg`（数値、小数2位まで）、`recordedAt`（タイムスタンプ）。
- アプリ起動時に、ログイン済みなら自分の体重を取得して一覧に表示する。
- 未ログインでも記録はできる（端末内の一時保存）。ログイン時に端末内の記録をクラウドへ移す。

## Firestore のルール（案）
```
match /users/{uid}/weights/{id} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

## 機種変時
- 新しい端末で同じ Google アカウントでログインすると、体重が戻る。

## そうちゃんにお願いすること
1. Firebase コンソール（https://console.firebase.google.com）で、Google アカウントを使ってプロジェクトを作成する。
2. Android アプリを登録する。パッケージ名は app.json の値（未設定なら作成時に決める）。
3. Authentication で「Google」を有効にする。
4. 登録時に表示される `google-services.json` を送ってもらう（秘密情報ではないが、リポジトリへの追加は確認してから行う）。
5. Firestore Database を作成する（テストモードは使わず、上のルールを設定する）。

## 実装の順番
1. Firebase の依存を追加し、プロジェクトを接続する（ビルドが必要）。
2. Google ログインの画面とログイン状態の管理。
3. 体重の保存と一覧の読み込み。
4. 端末内の記録をログイン後に移す。
