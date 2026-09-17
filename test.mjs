import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=mkdtempSync(path.join(os.tmpdir(),'shiguang-test-'));
const child=spawn(process.execPath,['server.mjs'],{cwd:import.meta.dirname,env:{...process.env,PORT:'18971',HOST:'127.0.0.1',DATA_DIR:dir,ADMIN_PASSWORD:'test-admin'}});
let cookie='';
async function call(route,method='GET',data,customCookie=cookie){const r=await fetch('http://127.0.0.1:18971'+route,{method,headers:{'Content-Type':'application/json',Cookie:customCookie},body:data?JSON.stringify(data):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
try{
 await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('error',reject);child.once('exit',()=>reject(Error('server exited')));});
 assert.equal((await call('/api/admin/content')).status,401);
 let r=await call('/api/user/register','POST',{username:'测试用户',password:'password123'});assert.equal(r.status,200);cookie=r.cookie;assert.equal((await call('/api/user/me')).body.user.username,'测试用户');assert.equal((await call('/api/admin/content')).status,401);
 assert.equal((await call('/api/user/register','POST',{username:'测试用户',password:'password123'})).status,409);
 assert.equal((await call('/api/user/login','POST',{username:'测试用户',password:'wrongpass'})).status,401);
 await call('/api/user/logout','POST');assert.equal((await call('/api/user/me')).body.user,null);
 assert.equal((await call('/api/user/login','POST',{username:'测试用户',password:'password123'})).status,200);
 assert.ok(!readFileSync(path.join(dir,'users.json'),'utf8').includes('password123'));
 r=await call('/api/login','POST',{password:'test-admin'});cookie=r.cookie;
 let c=(await call('/api/admin/content')).body;c.share={label:'分享给朋友',title:'测试分享',text:'测试内容',url:'https://example.com'};c.tools=[{name:'示例工具',description:'网页工具',url:'https://example.com',published:true},{name:'隐藏',description:'',url:'https://example.com',published:false}];
 assert.equal((await call('/api/admin/content','PUT',c)).status,200);
 const pub=(await call('/api/content')).body;assert.equal(pub.share.label,'分享给朋友');assert.equal(pub.tools.length,1);
 c=(await call('/api/admin/content')).body;c.tools[0].url='javascript:alert(1)';assert.equal((await call('/api/admin/content','PUT',c)).status,400);
 for(const url of ['/','/admin','/mobile.js','/mono.css'])assert.equal((await fetch('http://127.0.0.1:18971'+url)).status,200);
 console.log('PASS: registration, login, logout, password hashing, admin isolation, share/tools publishing, URL validation and assets');
}finally{child.kill();await new Promise(r=>child.once('exit',r));rmSync(dir,{recursive:true,force:true});}
