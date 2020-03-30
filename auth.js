const express = require('express');
const { Issuer, generators } = require('openid-client');
const config = require('./config.json');

const router = express.Router();

(async function() {
    let client;
    try {
        const issuer = await Issuer.discover(config.auth.issuer);
        client = new issuer.Client({
            client_id: config.auth.client_id,
            client_secret: config.auth.client_secret,
            redirect_uris: config.auth.redirect_uris,
            response_types: ['code'],
        });
    } catch(err) {
        console.log('Cannot search openid-op at id.do-johodai.ac.jp.');
    }

    router.get('/login',(req,res)=>{
        const code_verifier = generators.codeVerifier();
        const code_challenge = generators.codeChallenge(code_verifier);
        req.session.local_code_verifier = code_verifier;

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
            req.session.webid = tokenSet.claims().sub;
            res.render('auth/result.ejs',{result: 'id_token = '+tokenSet.id_token});
        } catch(err) {
            res.render('auth/error.ejs',{message: JSON.stringify(err)});
        }
    });

    router.get("/logout", (req, res) => {
        let params;
        if (req.session.id_tokenX != undefined) {
            params = {
                post_logout_redirect_uri: 'https://s314.do-johodai.ac.jp/research-ground/',
                id_token_hint: req.session.id_tokenX,
            };
        } else {
            params = {};
        }
        req.session.webid = null;
        const theUrl = client.endSessionUrl(params);
        res.redirect(theUrl);
    });
})();

module.exports = router;
