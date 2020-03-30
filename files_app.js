const express = require('express');
const router = express.Router();

(async function() {
    router.get('/',(req,res)=>{
        let str = 'files_app module!'
        if (!!req.session) {
            if (!!req.session.webid) {
                str += ` You are logged in as ${req.session.webid}.`;
            } else {
                str += ` You are not logged in.`;
            }
        } else {
            str += ` You are not logged in. (no session)`;
        }
        res.send(str);
    });
})();

module.exports = router;
