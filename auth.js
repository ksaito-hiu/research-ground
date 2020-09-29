const express = require('express');
const { Issuer, generators } = require('openid-client');

const router = express.Router();

const init = async function(rg) {
  // 上記引数のrgはresearch-groundのインスタンス。rg.configで設定、
  // rg.colCoursesなどでMongoDBのcollectionにアクセスできる。

  let tryCount = 0;
  let client = null;
  const initClient = async function() {
    try {
      const issuer = await Issuer.discover(rg.config.auth.issuer);
      client = new issuer.Client({
        client_id: rg.config.auth.client_id,
        client_secret: rg.config.auth.client_secret,
        redirect_uris: rg.config.auth.redirect_uris,
        response_types: ['code'],
      });
    } catch(err) {
      console.log(`Cannot search openid-op at ${rg.config.auth.issuer}. (tryCount=${tryCount})`);
      tryCount++;
      let t = 1000*tryCount*tryCount;
      t = t>10*60*1000?10*60*1000:t;
      setTimeout(initClient,t);
    }
  }
  await initClient();

  router.get('/login',(req,res)=>{
    const code_verifier = generators.codeVerifier();
    const code_challenge = generators.codeChallenge(code_verifier);
    req.session.local_code_verifier = code_verifier;
    req.session.return_path = req.query.return_path;

    const params = {
      scope: 'openid',
      code_challenge,
      code_challenge_method: 'S256'
    };
    let goToUrl = client.authorizationUrl(params);
    res.redirect(goToUrl);
  });

  router.get('/callback', async (req, res) => {
    var params = client.callbackParams(req);
    var code_verifier = req.session.local_code_verifier;
    const baseUrl = rg.config.server.mount_path;
    try {
      const tokenSet = await client.callback(rg.config.auth.redirect_uris[0], params, { code_verifier });
      req.session.id_tokenX = tokenSet.id_token;
      const webid = tokenSet.claims().sub;
      const uid = rg.config.identity.webid2id(webid);
      if (!uid) {
        const msg = 'You do not have permission to login this server.';
        res.render('error.ejs', {
            msg, baseUrl,
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
        teacher: req.session.teacher,
        sa: req.session.sa
      });
    } catch(err) {
      const msg = err.toString();
      res.render('error.ejs', {
        msg, baseUrl,
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
    res.clearCookie('webid');
    res.clearCookie('uid');
    res.clearCookie('admin');
    res.clearCookie('teacher');
    res.clearCookie('sa');
    const theUrl = client.endSessionUrl(params);
    res.redirect(theUrl);
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
      teacher: req.session.teacher,
      sa: req.session.sa
    });
  });

  return router;
};

module.exports = init;
