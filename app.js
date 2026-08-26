const express = require('express');

(async ()=>{
  const config = require('./config.json');
  // idをwebidに変換する関数を設定する
  config.identity.id2webid = function(id) {
    return 'https://id.do-johodai.ac.jp/people/'+id;
  };
  // webidをidに変換する関数を設定する
  // もし、この関数がnullを返してきたならばログインを拒否する
  config.identity.webid2id = function(webid) {
    const m = webid.match(/^https:\/\/id.do-johodai.ac.jp\/people\/(.+)$/);
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
  
  const research_ground = await new require('./research-ground')(config);

  const app = express();

  app.get('/robots.txt',(req,res)=>{
    res.header('Content-Type', 'text/plain');
    res.end("User-agent: *\nDisallow: /\n");
  });

  // mount_pathの末尾の'/'を取り除いたものをマウント先のパスとして使う
  // (mount_pathが'/'だけの場合はそのまま'/'にマウントする)
  const mountPath = config.server.mount_path.replace(/\/+$/,'') || '/';
  app.use(mountPath,research_ground);

  app.listen(config.server.port,()=>{
    console.log(`research-ground started. port=${config.server.port}.`);
  });
})();
