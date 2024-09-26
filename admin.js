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
      const mount_path = rg.config.server.mount_path;
      const loginURL = mount_path+'auth/login?return_path='+req.originalUrl;
      res.redirect(loginURL);
      return;
    }
    // WebIDからuidを切り出してセッションに保存
    const uid = rg.config.identity.webid2id(webid);
    req.session.uid = uid;
    next();
  }

  // 管理者かどうかチェック
  function isAdmin(uid) {
    const webid = rg.config.identity.id2webid(uid);
    if (rg.config.admin.includes(webid))
      return true;
    else
      return false;
  }

  // 管理者かどうかのチェック。上のloginCheckの後で
  // 使われることを想定している。(セッションのuidを使うから)
  function adminCheck(req,res,next) {
//if (true) {console.log('debug GAHA');next();return;} // デバッグ時に有効にすると楽
    const uid = req.session.uid;
    const o = {}; // ejsにわたすデーター
    if (! isAdmin(uid,null)) {
      o.msg = 'You do not have parmissions to edit course data.';
      o.baseUrl = rg.config.server.mount_path;
      o.admin = req.session.admin;
      o.teacher = req.session.teacher;
      o.sa = req.session.sa;
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
      const res = await rg.colTeachers.findOne({account:uid});
      if (res)
        return true;
      else
        return false;
    } else {
      const res = await rg.colTeachers.findOne({account:uid,course});
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
      const res = await rg.colAssistants.findOne({account:uid});
      if (res)
        return true;
      else
        return false;
    } else {
      const res = await rg.colAssistants.findOne({account:uid,course});
      if (res)
        return true;
      else
        return false;
    }
  }


  // パスを調べて非同期でStatsを返す。
  async function stat(path) {
    return new Promise((resolve,reject)=>{
      fs.stat(path,(err,stats)=>{
        if (err) {
          resolve(null);
          return;
        }
        resolve(stats);
      });
    });
  }





  // 科目の管理(管理者のみ)
  router.get('/courses',loginCheck,adminCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    o.id = o.name = '';
    o.msg = 'This page is for course admin.';
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    res.render('admin/courses',o);
  });
  router.get('/courses_search',loginCheck,adminCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    try {
      const id = req.query.id;
      if (!id) {
        o.msg = 'The course id should not be empty.';
        o.id = o.name = '';
        res.render('admin/courses',o);
        return;
      }
      const ret = await rg.colCourses.findOne({id});
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
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    try {
      const id = req.query.id;
      const name = req.query.name;
      if (!id || !name ) {
        o.msg = 'The course id or name should not be empty.';
        o.id = id; o.name = name;
        o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
        res.render('admin/courses',o);
        return;
      }
      const course_data = {id,name};
      const ret = await rg.colCourses.updateOne({id},{$set:course_data},{upsert:true});
      o.msg = 'A course was registered.';
      o.id = o.name = '';
      o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
      res.render('admin/courses',o);
    } catch(err) {
      o.msg = err.toString();
      res.render('error.ejs',o);
    }
  });
  router.get('/courses_del',loginCheck,adminCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    try {
      const id = req.query.id;
      if (!id) {
        o.msg = 'The course id should not be empty.';
        o.id = o.name = '';
        o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
        res.render('admin/courses',o);
        return;
      }
      const ret = await rg.colCourses.deleteOne({id});
      if (ret.deletedCount===1) {
        o.msg = `A course(id=${id}) was deleted.`;
        o.id = o.name = '';
      } else {
        o.msg = `A course(id=${id}) could not be deleted.`;
        o.id = o.name = '';
      }
      o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
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
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    if (!selected_course) { // コースが選択されてない場合
      o.selected_course = "";
      o.teachers = [];
      o.msg = 'At first, select course id.';
      res.render('admin/teachers',o);
      return;
    }
    o.selected_course = selected_course;
    o.teachers = await rg.colTeachers.find({course:selected_course}).sort({account:1}).toArray();
    if (!o.teachers) {o.teachers = [];}
    o.msg = 'The course is selected.';
    res.render('admin/teachers',o);
  });
  router.get('/teachers_regist',loginCheck,adminCheck,async (req,res)=>{
    const course = req.query.course;
    const account = req.query.account;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    if (!course || !account) { // コースやアカウントの指定がない場合
      o.selected_course = "";
      o.teachers = [];
      o.msg = 'ERROR! course or account is not specified.';
      res.render('admin/teachers',o);
      return;
    }
    const teacher_data = {account,course};
    const ret = await rg.colTeachers.updateOne(teacher_data,{$set:teacher_data},{upsert:true});
    o.selected_course = course;
    o.teachers = await rg.colTeachers.find({course}).sort({account:1}).toArray();
    o.msg = 'A new teacher was registerd.';
    res.render('admin/teachers',o);
  });
  router.get('/teachers_del',loginCheck,adminCheck,async (req,res)=>{
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    try {
      const course = req.query.course;
      const account = req.query.account;
      o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
      if (!course || !account) {
        o.msg = 'The course and account should be specified.';
        o.selected_course = "";
        o.teachers = [];
        res.render('admin/teachers',o);
        return;
      }
      const ret = await rg.colTeachers.deleteOne({course,account});
      if (ret.deletedCount===0)
        o.msg = `The teacher(${account}) of the course(${course}) could not be deleted.`;
      else
        o.msg = `The teacher(${account}) of the course(${course}) was deleted.`;
      o.selected_course = course;
      o.teachers = await rg.colTeachers.find({course}).sort({account:1}).toArray();
      res.render('admin/teachers',o);
    } catch(err) {
      o.msg = err.toString();
      res.render('error.ejs',o);
    }
  });










  // SAの管理(教師と管理者のみ)
  router.get('/assistants',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const selected_course = req.query.selected_course;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    if (!selected_course) { // コースが選択されてない場合
      o.selected_course = "";
      o.assistants = [];
      o.msg = 'At first, select course id.';
      res.render('admin/assistants',o);
      return;
    }
    if (!isAdmin(uid) && !(await isTeacher(uid,selected_course))) {
      o.selected_course = "";
      o.assistants = [];
      o.msg = `You do not have parmission to edit the course(${selected_course}).`;
      res.render('admin/assistants',o);
      return;
    }
    o.selected_course = selected_course;
    o.assistants = await rg.colAssistants.find({course:selected_course}).sort({account:1}).toArray();
    if (!o.assistants) {o.assistants = [];}
    o.msg = 'The course is selected.';
    res.render('admin/assistants',o);
  });
  router.get('/assistants_regist',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const course = req.query.course;
    const account = req.query.account;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    if (!isAdmin(uid) && !(await isTeacher(uid,course))) { // 権限チェック
      o.selected_course = "";
      o.assistants = [];
      o.msg = `You do not have parmission to edit the course(${course}).`;
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
    const ret = await rg.colAssistants.updateOne(assistant_data,{$set:assistant_data},{upsert:true});
    o.selected_course = course;
    o.assistants = await rg.colAssistants.find({course}).sort({account:1}).toArray();
    o.msg = 'A new assistant was registerd.';
    res.render('admin/assistants',o);
  });
  router.get('/assistants_del',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    try {
      const course = req.query.course;
      const account = req.query.account;
      o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
      if (!isAdmin(uid) && !(await isTeacher(uid,course))) { // 権限チェック
        o.selected_course = "";
        o.assistants = [];
        o.msg = `You do not have parmission to edit the course(${course}).`;
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
      const ret = await rg.colAssistants.deleteOne({course,account});
      if (ret.deletedCount===0)
        o.msg = `The assistant(${account}) of the course(${course}) could not be deleted.`;
      else
        o.msg = `The assistant(${account}) of the course(${course}) was deleted.`;
      o.selected_course = course;
      o.assistants = await rg.colAssistants.find({course}).sort({account:1}).toArray();
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
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    if (!selected_course) { // コースが選択されてない場合
      o.selected_course = "";
      o.students = "";
      o.msg = 'At first, select course id.';
      res.render('admin/students',o);
      return;
    }
    if (!isAdmin(uid) && !(await isTeacher(uid,selected_course))) {
      o.selected_course = "";
      o.students = "";
      o.msg = `You do not have parmission to edit the course(${selected_course}).`;
      res.render('admin/students',o);
      return;
    }
    o.selected_course = selected_course;
    let ss = await rg.colStudents.find({course:selected_course}).sort({account:1}).toArray();
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
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    if (!isAdmin(uid) && !(await isTeacher(uid,course))) { // 権限チェック
      o.selected_course = "";
      o.students = "";
      o.msg = `You do not have parmission to edit the course(${course}).`;
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
    const ret1 = await rg.colStudents.deleteMany({course});
    accounts = accounts.split('\n');
    const data = [];
    for (let a of accounts) {
      if (a) {
        a = a.trim();
        data.push({account:a,course});
      }
    }
    const ret2 = await rg.colStudents.insertMany(data);
    o.selected_course = course;
    let ss = await rg.colStudents.find({course}).sort({account:1}).toArray();
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
    const course = req.query.course;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    if (!isAdmin(uid) && !(await isTeacher(uid,null))) { // 権限が無い時の処理
      o.msg = `You do not have parmission to edit excercises.`;
      res.render('error',o);
      return;
    }
    const label = req.query.label;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    o.excercises = await rg.colExcercises.find({course}).sort({label:1}).toArray();
    if (course && label) { // 課題が指定されてる時は検索
      const cond = {label,course};
      const se = await rg.colExcercises.findOne(cond);
      if (se) {
        o.label    = se.label;
        o.course   = se.course;
        o.category = se.category;
        o.question = se.question;
        o.submit   = se.submit;
        o.point    = se.point;
        o.weight   = se.weight;
        o.memo     = se.memo;
        o.msg = 'The course and the excercise are specified.';
      } else {
        o.label=label; o.course=course;
        o.category=o.question=o.submit=o.point="";
        o.weight=o.memo="";
        o.msg = 'The excercise could not be found.';
      }
    } else {
      o.label=label; o.course=course; o.category="";
      o.question=o.submit=o.point="";
      o.weight=o.memo="";
      o.msg = 'At first, select course id.'
    }
    res.render('admin/excercises',o);
  });
  router.get('/excercises_regist',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    const course = req.query.course;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    o.excercises = await rg.colExcercises.find({course}).sort({label:1}).toArray();
    if (!course) {
      o.label=o.course=o.category="";
      o.question=o.submit=o.point="";
      o.weight=o.memo="";
      o.msg = 'ERROR! The course was not specified.'
      res.render('admin/excercises',o);
      return;
    }
    if (!isAdmin(uid) && !(await isTeacher(uid,course))) {
      o.label=o.course=o.category="";
      o.question=o.submit=o.point="";
      o.weight=o.memo="";
      o.msg = `You do not have parmission to edit the course(${course}).`;
      res.render('admin/excercises',o);
      return;
    }
    const label = req.query.label;
    if (!label) {
      o.label=o.course=o.category="";
      o.question=o.submit=o.point="";
      o.weight=o.memo="";
      o.msg = 'ERROR! The excercise was not specified.'
      res.render('admin/excercises',o);
      return;
    }
    const category = req.query.category || '必須';
    const question = req.query.question || 'https://example.org/materials/'+label+'.html';
    const submit = req.query.submit || '/'+course+'/'+label+'.html';
    const point = parseInt(req.query.point) || 2;
    const weight = parseFloat(req.query.weight) || 5;
    const memo = req.query.memo || '';

    const cond = {course,label};
    const data = {course,label,category,question,submit,point,weight,memo};
    const ret = await rg.colExcercises.updateOne(cond,{$set:data},{upsert:true});

    o.label=o.course=o.category="";
    o.question=o.submit=o.point="";
    o.weight=o.memo="";
    o.msg = `The excercise(${label}) was registered.`;
    res.render('admin/excercises',o);
  });
  router.get('/excercises_del',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const course = req.query.course;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    o.excercises = await rg.colExcercises.find({course}).sort({label:1}).toArray();
    if (!course) {
      o.label=o.course=o.category="";
      o.question=o.submit=o.point="";
      o.weight=o.memo="";
      o.msg = 'ERROR! The course was not specified.'
      res.render('admin/excercises',o);
      return;
    }
    if (!isAdmin(uid) && !(await isTeacher(uid,course))) {
      o.label=o.course=o.category="";
      o.question=o.submit=o.point="";
      o.weight=o.memo="";
      o.msg = `You do not have parmission to edit the course(${course}).`;
      res.render('admin/excercises',o);
      return;
    }
    const label = req.query.label;
    if (!label) {
      o.label=o.course=o.category="";
      o.question=o.submit=o.point="";
      o.weight=o.memo="";
      o.msg = 'ERROR! The excercise was not specified.'
      res.render('admin/excercises',o);
      return;
    }
    const cond = {course,label};
    const ret = await rg.colExcercises.deleteMany(cond);
    if (ret.deleteCount===0)
      o.msg = `The excercise(course=${course},label=${label}) could not be deleted.`;
    else
      o.msg = `The excercise(course=${course},label=${label}) was deleted.`;

    o.label=o.course=o.category="";
    o.question=o.submit=o.point="";
    o.weight=o.memo="";
    res.render('admin/excercises',o);
  });
  



  router.get('/backup',loginCheck,adminCheck,async (req,res)=>{
    const target = req.query.target;
    const course = req.query.course;
    if (!target && !course) {
      const o = {}; // ejsにわたすデーター
      o.baseUrl = rg.config.server.mount_path;
      o.admin = req.session.admin;
      o.teacher = req.session.teacher;
      o.sa = req.session.sa;
      o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
      res.render('admin/backup',o);
      return;
    }
    if (!target) { // 通常ありえないけど
      const o = {}; // ejsにわたすデーター
      o.baseUrl = rg.config.server.mount_path;
      o.admin = req.session.admin;
      o.teacher = req.session.teacher;
      o.sa = req.session.sa;
      o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
      res.render('admin/backup',o);
      return;
    }
    let data;
    if (target==='courses')
      if (course)
        data = await rg.colCourses.find({id:course}).sort({id:1}).toArray();
      else
        data = await rg.colCourses.find({}).sort({id:1}).toArray();
    else if (target==='teachers')
      if (course)
        data = await rg.colTeachers.find({course}).sort({id:1}).toArray();
      else
        data = await rg.colTeachers.find({}).sort({id:1}).toArray();
    else if (target==='assistants')
      if (course)
        data = await rg.colAssistants.find({course}).sort({id:1}).toArray();
      else
        data = await rg.colAssistants.find({}).sort({id:1}).toArray();
    else if (target==='students')
      if (course)
        data = await rg.colStudents.find({course}).sort({id:1}).toArray();
      else
        data = await rg.colStudents.find({}).sort({id:1}).toArray();
    else if (target==='excercises')
      if (course)
        data = await rg.colExcercises.find({course}).sort({id:1}).toArray();
      else
        data = await rg.colExcercises.find({}).sort({id:1}).toArray();
    else if (target==='marks')
      if (course)
        data = await rg.colMarks.find({course}).sort({id:1}).toArray();
      else
        data = await rg.colMarks.find({}).sort({id:1}).toArray();
    else if (target==='feedbacks')
      if (course)
        data = await rg.colFeedbacks.find({course}).sort({id:1}).toArray();
      else
        data = await rg.colFeedbacks.find({}).sort({id:1}).toArray();
    else
      data = {"error":"specified target is not valid."};
    res.json({data});
  });



  router.get('/checkup',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const selected_course = req.query.selected_course;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    o.forgotten_files = [];
    if (!selected_course) { // コースが選択されてない場合
      o.selected_course = "";
      o.msg = 'At first, select course id.';
      res.render('admin/checkup',o);
      return;
    }
    if (!isAdmin(uid) && !(await isTeacher(uid,selected_course))) {
      o.selected_course = "";
      o.msg = `You do not have parmission to edit the course(${selected_course}).`;
      res.render('admin/checkup',o);
      return;
    }
    
    o.selected_course = selected_course;
    o.forgotten_files = [];
    const excercises = await rg.colExcercises.find({course:selected_course}).sort({label:1}).toArray();
    const students = await rg.colStudents.find({course:selected_course}).sort({account:1}).toArray();
    for (s of students) {
      for (e of excercises) {
        let the_path = rg.config.files.root;
        the_path = path.join(the_path,rg.config.identity.classifier(s.account));
        the_path = path.join(the_path,s.account);
        the_path = path.join(the_path,e.submit);
        const stats = await stat(the_path);
        if (!stats)
          continue;
        const mark = await rg.colMarks.findOne({course:e.course,label:e.label,student:s.account});
        if (mark) {
          if (mark.status==='unsubmitted') {
            o.forgotten_files.push(the_path + " unsubmitted -> submitted");
          } else if (mark.status==='submitted') {
            // 何もしない
          } else if (mark.status==='marked') {
            // 何もしない
          } else if (mark.status==='resubmitted') {
            // 何もしない
          } else if (mark.status==='removed') {
            o.forgotten_files.push(the_path + " removed -> resubmitted");
          }
        } else {
          o.forgotten_files.push(the_path + " none -> submitted");
        }
      }
    }
    o.msg = 'The course is selected.';
    res.render('admin/checkup',o);
  });
  // submitted,marked,resubmittedに関しては何もしない
  // unsubmittedは今の実装ではありえないけど、点数やフィードバックは
  // 残してsubmittedに、removeedは、点数やフィードバック残して
  // resubmittedにする。ファイルが無かった場合は当然新しく
  // submittedの状態にする。
  router.get('/checkup_fix',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const course = req.query.course;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.admin = req.session.admin;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    if (!isAdmin(uid) && !(await isTeacher(uid,course))) { // 権限チェック
      o.selected_course = "";
      o.assistants = [];
      o.msg = `You do not have parmission to fix the course marks(course=${course}).`;
      res.render('admin/checkup',o);
      return;
    }
    if (!course) { // コースの指定がない場合
      o.selected_course = "";
      o.forgotten_files = [];
      o.msg = 'ERROR! course is not specified.';
      res.render('admin/checkup',o);
      return;
    }
    o.selected_course = course;
    o.forgotten_files = [];
    const excercises = await rg.colExcercises.find({course}).sort({label:1}).toArray();
    const students = await rg.colStudents.find({course}).sort({account:1}).toArray();
    for (s of students) {
      for (e of excercises) {
        let the_path = rg.config.files.root;
        the_path = path.join(the_path,rg.config.identity.classifier(s.account));
        the_path = path.join(the_path,s.account);
        the_path = path.join(the_path,e.submit);
        const stats = await stat(the_path);
        if (!stats)
          continue;
        const mark = await rg.colMarks.findOne({course:e.course,label:e.label,student:s.account});
        if (mark) {
          if (mark.status==='unsubmitted') {
            // 今の実装ではありえないけど一応
            const update_m = {
              status:'submitted',
              mark:0,
              feedbacks:[]
            };
            await rg.colMarks.updateOne({course:e.course,label:e.label,student:s.account},{$set:update_m});
            o.forgotten_files.push(the_path + " unsubmitted -> submitted");
          } else if (mark.status==='submitted') {
            // 何もしない
          } else if (mark.status==='marked') {
            // 何もしない
          } else if (mark.status==='resubmitted') {
            // 何もしない
          } else if (mark.status==='removed') {
            const update_m = {
              status:'resubmitted',
            };
            await rg.colMarks.updateOne({course:e.course,label:e.label,student:s.account},{$set:update_m});
            o.forgotten_files.push(the_path + " removed -> resubmitted");
          }
        } else {
          const new_m = {
            course:e.course,
            label:e.label,
            student:s.account,
            status:'submitted',
            mark:0,
            feedbacks:[]
          };
          await rg.colMarks.insertOne(new_m);
          o.forgotten_files.push(the_path + " none -> submitted");
        }
      }
    }
    o.msg = 'These files are detected and fix marks.';
    res.render('admin/checkup',o);
  });



  router.get("/", (req, res) => {
    let msg;
    if (!!req.session && !!req.session.webid) {
      msg = `You are logged in as ${req.session.webid}.`;
    } else {
      msg = 'You are not logged in.';
    }
    const baseUrl = rg.config.server.mount_path;
    res.render('admin/admin_top.ejs', {
      msg, baseUrl,
      teacher: req.session.teacher,
      sa: req.session.sa
    });
  });

  return router;
};

module.exports = init;
