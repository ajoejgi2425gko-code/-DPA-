ディズニーDPA販売終了予測ツール（公開用・データ分離版）

このZIPはGitHub Pagesで公開する一般ユーザー向けの画面です。一般ユーザー画面に手入力・管理・インポート機能はありません。全利用者は data/dpa-history.json の同じデータを参照します。

【GitHub Pagesへの配置】
1. ZIPを展開します。
2. index.html、app.js、sw.js、manifest.json、iconsフォルダ、dataフォルダをGitHubリポジトリの公開ルートへアップロードします。
3. GitHubの Settings > Pages で公開設定を行います。
4. 公開後にURLを開いて動作確認します。既に同じアプリをインストール済みの場合、更新が反映されるまで再読み込みまたは少し時間がかかることがあります。

【定期データ更新の方法（手入力不要）】
1. このZIP内の data/dpa-history.json を更新の基準ファイルとして保管してください。
2. 更新をChatGPTに依頼する際は、最新版の data/dpa-history.json を会話に添付してください。
3. 次の文をそのまま使えます。

「添付した dpa-history.json を基準に、2026年○月○日から○月○日までの東京ディズニーランド／シーのDPA販売終了公開記録を調査して更新してください。TDR Waits、TDR Insight、TDR+、夢待ちびより等の公開情報を確認し、取得できた日付別記録を一括で追加してください。各記録に日付、パーク、施設ID、状態、確認時刻、出典URL、確認日、データ種別を付けてください。既存記録を保持し、重複を除外し、実測・集計・推定を明確に区別してください。日付別記録として確認できない集計値を実測記録に変換しないでください。更新後の dpa-history.json をダウンロードできるファイルとして作成し、追加件数、重複除外件数、出典別件数、取得できなかった期間、変更点を報告してください。実際に確認できなかった値を捏造しないでください。」

4. ChatGPTが作成した更新版 data/dpa-history.json を、このリポジトリの同じ場所にアップロードして置き換え、GitHubへコミットします。
5. 公開画面はその共通JSONを読み込むため、次回表示時に利用者全員へ同じデータが配信されます。GitHubへの反映操作自体は必要ですが、個々の記録を手入力する必要はありません。

【重要な制約】
- GitHub Pagesは静的ホスティングです。ツール自体が勝手に外部サイトを定期巡回し、GitHub上のファイルを書き換えることはできません。自動巡回・自動公開まで行うには、別途バックエンドや認証付きの自動処理が必要です。
- 公開サイトの履歴は期間や形式が異なり、すべての日付・施設のデータを取得できる保証はありません。確認できない値を補完しません。
- 初期同梱の aggregateBenchmarks は公開ページで確認できた集計値であり、日付別の実測データではありません。売り切れ確率の計算には使いません。
- 売り切れ確率は、販売終了日と閉園まで販売があった日の両方の日付別記録が十分に揃うまで表示されません。
- DPAの販売状況・対象施設は変更されます。購入可能性や予測精度は保証しません。公式アプリを優先してください。

【データ項目】
records: date, park (tdl/tds), attractionId, status (sold_out/available_close/not_offered/not_observed/closed), selloutTime, lastAvailableAt, firstUnavailableAt, crowdIndex, sourceType (observed/aggregate/estimated), sourceUrl, sourceName, observedAt, note
aggregateBenchmarks: park, attractionId, kind, value, sampleDays, sourceName, sourceUrl, observedAt, sourceType

【参照先】
公式DPA: https://www.tokyodisneyresort.jp/tdr/guide/app_service/disneypremieraccess.html
TDR Waits: https://tdr-waits.com/dpa
TDR Insight TDL: https://www.tdrinsight.com/pass-guide?park=tdl
TDR Insight TDS: https://www.tdrinsight.com/pass-guide?park=tds
TDR+: https://tdr-plus.com/dpa.html
夢待ちびより: https://yume-biyori.com/waits/dpa/
