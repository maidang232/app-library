import http from 'node:http';
import {readFileSync,writeFileSync,renameSync,mkdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url));
const dir=process.env.DATA_DIR||path.join(root,'data'); mkdirSync(dir,{recursive:true});
const file=path.join(dir,'content.json');
const seed={revision:1,announcement:'欢迎来到拾光软件库。这里的示例软件仅用于演示，请在后台添加你的正式内容。',notices:[{title:'公告 1',text:'欢迎来到拾光软件库',button:'查看详情',icon:'✦',url:''},{title:'公告 2',text:'每日更新好用软件',button:'去看看',icon:'↗',url:''}],banners:[{title:'发现好用的软件',subtitle:'精选工具，让每一天更轻松',color:'#c9efbc'}],apps:[{id:'sample-notes',name:'轻记 · 示例',category:'效率工具',version:'1.0.0',description:'随手记录灵感，整理每日清单。这是展示用的软件信息，尚未配置安装包。',downloadUrl:'',featured:true,published:true},{id:'sample-photo',name:'像素 · 示例',category:'图片处理',version:'1.0.0',description:'为日常照片增添一点色彩。这是展示用的软件信息。',downloadUrl:'',featured:true,published:true},{id:'sample-read',name:'读伴 · 示例',category:'阅读学习',version:'1.0.0',description:'给自己留一段安静阅读的时间。这是展示用的软件信息。',downloadUrl:'',featured:false,published:true}]};
let content=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):seed;
content.share ||= {label:'分享软件库',title:'拾光软件库',text:'发现好用的软件与工具',url:''};
content.categories ||= [...new Set(content.apps.map(a=>a.category))].map(name=>({name,description:'',image:''}));
content.tools ||= [];
content.notices ||= [];
content.notices.forEach(n=>{n.pinned=Boolean(n.pinned);});
content.settings ||= {bannerInterval:4000,tickerSpeed:12};
const userFile=path.join(dir,'users.json');
let users=existsSync(userFile)?JSON.parse(readFileSync(userFile,'utf8')):[];
const userSessions=new Map();
const publicUser=u=>({id:u.id,username:u.username,createdAt:u.createdAt});
const userToken=req=>(req.headers.cookie||'').match(/(?:^|;\s*)user_session=([a-f0-9]+)/)?.[1];
function userCookie(res,token,age=604800){res.setHeader('Set-Cookie',`user_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}${process.env.RENDER||process.env.COOKIE_SECURE==='1'?'; Secure':''}`);}
const password=process.env.ADMIN_PASSWORD||'admin123456';
const salt=randomBytes(16), hash=scryptSync(password,salt,32), sessions=new Map(), attempts=new Map();
const send=(res,status,obj)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
async function body(req,limit=262144){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>limit)throw Error('请求内容过大');}return JSON.parse(raw||'{}');}
function validate(c){if(!c||typeof c.announcement!=='string'||c.announcement.length>2000||!Array.isArray(c.notices)||!c.settings||!Number.isFinite(Number(c.settings.bannerInterval))||!Number.isFinite(Number(c.settings.tickerSpeed))||!Array.isArray(c.apps)||c.apps.length>1000||!Array.isArray(c.banners)||c.banners.length>8)throw Error('内容格式错误');
 const str=(v,n)=>typeof v==='string'&&v.length<=n; const ids=new Set();
 for(const a of c.apps){if(!a||!str(a.id,80)||!a.id||ids.has(a.id)||!str(a.name,100)||!a.name.trim()||!str(a.category,40)||!str(a.version,40)||!str(a.description,4000)||!str(a.downloadUrl,2000)||typeof a.featured!=='boolean'||typeof a.published!=='boolean')throw Error('软件信息不完整或编号重复');ids.add(a.id);if(a.downloadUrl){let u=new URL(a.downloadUrl);if(u.protocol!=='https:'||u.username||u.password)throw Error('下载地址必须使用 HTTPS');}}
 for(const b of c.banners)if(!b||!str(b.title,100)||!str(b.subtitle,200)||!/^#[0-9a-f]{6}$/i.test(b.color))throw Error('轮播图内容格式错误');
 const validUrl=u=>{if(!str(u,2000))return false;try{const x=new URL(u);return ['https:','http:'].includes(x.protocol)&&!x.username&&!x.password;}catch{return false;}};
 if(!c.share||!str(c.share.label,40)||!c.share.label.trim()||!str(c.share.title,100)||!str(c.share.text,2000)||!(c.share.url===''||validUrl(c.share.url)))throw Error('分享内容或链接格式错误');
 if(!Array.isArray(c.tools)||c.tools.length>100)throw Error('工具最多 100 个');
 for(const t of c.tools)if(!str(t.name,80)||!t.name.trim()||!str(t.description,200)||!validUrl(t.url)||typeof t.published!=='boolean')throw Error('工具名称、说明或网址格式错误');
 for(const n of c.notices)if(typeof n.pinned!=='boolean'||!str(n.title,100)||!str(n.text,1000)||!str(n.button,60)||!str(n.icon,20)||!(n.url===''||validUrl(n.url)))throw Error('公告格式错误');
 const imagePath=v=>v===undefined||v===''||typeof v==='string'&&/^\/uploads\/[a-f0-9]{32}\.(png|jpeg|webp)$/.test(v);
 if(!Array.isArray(c.categories)||c.categories.some(g=>!g||!str(g.name,40)||!g.name.trim()||!str(g.description,200)||!imagePath(g.image))||new Set(c.categories.map(g=>g.name.trim())).size!==c.categories.length)throw Error('分类名称不能为空或重复');
 if(c.notices.some(n=>!imagePath(n.image)))throw Error('公告图标必须使用上传的图片');
 const extra={categories:c.categories.map(({name,description,image})=>({name:name.trim(),description,image:image||''})),settings:{bannerInterval:Math.max(1000,Math.min(60000,Number(c.settings.bannerInterval))),tickerSpeed:Math.max(3,Math.min(120,Number(c.settings.tickerSpeed)))},notices:c.notices.map(({title,text,button,icon,url,pinned,image})=>({title,text,button,icon,url,pinned,image:image||''})),share:{label:c.share.label,title:c.share.title,text:c.share.text,url:c.share.url},tools:c.tools.map(({name,description,url,published})=>({name,description,url,published}))};
 return {...extra,announcement:c.announcement,banners:c.banners.map(({title,subtitle,color,image})=>({title,subtitle,color,image:image||''})),apps:c.apps.map(({id,name,category,version,description,downloadUrl,featured,published})=>({id,name,category,version,description,downloadUrl,featured,published}))};}
const server=http.createServer(async(req,res)=>{try{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(['POST','PUT','DELETE'].includes(req.method)&&req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)return send(res,403,{error:'来源不允许'});
 if(pathname==='/api/content'&&req.method==='GET')return send(res,200,{...content,tools:content.tools.filter(t=>t.published),apps:content.apps.filter(a=>a.published)});
 if(pathname==='/api/user/me'&&req.method==='GET'){const s=userSessions.get(userToken(req));const u=s&&s.expires>Date.now()?users.find(u=>u.id===s.id):null;return send(res,200,{user:u?publicUser(u):null});}
 if(pathname==='/api/user/logout'&&req.method==='POST'){userSessions.delete(userToken(req));userCookie(res,'',0);return send(res,200,{ok:true});}
 if(['/api/user/register','/api/user/login'].includes(pathname)&&req.method==='POST'){
 const b=await body(req);const username=typeof b.username==='string'?b.username.trim():'';
 if(!/^[\p{L}\p{N}_-]{3,24}$/u.test(username)||typeof b.password!=='string'||b.password.length<8||b.password.length>128)return send(res,400,{error:'用户名需 3–24 位，密码需 8–128 位'});
 let u=users.find(u=>u.username.toLowerCase()===username.toLowerCase());
 if(pathname.endsWith('/register')){if(u)return send(res,409,{error:'用户名已存在'});const salt=randomBytes(16).toString('hex');u={id:randomBytes(16).toString('hex'),username,salt,hash:scryptSync(b.password,salt,64).toString('hex'),createdAt:new Date().toISOString()};const next=[...users,u];writeFileSync(userFile+'.tmp',JSON.stringify(next));renameSync(userFile+'.tmp',userFile);users=next;}
 else if(!u||!timingSafeEqual(scryptSync(b.password,u.salt,64),Buffer.from(u.hash,'hex')))return send(res,401,{error:'用户名或密码不正确'});
 const token=randomBytes(32).toString('hex');userSessions.set(token,{id:u.id,expires:Date.now()+604800000});userCookie(res,token);return send(res,200,{user:publicUser(u)});}
 if(pathname==='/api/login'&&req.method==='POST'){const b=await body(req);if(typeof b.password!=='string'||b.password.length>256||!timingSafeEqual(scryptSync(b.password,salt,32),hash))return send(res,401,{error:'密码不正确'});const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+28800000);res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.COOKIE_SECURE==='1'?'; Secure':''}`);return send(res,200,{ok:true});}
 if(pathname.startsWith('/api/admin')){const token=(req.headers.cookie||'').match(/(?:^|;\s*)session=([a-f0-9]+)/)?.[1];if(!token||!(sessions.get(token)>Date.now()))return send(res,401,{error:'请先登录后台'});
 if(pathname==='/api/admin/upload'&&req.method==='POST'){const b=await body(req,8000000);const m=typeof b.image==='string'&&b.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);if(!m)throw Error('请选择 PNG、JPG 或 WebP 图片');const bytes=Buffer.from(m[2],'base64');if(bytes.length>5000000)throw Error('图片请小于 5 MB');const folder=path.join(dir,'uploads');mkdirSync(folder,{recursive:true});const name=randomBytes(16).toString('hex')+'.'+m[1];writeFileSync(path.join(folder,name),bytes);return send(res,200,{url:'/uploads/'+name});}
 if(pathname==='/api/admin/logout'&&req.method==='POST'){sessions.delete(token);res.setHeader('Set-Cookie','session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return send(res,200,{ok:true});}
 if(pathname==='/api/admin/content'&&req.method==='GET')return send(res,200,content);
 if(pathname==='/api/admin/content'&&req.method==='PUT'){const incoming=await body(req,8000000);if(incoming.revision!==content.revision)return send(res,409,{error:'内容已被其他管理员修改，请重新载入'});const next={...validate(incoming),revision:content.revision+1};writeFileSync(file+'.tmp',JSON.stringify(next,null,2));renameSync(file+'.tmp',file);content=next;return send(res,200,content);}}
 if(req.method==='GET'&&/^\/uploads\/[a-f0-9]{32}\.(png|jpeg|webp)$/.test(pathname)){const image=path.join(dir,'uploads',path.basename(pathname));if(!existsSync(image))return send(res,404,{error:'图片不存在'});res.writeHead(200,{'Content-Type':'image/'+pathname.split('.').pop(),'X-Content-Type-Options':'nosniff'});return res.end(readFileSync(image));}
 const assets={'/':'index.html','/admin':'index.html','/app.js':'app.js','/mobile.js':'mobile.js','/style.css':'style.css','/mono.css':'mono.css','/home.css':'home.css'};
 if(req.method==='GET'&&assets[pathname]){res.writeHead(200,{'Content-Type':pathname.endsWith('.js')?'text/javascript; charset=utf-8':pathname.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});return res.end(readFileSync(path.join(existsSync(path.join(root,'public','index.html'))?path.join(root,'public'):root,assets[pathname])));}
 send(res,404,{error:'不存在的页面'});
 }catch(e){send(res,400,{error:e.message||'请求失败'});}});
server.listen(Number(process.env.PORT||8787),process.env.HOST||'0.0.0.0',()=>{console.log(`软件库：http://localhost:${process.env.PORT||8787}\n管理后台：http://localhost:${process.env.PORT||8787}/admin`);if(!process.env.ADMIN_PASSWORD)console.log(`本次启动的临时管理员密码：${password}`);});
