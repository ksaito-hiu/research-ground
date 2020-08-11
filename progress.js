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




  router.get('/progress',loginCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.msg = "Progress.";
    res.render('progress/progress',o);
  });








  router.get("/",loginCheck, (req, res) => {
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.msg = `Progress.`;
    res.render('progress/progress_top',o);
  });

  return router;
};

module.exports = init;
