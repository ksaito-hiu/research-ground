const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config.json');
const multer = require('multer');

const router = express.Router();

let db = null;
let colActions = null;
let colFiles = null;

// MongoDBのクライアントを受け取ってDBを初期化
// DB名は'research_ground'の決め打ち
router.set_mongo_client = async function(mc) {
  router.mongo_client = mc;
  db = mc.db('research_ground');
  colActions = await db.collection('actions');
  colFiles = await db.collection('files');
};

const storage = multer.diskStorage({
  destination: function(req,file,cb) {
    const webid = req.session.webid;
    let n = webid.lastIndexOf("/");
    let uid = webid.substring(n+1);
    n = uid.lastIndexOf("#");
    uid = uid.substring(0,n);
    const root_path = config.files.root + uid + req.query.path;
    cb(null,root_path);
  },
  filename: function (req,file,cb) {
    const name = file.originalname;
    cb(null,name);
  }
});
const upload = multer({storage: storage});

/*
 * ルーティング
 */
(async function() {
  const staticRouter = express.static(config.files.root);
  const parentDir = {
    name: '..',
    isDirectory: function() { return true; }
  };

  // フォルダの中一覧を非同期でゲット
  async function readdir(dir) {
    return new Promise((resolve,reject)=>{
      fs.readdir(dir,{withFileTypes: true},(err,dirents) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(dirents);
      });
    });
  }

  // 非同期ファイル削除
  async function removeFile(file_path) {
    return new Promise((resolve,reject)=>{
      fs.unlink(file_path,(err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(file_path);
      });
    });
  }

  // 非同期フォルダ削除
  async function removeDir(dir_path) {
    return new Promise((resolve,reject)=>{
      try {
        fs.rmdir(dir_path,(err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(dir_path);
        });
      } catch(err2) {
        reject(err2);
      }
    });
  }

  // 非同期フォルダ作成
  async function makeDir(dir_path) {
    return new Promise((resolve,reject)=>{
      fs.mkdir(dir_path,(err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(dir_path);
      });
    });
  }

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
    // 以下情報大のWebIDの付け方に依存
    let n = webid.lastIndexOf("/");
    let uid = webid.substring(n+1);
    n = uid.lastIndexOf("#");
    uid = uid.substring(0,n);
    req.session.uid = uid;
    next();
  }

  // アクセス件チェック
  // 上のloginCheckの後で呼ばれることを前提にしてる
  // のでreq.session.uidにuidが入っていて、
  // pathで'/:uid'のようにしてs学籍番号が
  // req.params.uidに入ることを前提にしてる
  function permissionCheck(req,res,next) {
    if (config.admin.includes(req.session.webid)) { // 管理者はOK
      next();
      return;
    }
    if (config.SA.includes(req.session.webid)) { // SAもOK
      next();
      return;
    }
    if (req.session.uid !== req.params.uid) {
      const msg = 'You do not have permission.';
      const baseUrl = config.server.mount_path;
      res.status(403).render('error.ejs',{msg,baseUrl});
      return;
    }
    next();
  }

  router.post('/upload',loginCheck,upload.array('files'),async (req,res)=>{
    const webid = req.session.webid;
    const uid = req.session.uid;
    let current_path;
    if (!!req.query.path)
      current_path = path.normalize(req.query.path);
    else
      current_path = '/';
    const files = await readdir(config.files.root + req.session.uid + current_path);
    files.unshift(parentDir);
    const baseUrl = config.server.mount_path+'/files';
    let msg = 'uploaded files are .......';
    const actions = [];
    const newFiles = [];
    const utime = new Date().getTime();
    for (f of req.files) {
      msg += f.originalname + ",";
      const file_path = uid+current_path+f.originalname;
      actions.push({type:'upload',utime,"path":file_path});
      newFiles.push({"path":file_path,isDir:false});
    }
    await colActions.insertMany(actions);
    await colFiles.insertMany(newFiles);
    const data = {
      msg,
      webid,
      uid,
      path: current_path,
      files,
      baseUrl
    };
    res.render('files/files.ejs',data);
  });

  router.get('/mkdir',loginCheck, async (req,res)=>{
    const webid = req.session.webid;
    const uid = req.session.uid;
    let current_path;
    if (!!req.query.path)
      current_path = path.normalize(req.query.path);
    else
      current_path = '/';
    let msg = 'mkdir: ';
    try {
      const dir = req.query.dir;
      msg += await makeDir(config.files.root+uid+current_path+dir);
      const utime = new Date().getTime();
      const dirPath = uid+current_path+dir;
      await colActions.insertOne({type:'mkdir',utime,"path":dirPath});
      await colFiles.insertOne({path:dirPath,isDir:true});
    } catch (err) {
      msg += err;
    }
    const files = await readdir(config.files.root + req.session.uid + current_path);
    files.unshift(parentDir);
    const baseUrl = config.server.mount_path+'/files';
    const data = {
      msg,
      webid,
      uid,
      path: current_path,
      files,
      baseUrl
    };
    res.render('files/files.ejs',data);
  });

  router.get('/remove',loginCheck, async (req,res)=>{
    const webid = req.session.webid;
    const uid = req.session.uid;
    let current_path;
    if (!!req.query.path)
      current_path = path.normalize(req.query.path);
    else
      current_path = '/';
    let files = await readdir(config.files.root + req.session.uid + current_path);
    files.unshift(parentDir);
    let rments;
    if (Array.isArray(req.query.rment))
      rments = req.query.rment;
    else
      rments = [req.query.rment];
    let ps = [];
    const utime = new Date().getTime();
    const actions = [];
    const rmEntries = [];
    for (rment of rments) {
      for (f of files) {
        if (rment === f.name) {
          if (f.isDirectory()) {
            const dir = config.files.root+uid+current_path+rment;
            ps.push(removeDir(dir));
            const dirPath = uid+current_path+rment;
            actions.push({type:'rmdir',utime,"path":dirPath});
            rmEntries.push({"path":dirPath});
          } else {
            const rmFile = config.files.root+uid+current_path+rment;
            ps.push(removeFile(rmFile));
            const rmFilePath = uid+current_path+rment;
            actions.push({type:'rm',utime,"path":rmFilePath});
            rmEntries.push({"path":rmFilePath});
          }
          break;
        }
      }
    }
    await colActions.insertMany(actions);
    for (let e of rmEntries)
        await colFiles.deleteMany(e);
    let msg;
    try {
      ps = await Promise.all(ps);
      msg = 'Removed files are ...';
      for (rment of ps) {
        msg += rment + ",";
      }
    } catch(e) {
      console.log(e);
      msg = 'some error was occured. '+e.toString();
    }
    files = await readdir(config.files.root + req.session.uid + current_path);
    files.unshift(parentDir);
    const baseUrl = config.server.mount_path+'/files';
    const data = {
      msg,
      webid,
      uid,
      path: current_path,
      files,
      baseUrl
    };
    res.render('files/files.ejs',data);
  });

  router.get('/:uid/*',loginCheck,
             permissionCheck,
             staticRouter);
  router.get('/',loginCheck, async (req,res)=>{
    const webid = req.session.webid;
    const uid = req.session.uid;
    let current_path;
    if (!!req.query.path)
      current_path = path.normalize(req.query.path);
    else
      current_path = '/';
    const files = await readdir(config.files.root + req.session.uid + current_path);
    files.unshift(parentDir);
    const baseUrl = config.server.mount_path+'/files';
    const data = {
      msg: 'files module!',
      webid,
      uid,
      path: current_path,
      files,
      baseUrl
    };
    res.render('files/files.ejs',data);
  });
})();

module.exports = router;
