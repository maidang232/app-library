import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url));
const dir=process.env.DATA_DIR||path.join(root,'data'); mkdirSync(dir,{recursive:true});
const file=path.join(dir,'content.json');
const seed={revision:1,announcement:'欢迎来到拾光软件库。这里的示例软件仅用于演示，请在后台添加你的正式内容。',banners:[{title:'发现好用的软件',subtitle:'精选工具，让每一天更轻松',color:'#c9efbc'}],apps:[{id:'sample-notes',name:'轻记 · 示例',category:'效率工具',version:'1.0.0',description:'随手记录灵感，整理每日清单。这是展示用的软件信息，尚未配置安装包。',downloadUrl:'',featured:true,published:true},{id:'sample-photo',name:'像素 · 示例',category:'图片处理',version:'1.0.0',description:'为日常照片增添一点色彩。这是展示用的软件信息。',downloadUrl:'',featured:true,published:true},{id:'sample-read',name:'读伴 · 示例',category:'阅读学习',version:'1.0.0',description:'给自己留一段安静阅读的时间。这是展示用的软件信息。',downloadUrl:'',featured:false,published:true}]};
let content=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):seed;
const password=process.env.ADMIN_PASSWORD||'admin123456';
const salt=randomBytes(16), hash=scryptSync(password,salt,32), sessions=new Map(), attempts=new Map();
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>262144)throw Error('请求内容过大');}return JSON.parse(raw||'{}');}
function validate(c){if(!c||typeof c.announcement!=='string'||c.announcement.length>2000||!Array.isArray(c.apps)||c.apps.length>1000||!Array.isArray(c.banners)||c.banners.length>8)throw Error('内容格式错误');
 const str=(v,n)=>typeof v==='string'&&v.length<=n; const ids=new Set();
 for(const a of c.apps){if(!a||!str(a.id,80)||!a.id||ids.has(a.id)||!str(a.name,100)||!a.name.trim()||!str(a.category,40)||!str(a.version,40)||!str(a.description,4000)||!str(a.downloadUrl,2000)||typeof a.featured!=='boolean'||typeof a.published!=='boolean')throw Error('软件信息不完整或编号重复');ids.add(a.id);if(a.downloadUrl){let u=new URL(a.downloadUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error('下载地址必须使用 HTTPS');}}
 for(const b of c.banners)if(!b||!str(b.title,100)||!str(b.subtitle,200)||!/^#[0-9a-f]{6}$/i.test(b.color))throw Error('轮播图内容格式错误');
 return {announcement:c.announcement,banners:c.banners.map(({title,subtitle,color})=>({title,subtitle,color})),apps:c.apps.map(({id,name,category,version,description,downloadUrl,featured,published})=>({id,name,category,version,description,downloadUrl,featured,published}))};}
const server=http.createServer(async(req,res)=>{try{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(['POST','PUT','DELETE'].includes(req.method)&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return send(res,403,{error:'来源不允许'});
 if(pathname==='/api/content'&&req.method==='GET')return send(res,200,{...content,apps:content.apps.filter(a=>a.published)});
 if(pathname==='/api/login'&&req.method==='POST'){const b=await body(req);if(typeof b.password!=='string'||b.password.length>256||!timingSafeEqual(scryptSync(b.password,salt,32),hash))return send(res,401,{error:'密码不正确'});const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+28800000);res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='1'?'; Secure':''}`);return send(res,200,{ok:true});}
 if(pathname.startsWith('/api/admin')){const token=(req.headers.cookie||'').match(/(?:^|;\s*)session=([a-f0-9]+)/)?.[1];if(!token||!(sessions.get(token)>Date.now()))return send(res,401,{error:'请先登录后台'});
 if(pathname==='/api/admin/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
 if(pathname==='/api/admin/content'&&req.method==='GET')return send(res,200,content);
 if(pathname==='/api/admin/content'&&req.method==='PUT'){const incoming=await body(req);if(incoming.revision!==content.revision)return send(res,409,{error:'内容已被其他管理员修改，请重新载入'});const next={...validate(incoming),revision:content.revision+1};writeFileSync(file+'.tmp',JSON.stringify(next,null,2));renameSync(file+'.tmp',file);content=next;return send(res,200,content);}}
 const assets={'/':'index.html','/admin':'index.html','/app.js':'app.js','/style.css':'style.css'};
 if(req.method==='GET'&&assets[pathname]){res.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'text/javascript; charset=utf-8':pathname.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});return res.end(readFileSync(path.join(existsSync(path.join(root,'public','index.html'))?path.join(root,'public'):root,assets[pathname])));}
 send(res,404,{error:'不存在的页面'});
 }catch(e){send(res,400,{error:e.message||'请求失败'});}});
server.listen(Number(process.env.PORT||8787),process.env.HOST||(process.env.RENDER?'0.0.0.0':'127.0.0.1'),()=>{console.log(`软件库：http://localhost:${process.env.PORT||8787}\n管理后台：http://localhost:${process.env.PORT||8787}/admin`);if(!process.env.ADMIN_PASSWORD)console.log(`本次启动的临时管理员密码：${password}`);});
