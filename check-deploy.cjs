const https = require('https');
const TOKEN = 'nfp_j2PmJyDKLoTkyuGfhSDtfBYTP48T4r5h6a7c';
const SITE_ID = '29a4b923-94c5-4805-b20c-f930d0818548';

https.get({hostname:'api.netlify.com',path:'/api/v1/sites/'+SITE_ID+'/deploys?per_page=1',headers:{'Authorization':'Bearer '+TOKEN}},res=>{
  let d='';
  res.on('data',c=>d+=c);
  res.on('end',()=>{
    const r=JSON.parse(d);
    const deploy=r[0];
    console.log('Deploy state:',deploy.state,'URL:',deploy.ssl_url);
    console.log('Commit ref:',deploy.commit_ref);
    console.log('Deploy source:',deploy.deploy_source);
    if(deploy.available_functions&&deploy.available_functions.length>0){
      deploy.available_functions.forEach(f=>console.log('Function:',f.n,'Runtime:',f.r,'Status:',f.state));
    } else {
      console.log('No functions found');
    }
  });
});
