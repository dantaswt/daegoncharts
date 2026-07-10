const https = require('https');
const options = { headers: { 'User-Agent': 'daegoncharts-agent' } };
https.get('https://api.github.com/repos/dantaswt/daegoncharts/actions/runs/29049214714/jobs', options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const job = json.jobs && json.jobs[0];
      if (!job) {
        console.log('NO_JOB');
        return;
      }
      console.log('keys:', Object.keys(job).join(', '));
      console.log('steps?' , !!job.steps);
      console.log('steps length:', job.steps && job.steps.length);
      console.log('name:', job.name);
      console.log('html_url:', job.html_url);
      console.log('raw error names:', JSON.stringify(job, null, 2).slice(0, 2000));
    } catch (e) {
      console.error('PARSE_ERROR', e.message);
      console.log(data.slice(0, 1000));
    }
  });
}).on('error', (err) => console.error('ERR', err.message));
