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

  // 科目の管理(管理者のみ)
  router.get('/courses',loginCheck,adminCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).toArray();
    o.course_id = o.course_name = '';
    o.msg = 'This page is for course admin.';
    res.render('admin/courses',o);
  });
  router.get('/courses_search',loginCheck,adminCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).toArray();
    try {
      const course_id = req.query.course_id;
      if (!course_id) {
        o.msg = 'The course_id should not be empty.';
        o.course_id = o.course_name = '';
        res.render('admin/courses',o);
        return;
      }
      const ret = await colCourses.findOne({id:course_id});
      if (!ret) {
        o.msg = `The course(id=${course_id}) was not found.`;
        o.course_id = o.course_name = '';
      } else {
        o.msg = `The course(id=${course_id}) was found.`;
        o.course_id = ret.id;
        o.course_name = ret.name;
      }
      res.render('admin/courses',o);
    } catch(err) {
      o.msg = err.toString();
      res.render('error.ejs',o);
    }
  });
  router.get('/courses_add',loginCheck,adminCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    try {
      const course_id = req.query.course_id;
      const course_name = req.query.course_name;
      if (!course_id || !course_name) {
        o.msg = 'The course_id or course_name should not be empty.';
        o.course_id = o.course_name = '';
        o.courses = await colCourses.find({}).toArray();
        res.render('admin/courses',o);
        return;
      }
      const course_data = {
        id: course_id,
        name: course_name
      };
      const ret = await colCourses.updateOne({id:course_id},{$set:course_data},{upsert:true});
      o.msg = 'A course was registered.';
      o.course_id = o.course_name = '';
      o.courses = await colCourses.find({}).toArray();
      res.render('admin/courses',o);
    } catch(err) {
      o.msg = err.toString();
      res.render('error.ejs',o);
    }
  });
  router.get('/courses_del',loginCheck,adminCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    try {
      const course_id = req.query.course_id;
      if (!course_id) {
        o.msg = 'The course_id should not be empty.';
        o.course_id = o.course_name = '';
        o.courses = await colCourses.find({}).toArray();
        res.render('admin/courses',o);
        return;
      }
      const ret = await colCourses.deleteOne({id:course_id});
      if (ret.deletedCount===1) {
        o.msg = `A course(id=${course_id}) was deleted.`;
        o.course_id = o.course_name = '';
      } else {
        o.msg = `A course(id=${course_id}) could not be deleted.`;
        o.course_id = o.course_name = '';
      }
      o.courses = await colCourses.find({}).toArray();
      res.render('admin/courses',o);
    } catch(err) {
      o.msg = err.toString();
      res.render('error.ejs',o);
    }
  });








  // 教員の管理(管理者のみ)
  router.get('/teachers',loginCheck,adminCheck,async (req,res)=>{
    const webid = req.session.webid;
    const uid = req.session.uid;
  });

  // SAの管理(管理者と教員)
  router.get('/assistants',loginCheck,async (req,res)=>{
    const webid = req.session.webid;
    const uid = req.session.uid;
  });

  // 履修者の管理(管理者と教員)
  router.get('/students',loginCheck,async (req,res)=>{
    const webid = req.session.webid;
    const uid = req.session.uid;
  });

  // 課題の管理(管理者と教員)
  router.get('/excercises',loginCheck,async (req,res)=>{
    const webid = req.session.webid;
    const uid = req.session.uid;
  });
  
  router.get("/", (req, res) => {
    let msg;
    if (!!req.session && !!req.session.webid) {
      msg = `You are logged in as ${req.session.webid}.`;
    } else {
      msg = 'You are not logged in.';
    }
    const baseUrl = config.server.mount_path;
    res.render('admin/admin_top.ejs',{msg,baseUrl});
  });

  return router;
};

module.exports = init;
