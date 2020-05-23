const express = require('express');

(async ()=>{
  const config = require('./config.json');
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
