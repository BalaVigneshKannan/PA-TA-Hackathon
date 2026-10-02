import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const child=spawn(process.execPath,['src/server.js'],{cwd:fileURLToPath(new URL('./backend/',import.meta.url)),stdio:'inherit',env:{...process.env,SERVE_FRONTEND:'true',PORT:'5173',APP_ORIGIN:'http://127.0.0.1:5173'}});
child.on('exit',code=>{process.exitCode=code??0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill());
