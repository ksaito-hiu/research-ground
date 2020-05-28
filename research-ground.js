/*
 * このresearch_groundというexpress appは以下のようにして
 * 適切な設定ファイルを引数としてわたして作ります。
 * const config = require('./config.json');
 * const research_ground = await require('./research-ground')(config);
 * awaitを使うのでasyncな関数で囲まれた場所でやって下さい。
 * 単体でアプリですが、他のアプリにマウントさせて使うこともできます。
 */

const express = require('express');
const session = require('express-session');
const { MongoClient } = require('mongodb');

const init = async function(config) {
  const files_app = await require('./files_app')(config);
  const auth = await require('./auth')(config);
  auth.set_files_app(files_app);

  // MongoDBのクライアントを初期化
  const mongo_client = new MongoClient('mongodb://127.0.0.1:27017',{
    useNewUrlParser: true,
    useUnifiedTopology: true
  });
  await mongo_client.connect();

  // 上で初期化したMongoDBのクライアントを使い回す
  await files_app.set_mongo_client(mongo_client);
  await auth.set_mongo_client(mongo_client);

  const app = express();

  app.set('view engine','ejs');
  app.set('views',config.server.views);

  app.use(session({
    secret: config.server.session.secret,
    resave: false,
    saveUninitialized: false,
    httpOnly: true,
    secure: true,
    cookie: { maxAge: config.server.session.maxAge }
  }));

  app.use('/auth',auth);

  app.use('/files',files_app);

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

