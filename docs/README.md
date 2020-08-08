
research-ground documentation
========================================

学生の課題提出と教員の採点業務をサポートするWebアプリです。
認証は外部のWebIDのOpenID Connect認証サービスに依存しています。
採点業務の効率化と、学生への最低限のフィードバックを実装するのが
最優先事項。ということで2020,08/08時点の目標とする仕様は以下。

* [x] 学生のファイルアップロード
    + [x] 学生が自分でフォルダを作って授業や単元ごとに
          整理する
    + [ ] 閲覧できるのはアップロードした学生本人と、
          管理者、教員、SAのみ。
    + [ ] 提出や、再提出があった時に、教員に採点が必要で
          あることを報せる仕組み
    + [ ] 提出期限後はアップロードを禁止 (現在実装予定無し)
* [ ] 学生が自分の課題提出状況を確認するためのUI
* [ ] 採点のためのUI
    + [ ] 課題の表示と採点を1画面で可能にするUI
    + [ ] サマリーとか統計情報表示
    + [ ] 採点業務をSAもできるようにしたい
* [ ] 色々な管理
    + [ ] 科目の管理(管理者のみ)
    + [ ] 教員の管理(管理者のみ)
    + [ ] SAの管理(管理者と教員)
    + [ ] 履修者の管理(管理者と教員)
    + [ ] 課題の管理(管理者と教員)
* [ ] データーのバックアップ

管理者とはresearch-ground全体を管理する人のことで、
教員とは科目ごとに設定されて科目の管理しかできない人のこと。

ファイルアップローダー
----------------------------------------

「`アプリのrootのURL/files/`」にアクセスすると一応一通りの
操作ができるUIが表示される。そこで管理しているファイルは
現在の実装では以下のURLで閲覧できる。ただし、これはapp.jsの
中で定義しているid2webid、webid2id、classifier関数によって
調整できるようになっている。現在の実装は情報大学の実情に
合せてあるということ。

* 学生の場合
    + 「`アプリのrootのURL/files/s入学年度/学部学科No/ユーザーID/`」
    + 具体例「`https://s314.do-johodai.ac.jp/research-ground/files/s2020/99/s202099999/`」
    + ユーザーIDは学籍番号の前に「`20`」を付けた物になるので注意
* 教職員の場合
    + 「`アプリのrootのURL/files/faculty/ユーザーID/`」

また「`アプリのrootのURL/files/`」以下ではRESTでファイルを
操作するためのAPIを実装している。まだ十分テストしてないが、
このRESTのAPIを使えば、シングルページアプリケーションで
もっと良いUIが作れると思う。

データーベース
----------------------------------------

データーベースにはMongodbを使ってます。Ubuntuで
`sudo apt install mongodb`とした状態で何も設定せずに
使ってます。

データーベース名は決め打ちで`research_ground`です。
今、とりあえずということで以下の内容で、ファイル
アップローダーに関係するログだけ取っている。

* DB name: research_ground
    + Collection name: actions
        - { type: 'action_type', utime: number_of_unixtime, and more }

でも、ログ大量になりそうなので廃止しようかな。
整理しなおして以下のようにしようかと思っている。

* このシステムで扱う科目
    + Collection name: courses
    + 科目ID
        - 科目CD(大学で決めてるやつ)_クラス
        - クラスは複数クラス展開している場合区別する文字列
    + 科目名
    + format: `{ id: 'E1066_ksaito', name: 'モバイルアプリ演習(齋藤健司クラス)' }`
* 教員アカウント
    + Collection name: teachers
    + 教員アカウントと科目の情報
    + format: `{ account: 'f0088071', course: 'E1066_ksaito' }`
* SAアカウント
    + Collection name: assistants
    + 学生アカウントと科目の情報
    + format: `{ account: 's202099999', course: 'E1066_ksaito' }`
* 履修者アカウント
    + Collection name: students
    + 学生アカウントと科目の情報
    + format: `{ account: 's202099999', course: 'E1066_ksaito' }`
* 課題情報
    + Collection name: excercises
    + 自動で付けられる課題ID
    + 課題の名前
    + 何の科目の課題か
    + 何単元目の課題か
    + 課題の出題場所(URL) 問題が掲載されているURL
    + 課題の提出場所(URL) 学生の提出場所のrootからのpathとファイル名を含むURL
    + 配点(最高点数。原則、0:未提出,1:不完全,2:合格、にしたい)
    + 重み(難易度。あった方良いと思う)
    + format: `{ id: '???', name: '01-01', course: 'E1066_ksaito', unit: 1, question: 'https://....', submit: 'https://...', allocation: 2, weight: 5 }`
* 評価(採点)の管理(課題と学生の組に対して)
    + Collection name: marks
    + 自動で付けられる評価ID
    + 評価対象の課題のID
    + 学生アカウント
    + 課題の状態(未提出:unsubmitted、提出:submitted、採点済み:marked、再提出:resubmitted)
    + 評価(現在の評価。0以上、配点以下)
    + フィードバック(コメント)
    + 過去のフィードバック(消さないで蓄積して残しておきたい)
    + format: `{ id: '???', excercise: '???', student: 's202099999', status: 'submitted', mark: 2, feedback: '(なし)', old_feedback: '○△□ができていません。'  }`
* フィードバック(コメント)の管理
  (フィードバックの文章を使い回すための物)
    + Collection name: feedbacks
    + 自動のID
    + 対象とする課題のID
    + フィードバック(コメント)の文面
    + format: `{ id: '???', excercise: '???' , feedback: '○△□ができていません。' }`

