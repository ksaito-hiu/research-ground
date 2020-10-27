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
    let uid = req.session.uid;
    // 管理者のみ他のユーザーの情報が表示できる
    if (req.session.admin && req.query.uid) {
      uid = req.query.uid;
    }
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.submit_root = rg.config.server.mount_path+'files/'+rg.config.identity.classifier(uid)+uid;
    o.uploader = rg.config.server.mount_path+'files?path=';
    o.uid = uid;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    o.course = req.query.course;
    if (o.course) {
      const u = await rg.colStudents.findOne({account:uid ,course:o.course});
      if (!u) // 履修してるかどうかの情報
        o.regist_attention = true;
      else
        o.regist_attention = false;
      o.excercises = await rg.colExcercises.find({course:o.course}).sort({label:1}).toArray();
      o.marks = [];
      let total = 0;
      let perfect = 0;
      o.mark0 = 0;
      o.mark1 = 0;
      o.mark2 = 0;
      o.unsubmitted = 0;
      o.submitted = 0;
      o.marked = 0;
      o.resubmitted = 0;
      o.removed = 0;
      for (const e of o.excercises) {
        perfect += Number(e.point)*Number(e.weight);
        const m = await rg.colMarks.findOne({excercise:e._id,student:uid});
        if (m) {
          o.marks.push(m);
          total += Number(m.mark)*Number(e.weight);
          if (m.mark==='0') o.mark0 += 1;
          else if (m.mark==='1') o.mark1 += 1;
          else if (m.mark==='2') o.mark2 += 1;
          if (m.status==='unsubmitted') o.unsubmitted += 1;
          else if (m.status==='submitted') o.submitted += 1;
          else if (m.status==='marked') o.marked += 1;
          else if (m.status==='resubmitted') o.resubmitted += 1;
          else if (m.status==='removed') o.removed += 1;
        } else {
          o.unsubmitted += 1;
        }
      }
      o.score = Math.floor(100.0*(total/perfect));
    } else {
      o.excercises = [];
      o.marks = [];
      o.regist_attention = false;
      o.mark0=o.mark1=o.mark2=0;
      o.unsubmitted=o.submitted=o.marked=o.resubmitted=o.removed=0;
      o.score = 0.0;
    }
    o.msg = "Progress.";
    res.render('progress/progress',o);
  });








  router.get("/",loginCheck, (req, res) => {
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.msg = `Progress.`;
    res.render('progress/progress_top',o);
  });

  return router;
};

module.exports = init;
