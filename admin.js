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

  // 科目の管理(管理者のみ)
  router.get('/courses',loginCheck,adminCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).sort({id:1}).toArray();
    o.id = o.name = '';
    o.msg = 'This page is for course admin.';
    res.render('admin/courses',o);
  });
  router.get('/courses_search',loginCheck,adminCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).sort({id:1}).toArray();
    try {
      const id = req.query.id;
      if (!id) {
        o.msg = 'The course id should not be empty.';
        o.id = o.name = '';
        res.render('admin/courses',o);
        return;
      }
      const ret = await colCourses.findOne({id});
      if (!ret) {
        o.msg = `The course(id=${id}) was not found.`;
        o.id = o.name = '';
      } else {
        o.msg = `The course(id=${id}) was found.`;
        o.id = ret.id;
        o.name = ret.name;
      }
      res.render('admin/courses',o);
    } catch(err) {
      o.msg = err.toString();
      res.render('error.ejs',o);
    }
  });
  router.get('/courses_regist',loginCheck,adminCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    try {
      const id = req.query.id;
      const name = req.query.name;
      if (!id || !name) {
        o.msg = 'The course id or name should not be empty.';
        o.id = o.name = '';
        o.courses = await colCourses.find({}).sort({id:1}).toArray();
        res.render('admin/courses',o);
        return;
      }
      const course_data = {id,name};
      const ret = await colCourses.updateOne({id},{$set:course_data},{upsert:true});
      o.msg = 'A course was registered.';
      o.id = o.name = '';
      o.courses = await colCourses.find({}).sort({id:1}).toArray();
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
      const id = req.query.id;
      if (!id) {
        o.msg = 'The course id should not be empty.';
        o.id = o.name = '';
        o.courses = await colCourses.find({}).sort({id:1}).toArray();
        res.render('admin/courses',o);
        return;
      }
      const ret = await colCourses.deleteOne({id});
      if (ret.deletedCount===1) {
        o.msg = `A course(id=${id}) was deleted.`;
        o.id = o.name = '';
      } else {
        o.msg = `A course(id=${id}) could not be deleted.`;
        o.id = o.name = '';
      }
      o.courses = await colCourses.find({}).sort({id:1}).toArray();
      res.render('admin/courses',o);
    } catch(err) {
      o.msg = err.toString();
      res.render('error.ejs',o);
    }
  });








  // 教員の管理(管理者のみ)
  router.get('/teachers',loginCheck,adminCheck,async (req,res)=>{
    const selected_course = req.query.selected_course;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).sort({id:1}).toArray();
    if (!selected_course) { // コースが選択されてない場合
      o.selected_course = "";
      o.teachers = [];
      o.msg = 'At first, select cource id.';
      res.render('admin/teachers',o);
      return;
    }
    o.selected_course = selected_course;
    o.teachers = await colTeachers.find({course:selected_course}).sort({account:1}).toArray();
    if (!o.teachers) {o.teachers = [];}
    o.msg = 'The course is selected.';
    res.render('admin/teachers',o);
  });
  router.get('/teachers_regist',loginCheck,adminCheck,async (req,res)=>{
    const course = req.query.course;
    const account = req.query.account;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).sort({id:1}).toArray();
    if (!course || !account) { // コースやアカウントの指定がない場合
      o.selected_course = "";
      o.teachers = [];
      o.msg = 'ERROR! course or account is not specified.';
      res.render('admin/teachers',o);
      return;
    }
    const teacher_data = {account,course};
    const ret = await colTeachers.updateOne(teacher_data,{$set:teacher_data},{upsert:true});
    o.selected_course = course;
    o.teachers = await colTeachers.find({course}).sort({account:1}).toArray();
    o.msg = 'A new teacher was registerd.';
    res.render('admin/teachers',o);
  });
  router.get('/teachers_del',loginCheck,adminCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    try {
      const course = req.query.course;
      const account = req.query.account;
      o.courses = await colCourses.find({}).sort({id:1}).toArray();
      if (!course || !account) {
        o.msg = 'The course and account should be specified.';
        o.selected_course = "";
        o.teachers = [];
        res.render('admin/teachers',o);
        return;
      }
      const ret = await colTeachers.deleteOne({course,account});
      if (ret.deletedCount===0)
        o.msg = `The teacher(${account}) of the course(${course}) could not be deleted.`;
      else
        o.msg = `The teacher(${account}) of the course(${course}) was deleted.`;
      o.selected_course = course;
      o.teachers = await colTeachers.find({course}).sort({account:1}).toArray();
      res.render('admin/teachers',o);
    } catch(err) {
      o.msg = err.toString();
      res.render('error.ejs',o);
    }
  });










  // SAの管理(管理者のみ)
  router.get('/assistants',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const selected_course = req.query.selected_course;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).sort({id:1}).toArray();
    if (!selected_course) { // コースが選択されてない場合
      o.selected_course = "";
      o.assistants = [];
      o.msg = 'At first, select cource id.';
      res.render('admin/assistants',o);
      return;
    }
    if (!isAdmin(uid) && !isTeacher(uid,selected_course)) {
      o.selected_course = "";
      o.assistants = [];
      o.msg = `You do not have parmission to edit the course(${selected_course}).`;
      res.render('admin/assistants',o);
      return;
    }
    o.selected_course = selected_course;
    o.assistants = await colAssistants.find({course:selected_course}).sort({account:1}).toArray();
    if (!o.assistants) {o.assistants = [];}
    o.msg = 'The course is selected.';
    res.render('admin/assistants',o);
  });
  router.get('/assistants_regist',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const course = req.query.course;
    const account = req.query.account;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).sort({id:1}).toArray();
    if (!isAdmin(uid) && !isTeacher(uid,course)) { // 権限チェック
      o.selected_course = "";
      o.assistants = [];
      o.msg = `You do not have parmission to edit the course(${selected_course}).`;
      res.render('admin/assistants',o);
      return;
    }
    if (!course || !account) { // コースやアカウントの指定がない場合
      o.selected_course = "";
      o.assistants = [];
      o.msg = 'ERROR! course or account is not specified.';
      res.render('admin/assistants',o);
      return;
    }
    const assistant_data = {account,course};
    const ret = await colAssistants.updateOne(assistant_data,{$set:assistant_data},{upsert:true});
    o.selected_course = course;
    o.assistants = await colAssistants.find({course}).sort({account:1}).toArray();
    o.msg = 'A new assistant was registerd.';
    res.render('admin/assistants',o);
  });
  router.get('/assistants_del',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    try {
      const course = req.query.course;
      const account = req.query.account;
      o.courses = await colCourses.find({}).sort({id:1}).toArray();
      if (!isAdmin(uid) && !isTeacher(uid,course)) { // 権限チェック
        o.selected_course = "";
        o.assistants = [];
        o.msg = `You do not have parmission to edit the course(${selected_course}).`;
        res.render('admin/assistants',o);
        return;
      }
      if (!course || !account) { // コースやアカウントの指定がない場合
        o.msg = 'The course and account should be specified.';
        o.selected_course = "";
        o.teachers = [];
        res.render('admin/teachers',o);
        return;
      }
      const ret = await colAssistants.deleteOne({course,account});
      if (ret.deletedCount===0)
        o.msg = `The assistant(${account}) of the course(${course}) could not be deleted.`;
      else
        o.msg = `The assistant(${account}) of the course(${course}) was deleted.`;
      o.selected_course = course;
      o.assistants = await colAssistants.find({course}).sort({account:1}).toArray();
      res.render('admin/assistants',o);
    } catch(err) {
      o.msg = err.toString();
      res.render('error.ejs',o);
    }
  });










  // 履修者の管理(管理者と教員)
  router.get('/students',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const selected_course = req.query.selected_course;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).sort({id:1}).toArray();
    if (!selected_course) { // コースが選択されてない場合
      o.selected_course = "";
      o.students = "";
      o.msg = 'At first, select cource id.';
      res.render('admin/students',o);
      return;
    }
    if (!isAdmin(uid) && !isTeacher(uid,selected_course)) {
      o.selected_course = "";
      o.students = "";
      o.msg = `You do not have parmission to edit the course(${selected_course}).`;
      res.render('admin/students',o);
      return;
    }
    o.selected_course = selected_course;
    let ss = await colStudents.find({course:selected_course}).sort({account:1}).toArray();
    if (!ss) ss = [];
    o.students = "";
    for (const s of ss)
      o.students += (s.account + "\n");
    o.msg = 'The course is selected.';
    res.render('admin/students',o);
  });
  // postなので注意。全部消してから全部追加するので注意。
  router.post('/students_regist',express.urlencoded({extended:true}),loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const course = req.body.course;
    let accounts = req.body.accounts;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).sort({id:1}).toArray();
    if (!isAdmin(uid) && !isTeacher(uid,course)) { // 権限チェック
      o.selected_course = "";
      o.students = "";
      o.msg = `You do not have parmission to edit the course(${selected_course}).`;
      res.render('admin/students',o);
      return;
    }
    if (!course || !accounts) { // コースやアカウントの指定がない場合
      o.selected_course = "";
      o.students = "";
      o.msg = 'ERROR! course or accounts is not specified.';
      res.render('admin/students',o);
      return;
    }
    const ret1 = await colStudents.deleteMany({course});
    accounts = accounts.split('\n');
    const data = [];
    for (let a of accounts) {
      if (a) {
        a = a.trim();
        data.push({account:a,course});
      }
    }
    const ret2 = await colStudents.insertMany(data);
    o.selected_course = course;
    let ss = await colStudents.find({course}).sort({account:1}).toArray();
    if (!ss) ss = [];
    o.students = "";
    for (const s of ss)
      o.students += (s.account+"\n");
    o.msg = 'New students were registerd.';
    res.render('admin/students',o);
  });










  // 課題の管理(管理者と教員)
  router.get('/excercises',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    if (!isAdmin(uid) && !isTeacher(uid)) { // 権限が無い時の処理
      o.course=o.no=o.sub_no=o.category="";
      o.question=o.submit=o.allocation=o.weight="";
      o.msg = `You do not have parmission to edit the course(${selected_course}).`;
      res.render('admin/excercises',o);
      return;
    }
    const course = req.query.course;
    const no = req.query.no;
    const sub_no = req.query.sub_no;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).sort({id:1}).toArray();
    if (course && no && sub_no) { // 課題が指定されてる時は検索
      const cond = {course,no,sub_no};
      const se = await colExcercises.findOne(cond);
      if (se) {
        o.course     = se.course;
        o.no         = se.no;
        o.sub_no     = se.sub_no;
        o.category   = se.category;
        o.question   = se.question;
        o.submit     = se.submit;
        o.allocation = se.allocation;
        o.weight     = se.weight;
        o.msg = 'The course and the excercise are specified.';
      } else {
        o.course=course; o.no=no; o.sub_no=sub_no;
        o.category=o.question=o.submit=o.allocation=o.weight="";
        o.msg = 'The excercise could not be found.';
      }
    } else {
      o.course=o.no=o.sub_no=o.category="";
      o.question=o.submit=o.allocation=o.weight="";
      o.msg = 'At first, select cource id.'
    }
    res.render('admin/excercises',o);
  });
  router.get('/excercises_regist',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).sort({id:1}).toArray();
    const course = req.query.course;
    if (!course) {
      o.course=o.no=o.sub_no=o.category="";
      o.question=o.submit=o.allocation=o.weight="";
      o.msg = 'ERROR! The course was not specified.'
      res.render('admin/excercises',o);
      return;
    }
    if (!isAdmin(uid) && !isTeacher(uid,course)) {
      o.course=o.no=o.sub_no=o.category="";
      o.question=o.submit=o.allocation=o.weight="";
      o.msg = `You do not have parmission to edit the course(${selected_course}).`;
      res.render('admin/excercises',o);
      return;
    }
    const no = req.query.no;
    const sub_no = req.query.sub_no;
    if (!no || !sub_no) {
      o.course=o.no=o.sub_no=o.category="";
      o.question=o.submit=o.allocation=o.weight="";
      o.msg = 'ERROR! The excercise was not specified.'
      res.render('admin/excercises',o);
      return;
    }
    const category = req.query.category || 'k';
    const question = req.query.question || 'https://dummy.org/'+category+no+'-'+sub_no+'.html';
    const submit = req.query.submit || 'https://dummy.org/submit/'+category+no+'-'+sub_no+'.html';
    const allocation = parseInt(req.query.allocation) || 2;
    const weight = parseFloat(req.query.weight) || 5;

    const cond = {course,no,sub_no};
    const data = {course,no,sub_no,category,question,submit,allocation,weight};
    const ret = await colExcercises.updateOne(cond,{$set:data},{upsert:true});

    o.course=o.no=o.sub_no=o.category="";
    o.question=o.submit=o.allocation=o.weight="";
    o.msg = `The excercise(${category}${no}-${sub_no}) was registered.`;
    res.render('admin/excercises',o);
  });
  router.get('/excercises_del',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const course = req.query.course;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = config.server.mount_path;
    o.courses = await colCourses.find({}).sort({id:1}).toArray();
    if (!course) {
      o.course=o.no=o.sub_no=o.category="";
      o.question=o.submit=o.allocation=o.weight="";
      o.msg = 'ERROR! The course was not specified.'
      res.render('admin/excercises',o);
      return;
    }
    if (!isAdmin(uid) && !isTeacher(uid,course)) {
      o.course=o.no=o.sub_no=o.category="";
      o.question=o.submit=o.allocation=o.weight="";
      o.msg = `You do not have parmission to edit the course(${course}).`;
      res.render('admin/excercises',o);
      return;
    }
    const no = req.query.no;
    const sub_no = req.query.sub_no;
    if (!no || !sub_no) {
      o.course=o.no=o.sub_no=o.category="";
      o.question=o.submit=o.allocation=o.weight="";
      o.msg = 'ERROR! The excercise was not specified.'
      res.render('admin/excercises',o);
      return;
    }
    const cond = {course,no,sub_no};
    const ret = await colExcercises.deleteMany(cond);
    if (ret.deleteCount===0)
      o.msg = `The excercise(course=${course},no=${no},sub_no=${sub_no}) could not be deleted.`;
    else
      o.msg = `The excercise(course=${course},no=${no},sub_no=${sub_no}) was deleted.`;

    o.course=o.no=o.sub_no=o.category="";
    o.question=o.submit=o.allocation=o.weight="";
    res.render('admin/excercises',o);
  });
  



  router.get('/backup',loginCheck,adminCheck,async (req,res)=>{
    const target = req.query.target;
    const course = req.query.course;
    if (!target && !course) {
      const o = {}; // ejsにわたすデーター
      o.baseUrl = config.server.mount_path;
      o.courses = await colCourses.find({}).sort({id:1}).toArray();
      res.render('admin/backup',o);
      return;
    }
    if (!target) { // 通常ありえないけど
      const o = {}; // ejsにわたすデーター
      o.baseUrl = config.server.mount_path;
      o.courses = await colCourses.find({}).sort({id:1}).toArray();
      res.render('admin/backup',o);
      return;
    }
    let data;
    if (target==='courses')
      if (course)
        data = await colCourses.find({id:course}).sort({id:1}).toArray();
      else
        data = await colCourses.find({}).sort({id:1}).toArray();
    else if (target==='teachers')
      if (course)
        data = await colTeachers.find({course}).sort({id:1}).toArray();
      else
        data = await colTeachers.find({}).sort({id:1}).toArray();
    else if (target==='assistants')
      if (course)
        data = await colAssistants.find({course}).sort({id:1}).toArray();
      else
        data = await colAssistants.find({}).sort({id:1}).toArray();
    else if (target==='students')
      if (course)
        data = await colStudents.find({course}).sort({id:1}).toArray();
      else
        data = await colStudents.find({}).sort({id:1}).toArray();
    else if (target==='excercises')
      if (course)
        data = await colExcercises.find({course}).sort({id:1}).toArray();
      else
        data = await colExcercises.find({}).sort({id:1}).toArray();
    else if (target==='marks')
      if (course)
        data = await colMarks.find({course}).sort({id:1}).toArray();
      else
        data = await colMarks.find({}).sort({id:1}).toArray();
    else if (target==='feedbacks')
      if (course)
        data = await colFeedbacks.find({course}).sort({id:1}).toArray();
      else
        data = await colFeedbacks.find({}).sort({id:1}).toArray();
    else
      data = {"error":"specified target is not valid."};
    res.json({data});
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
