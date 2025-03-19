/*
 * このresearch_groundというexpress appは以下のようにして
 * 適切な設定ファイルを引数としてわたして作ります。
 * const config = require('./config.json');
 * const research_ground = await require('./research-ground')(config);
 * awaitを使うのでasyncな関数で囲まれた場所でやって下さい。
 * 単体でアプリですが、他のアプリにマウントさせて使うこともできます。
 */

const path = require('path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { MongoClient } = require('mongodb');
const i18n = require('i18n');

// このモジュールの使い方は
// ...
// const config = require('./config.json');
// const research_ground = await new require('./research-ground')(config);
// const app = express();
// app.use('/',research_ground);
// ...
// という感じでやります
const init = async function(config_obj) {
  this.config = config_obj;

  // idをWebIDに変換する関数が設定されてなければ以下の
  // 関数で処理する。(かなり適当)
  if (!config.identity.id2webid) {
    config.server.id2webid = function(id) {
      const hostname = config.auth.issuer.match(/^https:\/\/([^\/]+).*$/)[1];
      return 'https://'+hostname+'/people/'+id;
    };
  }
  // WebIDをidに変換する関数が設定されてなければ以下の
  // 関数で処理する。この関数でnullが返される場合には
  // ログインが許可されない。
  if (!config.server.webid2id) {
    config.server.webid2id = function(webid) {
      const m = webid.match(/^.*\/([^\/]+)#[^#]+$/);
      if (!m) return null;
      return m[1];
    };
  }
  // idに応じてディレクトリの階層を決定する関数
  // (デフォルト実装は階層化しないという実装)
  if (!config.identity.classifier) {
    config.identity.classifier = function(id) {
      return '/';
    };
  }

  // MongoDBのクライアントを初期化しDBを取得し
  // 各種collectionを用意。DB名は'research_ground'の決め打ち
  const mongo_client = new MongoClient('mongodb://127.0.0.1:27017',{
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  await mongo_client.connect();
  const db = mongo_client.db('research_ground');
  this.colActions = await db.collection('actions');
  this.colCourses = await db.collection('courses');
  this.colTeachers = await db.collection('teachers');
  this.colAssistants = await db.collection('assistants');
  this.colStudents = await db.collection('students');
  this.colExcercises = await db.collection('excercises');
  this.colMarks = await db.collection('marks');
  this.colFeedbacks = await db.collection('feedbacks');

  this.observer = await require('./observer')(this);
  this.files_app = await require('./files_app')(this);
  this.auth = await require('./auth')(this);
  this.admin = await require('./admin')(this);
  this.marking = await require('./marking')(this);
  this.progress = await require('./progress')(this);

  const app = express();

  app.set('view engine','ejs');
  app.set('views',path.join(__dirname,'views'));

  i18n.configure({
    locales: ['en', 'ja'],
    directory: path.join(__dirname,'locales')
  });
  app.use(i18n.init);

  app.use(session({
    secret: config.server.session.secret,
    resave: false,
    saveUninitialized: false,
    httpOnly: true,
    secure: true,
    cookie: { maxAge: config.server.session.maxAge }
  }));

  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));

  app.use('/auth',this.auth);

  app.use('/files',this.files_app);

  app.use('/admin',this.admin);

  app.use('/marking',this.marking);

  app.use('/progress',this.progress);

  app.get('/', (req, res) => {
    let str;
    if (!!req.session && !!req.session.webid) {
      str = `You are logged in as ${req.session.webid}.`;
    } else {
      str = 'You are not logged in.';
    }
    res.render('index.ejs',{
      msg: str,
      baseUrl: config.server.mount_path,
      admin: req.session.admin,
      teacher: req.session.teacher,
      sa: req.session.sa
    });
  });

  return app;
};

module.exports = init;

