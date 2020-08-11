const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

/*
 * ルーティング
 */
const init = async function(config) {
  let colCourses = null;
  let colTeachers = null;
  let colAssistants = null;
  let colStudents = null;
  let colExcercises = null;
  let colMarks = null;
  let colFeedbacks = null;

  // MongoDBのクライアントを受け取ってDBを取得し
  // 各種collectionを取得。
  // DB名は'research_ground'の決め打ち
  router.set_mongo_client = async function(mc) {
    const db = mc.db('research_ground');
    colCourses = await db.collection('courses');
    colTeachers = await db.collection('teachers');
    colAssistants = await db.collection('assistants');
    colStudents = await db.collection('students');
    colExcercises = await db.collection('excercises');
    colMarks = await db.collection('marks');
    colFeedbacks = await db.collection('feedbacks');
  };

  // ログインチェック AND uid取得
  function loginCheck(req,res,next) {
//if (true) {console.log('debug GAHA');next();return;} // デバッグ時に有効にすると楽
    let webid = null;
    if (!!req.session && !!req.session.webid)
      webid = req.session.webid;
    if (!webid) {
      const loginURL = config.server.mount_path+'/auth/login?return_path='+config.server.mount_path+req.originalUrl;
      res.redirect(loginURL);
      return;
    }
    // WebIDからuidを切り出してセッションに保存
    const uid = config.identity.webid2id(webid);
    req.session.uid = uid;
    next();
  }

  // 管理者かどうかチェック
  function isAdmin(uid) {
    const webid = config.identity.id2webid(uid);
    if (config.admin.includes(webid))
      return true;
    else
      return false;
  }

  // 管理者かどうかのチェック。上のloginCheckの後で
  // 使われることを想定している。(セッションのuidを使うから)
  function adminCheck(req,res,next) {
//if (true) {console.log('debug GAHA');next();return;} // デバッグ時に有効にすると楽
    const uid = req.session.uid;
    if (! isAdmin(uid,null)) {
      o.msg = 'You do not have parmissions to edit course data.';
      res.render('error.ejs',o);
      return;
    }
    next();
  }

  // uidで指定したユーザーがcourseで指定した科目の
  // 教員かどうかチェック。科目がnullなら何の科目でも
  // 教員であればtrue。
  async function isTeacher(uid,course) {
    if (!course) {
      const res = await colTeachers.findOne({account:uid,course});
      if (res)
        return true;
      else
        return false;
    } else {
      const res = await colTeachers.findOne({account:uid});
      if (res)
        return true;
      else
        return false;
    }
  }

  // uidで指定したユーザーがcourseで指定した科目の
  // SAかどうかチェック。科目がnullなら何の科目でも
  // SAであればtrue。
  async function isAssistant(uid,course) {
    if (!course) {
      const res = await colAssistants.findOne({account:uid,course});
      if (res)
        return true;
      else
        return false;
    } else {
      const res = await colAssistants.findOne({account:uid});
      if (res)
        return true;
      else
        return false;
    }
  }




  router.get('/marking',loginCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.msg = "Marking.";
    res.render('marking/marking',o);
  });





  router.get('/statistics',loginCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.msg = "Marking.";
    res.render('marking/statistics',o);
  });





  router.get("/",loginCheck, (req, res) => {
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.msg = `Marking.`;
    res.render('marking/marking_top',o);
  });

  return router;
};

module.exports = init;
