const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();

/*
 * ルーティング
 */
const init = async function(config) {
  let colActions = null;

  // MongoDBのクライアントを受け取ってDBを取得し
  // actionを記録するためのcollectionを取得。
  // DB名は'research_ground'の決め打ち
  router.set_mongo_client = async function(mc) {
    const db = mc.db('research_ground');
    colActions = await db.collection('actions');
  };

  const storage = multer.diskStorage({
    destination: function(req,file,cb) {
      const webid = req.session.webid;
      const uid = config.identity.webid2id(webid);
      const dirs = config.identity.classifier(uid);
      let current_path;
      if (!!req.query.path)
        current_path = path.normalize(req.query.path);
      else
        current_path = '/';
      const the_path = config.files.root + dirs + uid + current_path;
      cb(null,the_path);
    },
    filename: function (req,file,cb) {
      const name = file.originalname;
      cb(null,name);
    }
  });
  const upload = multer({storage: storage});

  // express.staticの前に置くことでディレクトリの
  // indexを表示できるようにするミドルウェア
  // ただし、下の方にあるloginCheckとpermissionCheckの
  // 後に置かれておりreq.session.uidとかが使える前提で
  // 書かれている
  const dirIndex = async function(req,res,next) {
    const the_path = config.files.root + req.path;
    const stats = await stat(the_path);
    if (!!stats && stats.isDirectory()) {
      if (the_path.endsWith('/')) {
        const files = await readdir(the_path);
        files.unshift(parentDir);
        let c_path = path.join(config.server.mount_path,'/files/',req.path);
        res.render('files/dir_index',{c_path,files});
        return;
      } else {
        const basename = path.basename(the_path);
        res.redirect('./'+basename+'/');
        return;
      }
    }
    next();
  };
  const staticRouter = express.static(config.files.root);
  const parentDir = {
    name: '..',
    isDirectory: function() { return true; }
  };

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

  // 非同期フォルダ作成(非再帰的)
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

  // 非同期フォルダ作成(再帰的)
  async function makeDirR(dir_path) {
    return new Promise((resolve,reject)=>{
      fs.mkdir(dir_path,{recursive:true},(err) => {
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
    const uid = config.identity.webid2id(webid);
    req.session.uid = uid;
    next();
  }

  // アクセス件チェック
  // 上のloginCheckの後で呼ばれることを前提にしてる
  // のでreq.session.webidにwebidが入っていて、
  // req.session.uidにuidが入っている前提で処理している。
  function permissionCheck(req,res,next) {
    if (config.admin.includes(req.session.webid)) { // 管理者はOK
      next();
      return;
    }
    if (config.SA.includes(req.session.webid)) { // SAもOK
      next();
      return;
    }
    const uid = req.session.uid;
    const the_dir = '/'+config.identity.classifier(uid)+uid;
//console.log("GAHA: req.path="+req.path);
//console.log("GAHA: the_dir ="+the_dir);
    if (!req.path.startsWith(the_dir)) {
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
    const the_path = config.files.root+config.identity.classifier(uid)+uid+current_path;
    const files = await readdir(the_path);
    files.unshift(parentDir);
    const baseUrl = config.server.mount_path+'/files';
    let msg = 'uploaded files are .......';
    const actions = [];
    const utime = new Date().getTime();
    for (f of req.files) {
      msg += f.originalname + ",";
      const file_path = uid+current_path+f.originalname;
      actions.push({type:'upload',utime,"path":file_path});
      if (!!config.files.hook)
        config.files.hook(current_path+f.originalname,uid,utime);
    }
    await colActions.insertMany(actions);
    const user_dir = baseUrl+'/'+config.identity.classifier(uid)+uid;
    const data = {
      msg,
      webid,
      path: current_path,
      files,
      user_dir,
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
      const the_path = config.files.root+config.identity.classifier(uid)+uid+current_path+dir;
      msg += await makeDir(the_path);
      const utime = new Date().getTime();
      const dirPath = uid+current_path+dir;
      await colActions.insertOne({type:'mkdir',utime,"path":dirPath});
    } catch (err) {
      msg += err;
    }
    const files = await readdir(config.files.root+config.identity.classifier(uid)+uid+current_path);
    files.unshift(parentDir);
    const baseUrl = config.server.mount_path+'/files';
    const user_dir = baseUrl+'/'+config.identity.classifier(uid)+uid;
    const data = {
      msg,
      webid,
      path: current_path,
      files,
      user_dir,
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
    let files = await readdir(config.files.root+config.identity.classifier(uid)+uid+current_path);
    files.unshift(parentDir);
    let rments;
    if (Array.isArray(req.query.rment))
      rments = req.query.rment;
    else
      rments = [req.query.rment];
    let ps = [];
    const utime = new Date().getTime();
    const actions = [];
    for (rment of rments) {
      for (f of files) {
        if (rment === f.name) {
          if (f.isDirectory()) {
            const dir = config.files.root+config.identity.classifier(uid)+uid+current_path+rment;
            ps.push(removeDir(dir));
            const dirPath = uid+current_path+rment;
            actions.push({type:'rmdir',utime,"path":dirPath});
          } else {
            const rmFile = config.files.root+config.identity.classifier(uid)+uid+current_path+rment;
            ps.push(removeFile(rmFile));
            const rmFilePath = uid+current_path+rment;
            actions.push({type:'rm',utime,"path":rmFilePath});
          }
          break;
        }
      }
    }
    await colActions.insertMany(actions);
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
    files = await readdir(config.files.root+config.identity.classifier(uid)+uid+current_path);
    files.unshift(parentDir);
    const baseUrl = config.server.mount_path+'/files';
    const user_dir = baseUrl+'/'+config.identity.classifier(uid)+uid;
    const data = {
      msg,
      webid,
      path: current_path,
      files,
      user_dir,
      baseUrl
    };
    res.render('files/files.ejs',data);
  });

  router.get('/',loginCheck, async (req,res)=>{
    const webid = req.session.webid;
    const uid = req.session.uid;
    let current_path;
    if (!!req.query.path)
      current_path = path.normalize(req.query.path);
    else
      current_path = '/';
    const the_path = config.files.root + config.identity.classifier(uid) + uid + current_path
    const files = await readdir(the_path);
    files.unshift(parentDir);
    const baseUrl = config.server.mount_path+'/files';
    const user_dir = baseUrl+'/'+config.identity.classifier(uid)+uid;
    const data = {
      msg: 'files module!',
      webid,
      path: current_path,
      files,
      user_dir,
      baseUrl
    };
    res.render('files/files.ejs',data);
  });

  router.get('/*',loginCheck,
             permissionCheck,
             dirIndex,
             staticRouter);

  // auth.jsの中から呼び出されて、uidのファイル提出場所
  // のデイレクトリが存在するかどうかチェックし、無かったら
  // 作成する。
  router.checkDir = async function(uid) {
    const the_path = config.files.root + config.identity.classifier(uid) + uid;
    const stats = await stat(the_path);
    if (stats===null) {
      await makeDirR(the_path);
      return 'OK';
    }
    if (stats.isDirectory())
      return 'The dir is already exests.';
    else
      return `There is a file named ${uid} already.'`
  }

  return router;
};

module.exports = init;
