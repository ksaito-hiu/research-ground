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

const init = async function(config) {
  // idをWebIDに変換する関数が設定されてなければ以下の
  // 関数で処理する。(かなり適当)
  if (!config.identity.id2webid) {
    config.server.id2webid = function(id) {
      const hostname = config.auth.issuer.match(/^https:\/\/([^\/]+).*$/)[1];
      return 'https://'+hostname+'/people/'+id+'#me';
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
  // ファイル提出を検知して処理するための関数
  if (!config.files.hook) {
    config.files.hook = function(path,uid,utime) {
      // do nothing.
    };
  }

  const files_app = await require('./files_app')(config);
  const auth = await require('./auth')(config);
  auth.set_files_app(files_app);
  const admin = await require('./admin')(config);
  const marking = await require('./marking')(config);
  const progress = await require('./progress')(config);

  // MongoDBのクライアントを初期化
  const mongo_client = new MongoClient('mongodb://127.0.0.1:27017',{
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  await mongo_client.connect();

  // 上で初期化したMongoDBのクライアントを使い回す
  await files_app.set_mongo_client(mongo_client);
  await auth.set_mongo_client(mongo_client);
  await admin.set_mongo_client(mongo_client);
  await marking.set_mongo_client(mongo_client);
  await progress.set_mongo_client(mongo_client);

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

  app.use('/auth',auth);

  app.use('/files',files_app);

  app.use('/admin',admin);

  app.use('/marking',marking);

  app.use('/progress',progress);

  app.get('/', (req, res) => {
    let str;
    if (!!req.session && !!req.session.webid) {
      str = `You are logged in as ${req.session.webid}.`;
    } else {
      str = 'You are not logged in.';
    }
    res.render('index.ejs',{msg:str,baseUrl:config.server.mount_path});
  });

  return app;
};

module.exports = init;

