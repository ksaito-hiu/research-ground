const express = require('express');

(async ()=>{
  const config = require('./config.json');
  // idをwebidに変換する関数を設定する
  config.identity.id2webid = function(id) {
    return 'https://id.do-johodai.ac.jp/people/'+id+'#me';
  };
  // webidをidに変換する関数を設定する
  // もし、この関数がnullを返してきたならばログインを拒否する
  config.identity.webid2id = function(webid) {
    const m = webid.match(/^https:\/\/id.do-johodai.ac.jp\/people\/([^#]+)#[^#]+$/);
    if (!m) return null;
    return m[1];
  };
  // idに応じてディレクトリの階層を決定する関数
  config.identity.classifier = function(id) {
    const m = id.match(/^(s....)(..).../);
    if (!!m) {
      return m[1]+'/'+m[2]+'/';
    } else if (id.startsWith('f')) {
      return 'faculty/';
    } else {
      return 'unknown/';
    }
  };
  // ファイル提出を検知して処理するための関数
  // (今はまだなにもさせない)
  config.files.hook = function(path,uid,utime) {
    //console.log("GAHA: ファイルが提出されました。");
    //console.log("path="+path+", uid="+uid+", utime="+utime);
  };
  
  const research_ground = await require('./research-ground')(config);

  const app = express();

  app.get('/robots.txt',(req,res)=>{
    res.header('Content-Type', 'text/plain');
    res.end("User-agent: *\nDisallow: /\n");
  });

  app.use('/',research_ground);

  app.listen(config.server.port,()=>{
    console.log(`research-ground started. port=${config.server.port}.`);
  });
})();
