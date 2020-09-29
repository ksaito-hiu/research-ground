const express = require('express');
const path = require('path');
const fs = require('fs');
const mongo = require('mongodb');

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
    if (! isAdmin(uid,null)) {
      o.msg = 'You do not have parmissions to edit course data.';
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
      const res = await rg.colTeachers.findOne({account:uid,course});
      if (res)
        return true;
      else
        return false;
    } else {
      const res = await rg.colTeachers.findOne({account:uid});
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
      const res = await rg.colAssistants.findOne({account:uid,course});
      if (res)
        return true;
      else
        return false;
    } else {
      const res = await rg.colAssistants.findOne({account:uid});
      if (res)
        return true;
      else
        return false;
    }
  }




  router.get('/marking',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    const course = req.query.course;
    const label = req.query.label;
    let student = req.query.student;
    // コースの情報無しの状態でも権限が無いと判断できる場合の応答
    if (!isAdmin(uid) && !(await isTeacher(uid,null)) && !(await isAssistant(uid,null))) {
      o.msg = "You do not have permission.";
      res.render('error',o);
      return;
    }
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    if (!course) { // コースの情報が無い場合の応答
      o.students = [];
      o.label=o.course=o.student="";
      o.excercises = [];
      o.excercise = {category:'',point:2,weight:5};
      o.question_url = o.submit_url = "";
      o.mark = {student:"", status:"", mark:"", feedbacks:[]};
      o.feedbacks = [];
      o.msg = `At first, select the course. Then push search button.`;
      res.render('marking/marking',o);
      return;
    }
    o.excercises = await rg.colExcercises.find({course}).sort({label:1}).toArray();
    // コースの情報を含めて権限が無い場合の応答
    if (!isAdmin(uid) && !(await isTeacher(uid,course)) && !(await isAssistant(uid,course))) {
      o.students = [];
      o.course=course;
      o.label=label;
      o.student="";
      o.excercise = {category:'',point:2,weight:5};
      o.question_url = o.submit_url = "";
      o.mark = {student:"", status:"", mark:"", feedbacks:[]};
      o.feedbacks = [];
      o.msg = `You do not have permission to mark the course(${course})`;
      res.render('marking/marking',o);
      return;
    }
    o.students = await rg.colStudents.find({course}).sort({account:1}).toArray();
    student = student || o.students[0].account;
    if (label) { // 採点対象の指定がある場合
      o.excercise = await rg.colExcercises.findOne({course,label});
      o.question_url = o.excercise.question;
//if (true) {o.question_url='';console.log('debug GAHA');} // デバッグ時に上の行のかわりに有効にすると楽
      o.submit_url = rg.config.server.mount_path+ 'files/' + rg.config.identity.classifier(student) + student + o.excercise.submit;
      if (o.excercise) { // 採点対象がちゃんと存在する場合
        o.feedbacks = await rg.colFeedbacks.find({excercise:o.excercise._id}).sort({cout:-1}).toArray();
        o.mark = await rg.colMarks.findOne({excercise:o.excercise._id,student});
        o.label=label; o.course=course; o.student = student;
        if (o.mark) { // 過去の採点結果がある場合
          o.msg = "Old marking was retrived.";
        } else { // 過去の採点結果が無い場合
          o.mark = {student:"", status:"", mark:"", feedbacks:[]};
          o.msg = "Old marking was not found.";
        }
      } else { // 採点対象が存在しない場合
        o.excercise = {category:'',point:2,weight:5};
        o.question_url = o.submit_url = "";
        o.mark = {student:"", status:"", mark:"", feedbacks:[]};
        o.feedbacks = [];
        o.msg = "Specified excercise was not found.";
      }
    } else { // 採点対象の指定が無い場合
      o.label=label; o.course=course; o.student = student;
      o.mark = {student:"", status:"", mark:"", feedbacks:[]};
      o.excercise = {category:'',point:2,weight:5};
      o.question_url = o.submit_url = "";
      o.feedbacks = [];
      o.msg = "Select excercise and student.";
    }
    res.render('marking/marking',o);
  });
  router.get('/marking_mark',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    const label = req.query.label
    const course = req.query.course;
    const student = req.query.student;
    const mark = req.query.mark;
    const feedback = req.query.feedback;
    // コースの情報無しの状態でも権限が無いと判断できる場合の応答
    if (!course && !isAdmin(uid) && !(await isTeacher(uid,null)) && !(await isAssistant(uid,null))) {
      o.msg = "You do not have permission.";
      res.render('error',o);
      return;
    }
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();    
    // コースの情報を含めて権限が無い場合の応答
    if (!isAdmin(uid) && !(await isTeacher(uid,course)) && !(await isAssistant(uid,course))) {
      o.msg = "You do not have permission.";
      res.render('error',o);
      return;
    }
    o.excercises = await rg.colExcercises.find({course}).sort({label:1}).toArray();
    // 必要な情報が全てそろってない時の応答(feedbackは省略可)
    if (!course || !label || !student || !mark) {
      o.msg = "There are not enough parameters.";
      res.render('error',o);
      return;
    }
    o.excercise = await rg.colExcercises.findOne({course,label});
    let mark_data = await rg.colMarks.findOne({excercise:o.excercise._id,student});
    if (!mark_data) {
      mark_data = {excercise:o.excercise._id, student, status:'marked', mark, feedbacks:[feedback]};
    } else {
      mark_data.status = 'marked';
      mark_data.mark = mark;
      mark_data.feedbacks.push(feedback); // 新しいfeedbackを最後に追加
    }
    const ret = await rg.colMarks.updateOne({excercise:o.excercise._id,student},{$set:mark_data},{upsert:true});
    o.students = await rg.colStudents.find({course}).sort({account:1}).toArray();
    o.label=label; o.course=course; o.student = student;
    o.mark = mark_data;
    o.question_url = o.submit_url = "";
    o.feedbacks = await rg.colFeedbacks.find({}).sort({count:-1}).toArray();
    o.msg = `Marked!(${course},${label},${student})`;
    res.render('marking/marking',o);
  });
  router.get('/feedback_reserve',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const excercise_id = req.query.excercise_id;
    const feedback = req.query.feedback;
    const e = await colExcercises.findOne({_id: new mongo.ObjectID(excercise_id)});
    const course = e.course;
    // コースの情報無しの状態でも権限が無いと判断できる場合の応答
    if (!course && !isAdmin(uid) && !(await isTeacher(uid,null)) && !(await isAssistant(uid,null))) {
      res.json({result:'error'});
      return;
    }
    // コースの情報を含めて権限が無い場合の応答
    if (!isAdmin(uid) && !(await isTeacher(uid,course)) && !(await isAssistant(uid,course))) {
      res.json({result:'error'});
      return;
    }
    const eid = new mongo.ObjectID(excercise_id);
    const data = {excercise:eid,feedback,count:1};
    const ret = await rg.colFeedbacks.insertOne(data);
    if (ret.insertedCount===1) {
      res.json({result:'ok',feedback_id:ret.insertedId,feedback});
      return;
    } else {
      res.json({result:'error'});
      return;
    }
  });
  router.get('/feedback_del',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const feedback_id = req.query.feedback_id;
    const fid = new mongo.ObjectID(feedback_id);
    const f = await colFeedbacks.findOne({_id: fid});
    const e = await colExcercises.findOne({_id:f.excercise});
    const course = e?e.course:'';
    // コースの情報無しの状態でも権限が無いと判断できる場合の応答
    if (!course && !isAdmin(uid) && !(await isTeacher(uid,null)) && !(await isAssistant(uid,null))) {
      res.json({result:'error'});
      return;
    }
    // コースの情報を含めて権限が無い場合の応答
    if (!isAdmin(uid) && !(await isTeacher(uid,course)) && !(await isAssistant(uid,course))) {
      res.json({result:'error'});
      return;
    }
    const ret = await rg.colFeedbacks.deleteOne({_id:fid});
    if (ret.deletedCount===1) {
      res.json({result:'ok'});
      return;
    } else {
      res.json({result:'error'});
      return;
    }
  });
  router.get('/feedback_countup',loginCheck,async (req,res)=>{
    const uid = req.session.uid;
    const feedback_id = req.query.feedback_id;
    const f = await colFeedbacks.findOne({_id: new mongo.ObjectID(feedback_id)});
    const e = await colExcercises.findOne({_id:f.excercises});
    const course = e.course;
    // コースの情報無しの状態でも権限が無いと判断できる場合の応答
    if (!course && !isAdmin(uid) && !(await isTeacher(uid,null)) && !(await isAssistant(uid,null))) {
      res.json({result:'error'});
      return;
    }
    // コースの情報を含めて権限が無い場合の応答
    if (!isAdmin(uid) && !(await isTeacher(uid,course)) && !(await isAssistant(uid,course))) {
      res.json({result:'error'});
      return;
    }
    const fid = new mongo.ObjectID(feedback_id);
    const ret = await rg.colFeedbacks.updateOne({_id:fid},{$inc: {count: 1}});
console.log("GAHA: "+JSON.stringify(ret,null,2));
    if (ret.insertedCount===1) {
      res.json({result:'ok'});
      return;
    } else {
      res.json({result:'error'});
      return;
    }
  });




  router.get('/statistics',loginCheck,async (req,res)=>{
    const course = req.query.course;
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.courses = await rg.colCourses.find({}).sort({id:1}).toArray();
    if (!course) {
      o.course = "";
      o.excercises = [];
      o.students = [];
      o.msg = "At first, select the course.";
    } else {
      o.course = course;
      o.excercises = await colExcercises.find({course}).sort({label:1}).toArray();
      o.students = await colStudents.find({course}).sort({account:1}).toArray();
      o.marks = {};
      for (const e of o.excercises) {
        const ms = await colMarks.find({excercise:e._id}).toArray();
        o.marks[e.label] = ms;
      }
      o.submit_root=rg.config.server.mount_path+'files/';
      o.marking_url=rg.config.server.mount_path+'marking/marking';
      o.classifier = rg.config.identity.classifier; // aaaaa
      o.msg = `Statistics of ${course}.`;
    }
    res.render('marking/statistics',o);
  });





  router.get("/",loginCheck, (req, res) => {
    const o = {}; // ejsにわたすデーター
    o.baseUrl = rg.config.server.mount_path;
    o.teacher = req.session.teacher;
    o.sa = req.session.sa;
    o.msg = `Marking.`;
    res.render('marking/marking_top',o);
  });

  return router;
};

module.exports = init;
