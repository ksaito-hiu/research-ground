const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/*
 * ルーティング
 */
const init = async function(rg) {
  // 上記引数のrgはresearch-groundのインスタンス。rg.configで設定、
  // rg.colCoursesなどでMongoDBのcollectionにアクセスできる。

  // ログインチェック AND uid取得
  function loginCheck(req,res,next) {
//if (true) {console.log('debug GAHA');next();return;} // デバッグ時に有効にすると楽
    let webid = null;
    if (!!req.session && !!req.session.webid)
      webid = req.session.webid;
    if (!webid) {
      const loginURL = rg.config.server.mount_path+'auth/login?return_path='+rg.config.server.mount_path.slice(0,-1)+req.originalUrl;
      res.redirect(loginURL);
      return;
    }
    // WebIDからuidを切り出してセッションに保存
    const uid = rg.config.identity.webid2id(webid);
    req.session.uid = uid;
    next();
  }




  router.get('/progress',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.submit_root = rg.config.server.mount_path+'files/'+rg.config.identity.classifier(uid)+uid;
    o.uploader = rg.config.server.mount_path+'files?path=';
    o.uid = uid;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    o.course = req.query.course;
    if (o.course) {
      o.excercises = await rg.colExcercises.find({course:o.course}).sort({label:1}).toArray();
      o.marks = [];
      o.total = 0;
      o.perfect = 0;
      for (const e of o.excercises) {
        o.perfect += Number(e.point);
        const m = await rg.colMarks.findOne({excercise:e._id,student:uid});
        if (m) {
          o.marks.push(m);
          o.total += Number(m.mark);
        }
      }
console.log("GAHA: "+o.marks.length);
    } else {
      o.excercises = [];
      o.marks = [];
      o.total = 0;
      o.perfect = 0;
    }
    o.msg = "Progress.";
    res.render('progress/progress',o);
  });








  router.get("/",loginCheck, (req, res) => {
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.msg = `Progress.`;
    res.render('progress/progress_top',o);
  });

  return router;
};

module.exports = init;
