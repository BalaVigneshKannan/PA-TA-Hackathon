import {fileURLToPath} from 'node:url';
import express from 'express';
import {openDatabase} from './db.js';
import {createApp} from './app.js';
const db=await openDatabase();
const production=process.env.NODE_ENV==='production';
const intranetConfigured=['INTRANET_ISSUER','INTRANET_AUDIENCE','INTRANET_PUBLIC_KEY'].some(k=>process.env[k]);
const app=createApp(db,{secret:process.env.JWT_SECRET,origin:process.env.APP_ORIGIN,production,
 universityDomain:process.env.UNIVERSITY_DOMAIN||'dubai.bits-pilani.ac.in',
 intranet:intranetConfigured?{issuer:process.env.INTRANET_ISSUER,audience:process.env.INTRANET_AUDIENCE,publicKey:process.env.INTRANET_PUBLIC_KEY}:null});
if(production || process.env.SERVE_FRONTEND==='true'){
 const dist=fileURLToPath(new URL('../../frontend/dist/',import.meta.url));
 app.use(express.static(dist));
 app.get('/{*path}',(_req,res)=>res.sendFile(`${dist}/index.html`));
}
const server=app.listen(Number(process.env.PORT)||3001,'127.0.0.1',()=>console.log('Portal API ready on http://127.0.0.1:'+(process.env.PORT||3001)));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await db.close();process.exit(0);}));
