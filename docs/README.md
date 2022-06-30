
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

あとで検証したいと思うけどMongoDBにはcappedコレクションという
機能があって、コレクションのデーター容量に制限が付けられる。
mongoのCUIでは以下のようにすれば作れるらしい。

    db.createCollection('logs', {capped: true, size: 1048576})

上の`size: 1048576`は1MByteの上限設定、maxオプションを使えば
ドキュメントの個数で上限設定できるらしい。さらにデーターを
時間で有効期限切れ(TTL)にするインデックスも利用できるらしい。
整理しなおそう。

* このシステムで扱う科目
    + Collection name: courses
    + 科目ID
        - 「科目CD(大学で決めてるやつ)_クラス」と入力するべし
        - 「`_クラス`」は複数クラス展開している場合区別する文字列
        - 例「`E1066_ksaito`」
    + 科目名
        - 複数クラス展開してる場合は区別できるようにすると吉。
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
    + 本当は学生の状態も色々管理したいけど、とりあえずやめとく
    + format: `{ account: 's202099999', course: 'E1066_ksaito' }`
* 課題情報
    + Collection name: excercises
    + (自動で付けられるID これは使わないことにする)
    + 何の科目の課題か
    + ラベル
        + 半角英数で10文字ぐらいの文字列を推奨。
          記号は、アンダーバー、ハイフンぐらいに
          しといて欲しい。
        + この文字列で辞書順にソートすると自然な
          順番(出題順など)に並ぶようにすること推奨
        + 例えば「map01_02」など
    + 課題の出題場所のURL
    + 課題の提出場所のパス
        - https://...../research-ground/files/ の後に、
          classifier関数で計算される学生ごとのパスを連結して、
          その後に続くパス
        - 例えば「`/map/01/map01_01.html`」など
    + 配点(最高点数。原則、0:未提出,1:不完全,2:合格、にしたい)
    + 重み(難易度。あった方良いと思う)
    + カテゴリ(任意の文字列)
        - 必須課題、応用課題とかを意図。
    + メモ(説明とか。本当に任意)
    + format: `{ _id: '???', course: 'E1066_ksaito', label: 'map01_01', question: 'https://s314.do-johodai.ac.jp/map/01/map01_01.html', submit: '/map/01/map01_01.html', category: '必須', point: 2, weight: 5, memo:'' }`
* 評価(採点)の管理(課題と学生の組に対して)
    + Collection name: marks
    + 自動で付けられるID
    + 評価対象の課題の科目ID
    + 評価対象の課題のラベル
    + 学生アカウント
    + 課題の状態(未提出:unsubmitted、提出:submitted、採点済み:marked、再提出:resubmitted、削除:remoed)
    + 評価(現在の評価。0以上、配点以下)
    + 過去のフィードバック(コメント)の配列(消さないで蓄積して残しておきたい)
    + format: `{ _id: '???', course: 'E1066_ksaito', label: 'map01_01', student: 's202099999', status: 'submitted', mark: 2, feedbacks: ['', '○△□ができていません。']  }`
* フィードバック(コメント)の管理
  (フィードバックの文章を使い回すための物)
    + Collection name: feedbacks
    + 自動で付けられるID
    + 対象とする課題のID
    + フィードバック(コメント)の文面
    + 採用回数
    + format: `{ _id: '???', course: 'E1066_ksaito', label: 'map01_01', feedback: '○△□ができていません。', count: 2 }`

-----

メモ：今ちらっと調べたら出てきたのでメモ。Mongodbで
自動で付けられる_idというフィールドはObjectIDというやつで
文字列ではないらしい。なので検索する時とかは文字列のままでは
検索できなくて以下のようにしないといけないらしい。

    const ObjectID = require('mongodb').ObjectID;
    const oid = new ObjectID('507f1f77bcf86cd799439011');

でも、まだ試していない。

-----

2020,09/26: 課題の情報の入力は実際にはWebのUI使わずに以下の
JavaScriptで入れた。一旦入れて採点始めたら不用意に消すと、
`_id`の情報が書き変わってダメになるので注意。ただ色々参考に
なるはずなので、ここにコピペして残しておく。

    use research_ground;
    // wは課題の重みのデータ(基本、応用、総合の区別にもなる)
    let w = {
      '1':[3,2,3,2],
      '2':[3,3,2,2],
      '3':[3,2,3,2],
      '4':[3,3,2,2],
      '5':[3,3,2,2],
      '6':[3,3,2,2],
      '7':[3,3,2,2],
      '8':[3,3,2,2],
      '9':[3,3,2,2],
      '10':[3,3,2,2],
      '11':[3,3,2,2],
      '12':[3,3,2,2],
      '13':[6,6,6,6] // 総合課題
    };
    // 既存のデーター消すなら
    db.excercises.remove({course: 'E1066_ksaito'}); // 宮西先生なら E1066_miyanishi
    // 自動で課題のデーターを入れるなら
    use research_ground;
    for (let i=1;i<=13;i++) {
      let no = ('00'+i).slice(-2);
      for (let j=1;j<=4;j++) {
        let sub_no = ('00'+j).slice(-2);
        db.excercises.insert({
          label: `map${no}_${sub_no}`,
          course: 'E1066_ksaito', // 宮西先生なら E1066_miyanishi
          no,
          sub_no,
          question: `https://s314.do-johodai.ac.jp/map/task${no}-${sub_no}.html`,
          submit: `/map/${no}/${no}-${sub_no}.html`,
          category: ((w[i][j-1]===3)?'基本':(w[i][j-1]===2)?'応用':'総合'),
          point: 2,
          weight: w[i][j-1],
          memo:''
        });
      }
    }

ただし、01-02の課題は、例外的に提出ファイルが01-02-01.htmlなので、
そこは手動でUIで変更すべし。

以下もUI使わずにmongoコマンド中のJavaScriptで使えるTips

    const ObjectID = require('mongodb').ObjectID;
    use research_ground;
    // 履修者を一人追加(コースが`E1066_ksaito`、アカウントが`s202099999`)
    db.students.insert({account: 's202099999', course: 'E1066_ksaito' });
    // 履修者を一人削除(コースが`E1066_ksaito`、アカウントが`s202099999`)
    db.students.remove({account: 's202099999', course: 'E1066_ksaito' });
    // 課題の状態を変更するにはまず、課題の`_id`を抽出
    let e = db.excercises.find({label: 'map01_01', course: 'E1066_ksaito' });
    // そして学生s202099999の学生の課題提出を書き換える。以下のsubmittedは
    // 状態である。状態に入れられるのはunsubmitted, submitted, marked, resubmittedのみ
    // もし、条件に合うmarkが見付からない場合は何もしない。
    db.marks.update({ excercise: e._id, student: 's202099999' },{ status: 'submitted' });
    // 合格してるのに，「合格です。」以外のコメントが付いている場合，
    // 学生と課題とコメントを表示。(自分のクラスだけ)
    let es = db.excercises.find({},{_id:1,label:1,course:1}).toArray();
    let ms = db.marks.find({mark:'2'},{excercise:1,student:1,feedbacks:1,_id:0}).toArray();
    for (let m of ms) {
      if (m.feedbacks.length >= 1) {
        let fb = m.feedbacks[m.feedbacks.length-1];
        if (fb!=="" && fb!="合格です。") {
          for (let e of es) {
            if (e.course!=='E1066_ksaito')
              continue;
            if (e._id.equals(m.excercise)) {
              print(m.student,e.label,fb);
              break;
            }
          }
        }
      }
    }

-----

2020,10/22: 特集なマネージメントのための裏技を実装。

* 採点画面で、学生の提出課題と、出題ページを自動で表示させる
  機能を一時停止する方法として、そのページを開くURLのクエリ
  文字列に`&preventopen=true`を追加するという方法を採用。つまり、
  以下のようなアドレスでページを開けばOK。
    + <https://s314.do-johodai.ac.jp/research-ground/marking/marking?course=E1066_ksaito&label=map03_02&student=s201921999&preventopen=true>
    + なんでこの機能を付けたのかというと、学生の出した課題が
      バグっていて開くと固まるやつがあったから。
* 課題の進み具合のページ(progressのページ)は、基本的に
  ログイン中のアカウントに関する情報を表示するのだが、
  そのページを開くURLのクエリ文字列に`uid=??????????`を
  追加することで他のユーザーの情報を表示させられる。
  ただし、システム管理者のみ。

2022,05/02: 課題(excercise)を参照する時に、MongoDBが
自動に付けるIDではなく、courseとlabelを使用するように
変更する。さらに、excerciseにnoとsubnoというのが
あったけど使ってないので削除。

2022,06/30: データを書き換える必要が出てきた。これを機に
DBの構造を整理して書いておこう。

    > use research_ground;
    > show collections;
    actions
    assistants
    courses
    excercises
    feedbacks
    marks
    students
    teachers
    > db.actions.findOne({});
    {
            "_id" : ObjectId("626f871e60f0040fdeb6509d"),
            "type" : "login",
            "utime" : 1651476254634,
            "uid" : "s202231929"
    }
    > db.assistants.findOne({});
    {
            "_id" : ObjectId("629c4a225aef86160cdfb322"),
            "account" : "s201921020",
            "course" : "E1127_1"
    }
    > db.courses.findOne({});
    {
            "_id" : ObjectId("629c496f5aef86160cdfb2dd"),
            "id" : "E1127_1",
            "name" : "HTMLコーディング演習(斎藤一先生-月)"
    }
    > db.excercises.findOne({});
    {
            "_id" : ObjectId("629c4b05db1979b1b319dc16"),
            "label" : "hcp01_00",
            "category" : "必須",
            "question" : "https://s314.do-johodai.ac.jp/hcp/",
            "submit" : "/html/chap01/start.html",
            "point" : 3,
            "weight" : 3,
            "memo" : "上手く提出できてるか自分でも確認すること",
            "course" : "E1127_1"
    }
    > db.feedbacks.findOne({}); // 以下の例はcourse,labelともnullで最初ダメだった時のデータ
    {
            "_id" : ObjectId("62a7e7da1bc8eb02e49e72e0"),
            "course" : null,
            "label" : null,
            "feedback" : "リスト（箇条書き）のタグは<li>です。SAさんに確認してもらって修正しましょう。",
            "count" : 1
    }
    > db.marks.findOne({});
    {
            "_id" : ObjectId("62a6eb2938fb4902e780a6b0"),
            "course" : "E1127_1",
            "label" : "hcp01_00",
            "student" : "s201921184",
            "status" : "marked",
            "mark" : "3",
            "feedbacks" : [
                    ""
            ]
    }
    > db.students.findOne({});
    {
            "_id" : ObjectId("629c4cbbd2437a769216c6ea"),
            "account" : "s201622028",
            "course" : "E1127_1"
    }
    > db.teachers.findOne({});
    {
            "_id" : ObjectId("629c49e05aef86160cdfb300"),
            "account" : "f200188011",
            "course" : "E1127_1"
    }

2022,07/01: DBの構造を整理した所で、今回の依頼を整理。

* 課題`hcp03_03_02`を削除。
* 課題`hcp03_03_03`を`hcp03_03_01`に改名。
  さらに重みを1から1.5に変更。
* 課題`hcp03_03_04`を`hcp03_03_02`に改名。
  さらに重みを1から1.5に変更。

これ、この前にやった変更が裏目に出る結果になっちゃってて、
学生が課題を提出してたり、採点されてたり、フィードバック
コメントが保存されるようなことが大量に起ってからだったら
面倒なことになっていた。でも、1人の学生がfaculty.htmlと
contact.htmlの2つの課題を提出して、数分後にすぐに消した
という記録だけが残っていた。無視してもいいレベルなので、
課題のデータをちょろっと書き換えて終りでも良いのだが、
ここは完全に変更しておこう。

まずは、念のため以下のクエリで確認。

    > db.feedbacks.find({label: 'hcp03_03_02'});
    > db.feedbacks.find({label: 'hcp03_03_03'});
    > db.feedbacks.find({label: 'hcp03_03_04'});
    > db.marks.find({label: 'hcp03_03_02'});
    > db.marks.find({label: 'hcp03_03_03'});
    { "_id" : ObjectId("62bd4c4b7a9cba3a4c130ff9"), "course" : "E1127_4", "label" : "hcp03_03_03", "student" : "s202221238", "status" : "removed", "mark" : 0, "feedbacks" : [ ] }
    > db.marks.find({label: 'hcp03_03_04'});
    { "_id" : ObjectId("62bd4c4b7a9cba3a4c130ffa"), "course" : "E1127_4", "label" : "hcp03_03_04", "student" : "s202221238", "status" : "removed", "mark" : 0, "feedbacks" : [ ] }

想定通り。ということは以下のコマンドで終り。

    > db.excercises.remove({label:'hcp03_03_02'});
    WriteResult({ "nRemoved" : 4 })
    > db.excercises.update({label:'hcp03_03_03'},{$set: {label:'hcp03_03_01'}},{multi:true});
    WriteResult({ "nMatched" : 4, "nUpserted" : 0, "nModified" : 4 })
    > db.excercises.update({label:'hcp03_03_01'},{$set: {weight:1.5}},{multi:true});
    WriteResult({ "nMatched" : 4, "nUpserted" : 0, "nModified" : 4 })
    > db.excercises.update({label:'hcp03_03_04'},{$set: {label:'hcp03_03_02'}},{multi:true});
    WriteResult({ "nMatched" : 4, "nUpserted" : 0, "nModified" : 4 })
    > db.excercises.update({label:'hcp03_03_02'},{$set: {weight:1.5}},{multi:true});
    WriteResult({ "nMatched" : 4, "nUpserted" : 0, "nModified" : 4 })
    > db.marks.update({label:'hcp03_03_03'},{$set: {label:'hcp03_03_01'}},{multi:true});
    WriteResult({ "nMatched" : 1, "nUpserted" : 0, "nModified" : 1 })
    > db.marks.update({label:'hcp03_03_04'},{$set: {label:'hcp03_03_02'}},{multi:true});
    WriteResult({ "nMatched" : 1, "nUpserted" : 0, "nModified" : 1 })

全て想定通り。admin.jsを確認したら課題のlabelやweightの変更は
WebのGUIでも可能ではあったけど、ソース確認しないと自信が持て
ないようじゃ、使えないなぁ。

