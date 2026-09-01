const express = require('express');

const router = express.Router();

const init = async function(rg) {
  // 上記引数のrgはresearch-groundのインスタンス。rg.configで設定、
  // rg.colCoursesなどでMongoDBのcollectionにアクセスできる。

  // openid-client v6はESM専用パッケージなのでdynamic importで読み込む
  const oidc = await import('openid-client');

  let tryCount = 0;
  let config = null; // openid-clientのConfigurationインスタンス
  const initClient = async function() {
    try {
      const server = new URL(rg.config.auth.issuer);
      const metadata = {
        id_token_signed_response_alg: 'ES256',
      };
      // 従来(openid-client v5)のデフォルト認証方式(client_secret_basic)を踏襲
      const clientAuth = oidc.ClientSecretBasic(rg.config.auth.client_secret);
      config = await oidc.discovery(server, rg.config.auth.client_id, metadata, clientAuth);
    } catch(err) {
      console.log(`Cannot search openid-op at ${rg.config.auth.issuer}. (tryCount=${tryCount})`);
      console.log("GAHA: **************",err);
      tryCount++;
      let t = 1000*tryCount*tryCount;
      t = t>10*60*1000?10*60*1000:t;
      setTimeout(initClient,t);
    }
  }
  await initClient();

  router.get('/login', async (req,res)=>{
    const code_verifier = oidc.randomPKCECodeVerifier();
    const code_challenge = await oidc.calculatePKCECodeChallenge(code_verifier);
    req.session.local_code_verifier = code_verifier;
    req.session.return_path = req.query.return_path;

    const params = {
      redirect_uri: rg.config.auth.redirect_uris[0],
      scope: 'openid',
      code_challenge,
      code_challenge_method: 'S256'
    };
console.log('GAHA: config: ',config);
    const goToUrl = oidc.buildAuthorizationUrl(config, params);
    res.redirect(goToUrl.href);
  });

  router.get('/callback', async (req, res) => {
    // redirect_uriは/loginで使ったのと同じ設定値(rg.config.auth.redirect_uris[0])を
    // 基準にする。req.protocol/req.get('host')から組み立てると、リバースプロキシ
    // 配下でtrust proxyが未設定の場合にスキーム(http/https)がずれ、
    // authorizationCodeGrant()内部でredirect_uriとして送られる値
    // (currentUrlのorigin+pathname、クエリ除く)が認可リクエスト時と食い違って
    // 「authorization code redirect_uri mismatch」になる。
    const currentUrl = new URL(rg.config.auth.redirect_uris[0]);
    const queryIndex = req.originalUrl.indexOf('?');
    currentUrl.search = queryIndex === -1 ? '' : req.originalUrl.slice(queryIndex);
    const code_verifier = req.session.local_code_verifier;
    const baseUrl = rg.config.server.mount_path;
    try {
      const tokenSet = await oidc.authorizationCodeGrant(config, currentUrl, { pkceCodeVerifier: code_verifier });
      req.session.id_tokenX = tokenSet.id_token;
      const webid = tokenSet.claims().sub;
      const uid = rg.config.identity.webid2id(webid);
      if (!uid) {
        const msg = 'You do not have permission to login this server.';
        res.render('error.ejs', {
            msg, baseUrl,
            admin: req.session.admin,
            teacher: req.session.teacher,
            sa: req.session.sa
        });
        return;
      }
      let admin,teacher,sa;
      if (rg.config.admin.includes(webid)) admin=true; else admin=false;
      let r = await rg.colTeachers.findOne({account:uid});
      if (r) teacher=true; else teacher=false;
      r = await rg.colAssistants.findOne({account:uid});
      if (r) sa=true; else sa=false;
      req.session.webid = webid;
      req.session.uid = uid;
      req.session.admin = admin
      req.session.teacher = teacher;
      req.session.sa = sa;
      res.cookie('webid', webid, {maxAge: rg.config.server.session.maxAge });
      res.cookie('uid', uid, {maxAge: rg.config.server.session.maxAge });
      res.cookie('admin', admin, {maxAge: rg.config.server.session.maxAge });
      res.cookie('teacher', teacher, {maxAge: rg.config.server.session.maxAge });
      res.cookie('sa', sa, {maxAge: rg.config.server.session.maxAge });
      const utime = new Date().getTime();
      await rg.colActions.insertOne({type:'login',utime,"uid":uid});

      // ログインが成功したらファイルの提出場所が存在するかチェックして
      // 無ければ作成する。
      await rg.files_app.checkDir(uid);
      
      let ret = req.session.return_path;
      if (!ret) {
        ret = rg.config.server.mount_path;
      }
      res.render('auth/loggedin.ejs', {
        webid, ret, baseUrl,
        admin: req.session.admin,
        teacher: req.session.teacher,
        sa: req.session.sa
      });
    } catch(err) {
      const msg = err.toString();
      res.render('error.ejs', {
        msg, baseUrl,
        admin: req.session.admin,
        teacher: req.session.teacher,
        sa: req.session.sa
      });
    }
  });

  router.get("/logout", (req, res) => {
    let params;
    if (req.session.id_tokenX != undefined) {
      params = {
        post_logout_redirect_uri: rg.config.auth.post_logout_redirect_uri,
        id_token_hint: req.session.id_tokenX,
      };
    } else {
      params = {};
    }
    req.session.webid = null;
    req.session.uid = null;
    req.session.admin = null;
    req.session.teacher = null;
    req.session.sa = null;
    res.clearCookie('webid');
    res.clearCookie('uid');
    res.clearCookie('admin');
    res.clearCookie('teacher');
    res.clearCookie('sa');
    const theUrl = oidc.buildEndSessionUrl(config, params);
    res.redirect(theUrl.href);
  });
  router.get("/", (req, res) => {
    let msg;
    if (!!req.session && !!req.session.webid) {
      msg = `You are logged in as ${req.session.webid}.`;
    } else {
      msg = 'You are not logged in.';
    }
    const baseUrl = rg.config.server.mount_path;
    res.render('auth/auth.ejs', {
      msg, baseUrl,
      admin: req.session.admin,
      teacher: req.session.teacher,
      sa: req.session.sa
    });
  });

  return router;
};

module.exports = init;
