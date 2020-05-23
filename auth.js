const express = require('express');
const { Issuer, generators } = require('openid-client');
const config = require('./config.json');

const router = express.Router();

(async function() {
  let tryCount = 0;
  let client = null;
  const initClient = async function() {
    try {
      const issuer = await Issuer.discover(config.auth.issuer);
      client = new issuer.Client({
        client_id: config.auth.client_id,
        client_secret: config.auth.client_secret,
        redirect_uris: config.auth.redirect_uris,
        response_types: ['code'],
      });
    } catch(err) {
      console.log('Cannot search openid-op at id.do-johodai.ac.jp. (tryCount='+tryCount+')');
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
    try {
      const tokenSet = await client.callback(config.auth.redirect_uris[0], params, { code_verifier });
      req.session.id_tokenX = tokenSet.id_token;
      const webid = tokenSet.claims().sub;
      req.session.webid = webid;
      let ret = req.session.return_path;
      if (!ret) {
        ret = config.server.mount_path;
        if (!ret.endsWith('/'))
          ret += '/';
      }
      res.render('auth/loggedin.ejs',{webid,ret});
    } catch(err) {
      const msg = JSON.stringify(err);
      const baseUrl = config.server.mount_path;
      res.render('error.ejs',{msg, baseUrl});
    }
  });

  router.get("/logout", (req, res) => {
    let params;
    if (req.session.id_tokenX != undefined) {
      params = {
        post_logout_redirect_uri: config.auth.post_logout_redirect_uri,
        id_token_hint: req.session.id_tokenX,
      };
    } else {
      params = {};
    }
    req.session.webid = null;
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
    const baseUrl = config.server.mount_path;
    res.render('auth/auth.ejs',{msg,baseUrl});
  });
})();

module.exports = router;
