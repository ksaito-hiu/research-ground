const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();

/*
 * ルーティング
 */
const init = async function(rg) {
  // 上記引数のrgはresearch-groundのインスタンス。rg.configで設定、
  // rg.colCoursesなどでMongoDBのcollectionにアクセスできる。

  // ファイルアップロードのためのミドルウェア
  // loginCheck,permissionCheckは済んでる前提
  const storage = multer.diskStorage({
    destination: function(req,file,cb) {
      const webid = req.session.webid;
      const uid = rg.config.identity.webid2id(webid);
      const dirs = rg.config.identity.classifier(uid);
      let current_path;
      if (!!req.query.path)
        current_path = path.normalize(req.query.path);
      else
        current_path = '/';
      const the_path = rg.config.files.root + dirs + uid + current_path;
      cb(null,the_path);
    },
    filename: function (req,file,cb) {
      const name = file.originalname;
      cb(null,name);
    }
  });
  const upload = multer({storage: storage});

  // ファイルアップロードのためのミドルウェア
  // REST API用
  // loginCheck,permissionCheckは済んでる前提
  const storageREST = multer.diskStorage({
    destination: function(req,file,cb) {
      const the_path = path.join(rg.config.files.root,req.path);
      const p_path = path.dirname(the_path);
      cb(null,p_path);
    },
    filename: function (req,file,cb) {
      const name = file.originalname;
      cb(null,name);
    }
  });
  const uploadREST = multer({storage: storageREST});

  // express.staticの前に置くことでディレクトリの
  // indexを表示できるようにするミドルウェア
  // ただし、下の方にあるloginCheckとpermissionCheckの
  // 後に置かれておりreq.session.uidとかが使える前提で
  // 書かれている
  const dirIndex = async function(req,res,next) {
    const the_path = rg.config.files.root + req.path;
    const stats = await stat(the_path);
    if (!!stats && stats.isDirectory()) { // ここの判定はシンボリックリンクでもOKっぽい
      if (req.accepts(['html', 'json'])==='json') {
        const files = await readdir(the_path);
        res.json({files});
        return;
      } else {
        if (the_path.endsWith('/')) {
          const files = await readdir(the_path);
          files.unshift(parentDir);
          let c_path = path.join(rg.config.server.mount_path,'files/',req.path);
          const baseUrl = rg.config.server.mount_path;
          res.render('files/dir_index', {
            c_path, files, baseUrl,
            admin: req.session.admin,
            teacher: req.session.teacher,
            sa: req.session.sa
          });
          return;
        } else {
          const basename = path.basename(the_path);
          res.redirect('./'+basename+'/');
          return;
        }
      }
    }
    next();
  };
  const staticRouter = express.static(rg.config.files.root);
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
  // シンボリックリンクもリンク先の属性で
  // 取得したいのだが、ただのfs.readdirの
  // withFileTypes:trueではうまくいかなかったので
  // 以下のようにした。
  async function readdir(dir) {
    return new Promise((resolve,reject) => {
      fs.readdir(dir,{},async function(err,dirents) {
        if (err) {
          reject(err);
          return;
        }
        const files = [];
        for (let e of dirents) {
          const f = await stat(path.join(dir,e));
          f.name = e; // 無理矢理追加
          files.push(f);
        }
        resolve(files);
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

  // アクセス件チェック
  // 上のloginCheckの後で呼ばれることを前提にしてる
  // のでreq.session.webidにwebidが入っていて、
  // req.session.uidにuidが入っている前提で処理している。
  async function permissionCheck(req,res,next) {
    if (await isAdmin(req.session.uid)) { // 管理者はOK
      next();
      return;
    }
    if (await isTeacher(req.session.uid)) { // 先生もOK GAHA
      next();
      return;
    }
    if (await isAssistant(req.session.uid)) { // SAもOK GAHA
      next();
      return;
    }
    const uid = req.session.uid;
    const the_dir = '/'+rg.config.identity.classifier(uid)+uid;
//console.log("GAHA: req.path="+req.path);
//console.log("GAHA: the_dir ="+the_dir);
    if (!req.path.startsWith(the_dir)) {
      const msg = 'You do not have permission.';
      const baseUrl = rg.config.server.mount_path;
      res.status(403).render('error.ejs', {
        msg, baseUrl,
        admin: req.session.admin,
        teacher: req.session.teacher,
        sa: req.session.sa
      });
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
    const the_path = rg.config.files.root+rg.config.identity.classifier(uid)+uid+current_path;
    const files = await readdir(the_path);
    files.unshift(parentDir);
    const baseUrl = rg.config.server.mount_path;
    let msg = 'uploaded files are .......';
    for (f of req.files) {
      msg += f.originalname + ",";
      const file_path = current_path+f.originalname;
      rg.observer(uid,'file_upload',{'path':file_path});
    }
    const user_dir = baseUrl+'files/'+rg.config.identity.classifier(uid)+uid;
    const data = {
      msg,
      webid,
      path: current_path,
      files,
      user_dir,
      baseUrl,
      admin: req.session.admin,
      teacher: req.session.teacher,
      sa: req.session.sa
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
      const the_path = rg.config.files.root+rg.config.identity.classifier(uid)+uid+current_path+dir;
      msg += await makeDir(the_path);
      const utime = new Date().getTime();
      const dirPath = uid+current_path+dir;
      rg.observer(uid,'mkdir',{'path':dirPath});
    } catch (err) {
      msg += err;
    }
    const files = await readdir(rg.config.files.root+rg.config.identity.classifier(uid)+uid+current_path);
    files.unshift(parentDir);
    const baseUrl = rg.config.server.mount_path;
    const user_dir = baseUrl+'files/'+rg.config.identity.classifier(uid)+uid;
    const data = {
      msg,
      webid,
      path: current_path,
      files,
      user_dir,
      baseUrl,
      admin: req.session.admin,
      teacher: req.session.teacher,
      sa: req.session.sa
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
    let files = await readdir(rg.config.files.root+rg.config.identity.classifier(uid)+uid+current_path);
    files.unshift(parentDir);
    let rments;
    if (Array.isArray(req.query.rment))
      rments = req.query.rment;
    else
      rments = [req.query.rment];
    let ps = [];
    const utime = new Date().getTime();
    for (rment of rments) {
      for (f of files) {
        if (rment === f.name) {
          if (f.isDirectory()) {
            const dir = rg.config.files.root+rg.config.identity.classifier(uid)+uid+current_path+rment;
            ps.push(removeDir(dir));
          } else {
            const rmFile = rg.config.files.root+rg.config.identity.classifier(uid)+uid+current_path+rment;
            ps.push(removeFile(rmFile));
          }
          break;
        }
      }
    }
    let msg;
    try {
      ps = await Promise.all(ps);
      msg = 'Removed files are ...';
      for (rment of ps) {
        msg += rment + ",";
        for (f of files) {
          if (path.basename(rment) === f.name) {
            const the_path = current_path+path.basename(rment);
            if (f.isDirectory()) {
              rg.observer(uid,'dir_remove',{'path':the_path});
            } else {
              rg.observer(uid,'file_remove',{'path':the_path});
            }
          }
        }
      }
    } catch(e) {
      console.log(e);
      msg = 'some error was occured. '+e.toString();
    }
    files = await readdir(rg.config.files.root+rg.config.identity.classifier(uid)+uid+current_path);
    files.unshift(parentDir);
    const baseUrl = rg.config.server.mount_path;
    const user_dir = baseUrl+'files/'+rg.config.identity.classifier(uid)+uid;
    const data = {
      msg,
      webid,
      path: current_path,
      files,
      user_dir,
      baseUrl,
      admin: req.session.admin,
      teacher: req.session.teacher,
      sa: req.session.sa
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
    const the_path = rg.config.files.root + rg.config.identity.classifier(uid) + uid + current_path
    const files = await readdir(the_path);
    files.unshift(parentDir);
    const baseUrl = rg.config.server.mount_path;
    const user_dir = baseUrl+'files/'+rg.config.identity.classifier(uid)+uid;
    const data = {
      msg: 'files module!',
      webid,
      path: current_path,
      files,
      user_dir,
      baseUrl,
      admin: req.session.admin,
      teacher: req.session.teacher,
      sa: req.session.sa
    };
    res.render('files/files.ejs',data);
  });

  router.get('/*',loginCheck,
             permissionCheck,
             dirIndex,
             staticRouter);

  // ファイルやディレクトリを作成，もしくはファイルの更新
  // パスの最後に'/'が着いてるかどうかで，ファイルかディレクトリか
  // を区別することにする。
  router.put('/*',loginCheck,permissionCheck,uploadREST.single('file'),async (req,res)=>{
    const webid = req.session.webid;
    const uid = req.session.uid;
    try {
      const r_path = path.join(rg.config.files.root,req.path);
      const d_path = path.dirname(r_path);
      let stats = await stat(d_path);
      if (!!stats && stats.isDirectory()) {
        if (r_path.endsWith('/')) {
          await makeDir(r_path);
          rg.observer(uid,'mkdir',{'path':r_path});
          res.json({ok: true});
        } else {
          //req.fileがアップされたファイルの情報
          const p = req.path.substring(rg.config.identity.classifier(uid).length());
          rg.observer(uid,'file_upload',{'path':p});
          res.json({ok: true});
        }
      } else {
        res.json({ok: false, msg: 'There is no parent directory.'});
      }
    } catch(e) {
      // ほんとはもっとエラーの詳細も返したい。
      res.json({ok: false});
    }
  });

  // 単独のファイル，またはディレクトリの削除
  // ディレクトリは空でなければ消せない。
  router.delete('/*',loginCheck,permissionCheck,async (req,res)=>{
    const webid = req.session.webid;
    const uid = req.session.uid;
    try {
      const r_path = rg.config.files.root+req.path;
      const stats = await stat(r_path);
      if (!!stats && stats.isDirectory()) {
        await removeDir(r_path);
        res.json({ok: true});
      } else {
        await removeFile(r_path);
        res.json({ok: true});
      }
    } catch(e) {
      // ほんとはもっとエラーの詳細も返したい。
      res.json({ok: false});
    }
  });

  // auth.jsの中から呼び出されて、uidのファイル提出場所
  // のデイレクトリが存在するかどうかチェックし、無かったら
  // 作成する。
  router.checkDir = async function(uid) {
    const the_path = rg.config.files.root + rg.config.identity.classifier(uid) + uid;
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
