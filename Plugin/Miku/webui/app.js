const embedded=window.self!==window.top;
if(embedded){
  const url=location.href;
  const opened=window.open(url,'qqpet-dashboard');
  const safeUrl=url.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  document.body.innerHTML=`<main><section class="panel" style="max-width:460px;margin:12vh auto;text-align:center"><h1>Miku QQ 宠物</h1><p style="margin:14px 0">${opened?'已在独立标签页打开。':'浏览器阻止了自动打开，请点击下面的按钮。'}</p><a href="${safeUrl}" target="qqpet-dashboard" style="display:inline-block;border-radius:8px;background:#6857e5;color:white;padding:8px 14px;text-decoration:none;font-weight:600">在独立标签页打开</a></section></main>`;
}else{
const API=window.__QQPET_API_BASE__||'/api';
const $=(id)=>document.getElementById(id);
const form=$('settings');
let latestConfig={};
let timer;
let catalogsLoading=false;
let initialCatalogLoaded=false;
let automationRunning=false;
let formDirty=false;
let statusTicket=0;
let savingConfig=false;
let accountVisible=false;
let storyCountdownTimer;
let storyCountdown={storyId:'',remainingSeconds:0,durationSeconds:0,syncedAt:0,finished:false};
let latestCatalogs={courses:[],careers:[],adventures:[],bathItems:[]};
let latestState={};
let medalSignature='';
let interactionSignature='';
let careerSignature='';
const baseDocumentTitle='Miku QQ 宠物';

async function request(path,method='GET',body){
  const token=localStorage.getItem('token')||'';
  const headers=body?{'Content-Type':'application/json'}:{};
  if(token)headers.Authorization=`Bearer ${token}`;
  const response=await fetch(API+path,{method,credentials:'same-origin',headers,body:body?JSON.stringify(body):undefined});
  const payload=await response.json().catch(()=>({message:`HTTP ${response.status}`}));
  if(!response.ok||payload.code!==0)throw new Error(payload.message||`HTTP ${response.status}`);
  return payload.data;
}
function text(id,value){const element=$(id);if(element)element.textContent=value??'--'}
function masked(value,start=3,end=3){
  const input=String(value||'');
  if(!input)return '未知';
  if(input.length<=start+end)return '•'.repeat(Math.max(4,input.length));
  return `${input.slice(0,start)}${'•'.repeat(Math.min(8,input.length-start-end))}${input.slice(-end)}`;
}
function renderAccount(account={}){
  const uin=String(account.uin||'');
  const petId=account.petIdReady?String(account.petId||''):'自动获取中';
  text('account',`QQ ${accountVisible?(uin||'未知'):masked(uin)} · Pet ID ${account.petIdReady?(accountVisible?(petId||'未知'):masked(petId,4,4)):petId}`);
  const button=$('account-visibility');
  button.setAttribute('aria-label',accountVisible?'隐藏完整账号信息':'显示完整账号信息');
  button.title=button.getAttribute('aria-label');
  button.querySelector('.eye-open').classList.toggle('hidden',accountVisible);
  button.querySelector('.eye-closed').classList.toggle('hidden',!accountVisible);
}
function num(value,digits=0){return Number.isFinite(Number(value))?Number(value).toFixed(digits):'--'}
function profileDate(value){
  const seconds=Number(value)||0;
  return seconds>0?new Date(seconds*1000).toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}):'--';
}
function duration(value){
  const seconds=Math.max(0,Math.trunc(Number(value)||0));
  const hours=Math.floor(seconds/3600),minutes=Math.floor(seconds%3600/60),rest=seconds%60;
  if(hours>0)return `${hours}小时${String(minutes).padStart(2,'0')}分${String(rest).padStart(2,'0')}秒`;
  if(minutes>0)return `${minutes}分${String(rest).padStart(2,'0')}秒`;
  return `${rest}秒`;
}
function renderStoryCountdown(){
  if(!storyCountdown.storyId){text('story-time','--');updateDocumentTitle();return}
  const elapsed=storyCountdown.finished?0:Math.max(0,Math.floor((Date.now()-storyCountdown.syncedAt)/1000));
  const remaining=storyCountdown.finished?0:Math.max(0,storyCountdown.remainingSeconds-elapsed);
  text('story-time',`${duration(remaining)} / ${duration(storyCountdown.durationSeconds)}`);
  updateDocumentTitle();
}
function syncStoryCountdown(story){
  storyCountdown={
    storyId:String(story?.storyId||''),remainingSeconds:Math.max(0,Number(story?.remainingSeconds)||0),
    durationSeconds:Math.max(0,Number(story?.durationSeconds)||0),syncedAt:Date.now(),finished:Boolean(story?.finished),
  };
  renderStoryCountdown();
}
function storyType(story){
  if(!story?.storyId)return '无';
  const prefix=story.storyId.split('_',1)[0];
  if(prefix==='6100')return '学习';
  if(prefix==='6400')return story.recallable?'被雇佣打工':'打工';
  if(prefix==='6700')return '冒险';
  return `未知任务（${prefix}）`;
}
function titleClock(seconds){
  const value=Math.max(0,Math.trunc(Number(seconds)||0));
  const hours=Math.floor(value/3600),minutes=Math.floor(value%3600/60),rest=value%60;
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`;
}
function updateDocumentTitle(){
  const account=latestState.account||{};
  const uin=String(account.uin||'');
  const accountLabel=uin?`QQ ${uin.slice(-4)}`:'';
  const story=latestState.story||{};
  let activity='';
  if(story.storyId&&!story.finished){
    const elapsed=storyCountdown.finished?0:Math.floor((Date.now()-storyCountdown.syncedAt)/1000);
    activity=`${storyType(story)} ${titleClock(Math.max(0,storyCountdown.remainingSeconds-elapsed))}`;
  }else if(!latestState.connected){
    activity='等待登录';
  }else if(latestState.automationRunning){
    activity='自动托管运行中';
  }else{
    activity='空闲';
  }
  document.title=[baseDocumentTitle,accountLabel,activity].filter(Boolean).join(' · ');
}
function toast(message){text('toast',message);$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1800)}
function showError(message){text('error',message);$('error').classList.toggle('hidden',!message)}
function rewardValue(value){const values=String(value||'').match(/\d+(?:\.\d+)?/g)||[];return Number(values.at(-1)||0)}
function durationSeconds(value){const text=String(value||'');return Number(text.match(/(\d+)\s*小时/)?.[1]||0)*3600+Number(text.match(/(\d+)\s*分钟/)?.[1]||0)*60+Number(text.match(/(\d+)\s*秒/)?.[1]||0)}
function compareRewardEfficiency(a,b){
  const ad=durationSeconds(a.duration),bd=durationSeconds(b.duration),ar=rewardValue(a.reward),br=rewardValue(b.reward);
  if(ad>0&&bd>0){const order=br*ad-ar*bd;if(order)return order}
  else if(ad!==bd)return ad>0?-1:1;
  return br-ar;
}
function setImage(element,url){
  if(!element)return;
  if(!url){element.removeAttribute('src');element.classList.add('hidden');return}
  if(element.dataset.src!==url){element.dataset.src=url;element.src=url}
  element.classList.remove('hidden');
}
function catalogItems(kind){
  if(kind==='school')return latestCatalogs.courses||[];
  if(kind==='work')return (latestCatalogs.careers||[]).flatMap(c=>c.jobs||[]);
  return latestCatalogs.adventures||[];
}
function activeSchoolRewardKeyword(){
  const order=['physical','culture','art'],names={physical:'力量',culture:'智力',art:'魅力'};
  const configured=String(form.elements.schoolAttribute?.value||latestConfig.schoolAttribute||'physical');
  const base=Math.max(0,order.indexOf(configured));
  const rotation=form.elements.schoolRotationEnabled?.checked?Number(latestState.progress?.schoolRotationIndex||0):0;
  return names[order[(base+rotation)%order.length]];
}
function selectedCatalogItem(kind){
  const items=catalogItems(kind),field=kind==='school'?'courseSubEvent':kind==='work'?'workJobSubEvent':'adventureOption';
  const selected=String(form.elements[field]?.value??latestConfig[field]??'');
  const exact=kind==='adventure'?items.find(item=>item.name===selected):items.find(item=>String(item.subEventType)===selected&&selected!=='0');
  let candidates=items.filter(item=>item.canDo);
  if(kind==='school')candidates=candidates.filter(item=>String(item.reward||'').includes(activeSchoolRewardKeyword()));
  return exact||candidates.sort(compareRewardEfficiency)[0]||items[0];
}
function renderCatalogPreview(id,item,fallback){
  const root=$(id),img=root?.querySelector('img'),name=root?.querySelector('b'),detail=root?.querySelector('small');
  if(!root)return;
  setImage(img,item?.iconUrl||'');
  name.textContent=item?.name||fallback;
  detail.textContent=item?[item.careerName,item.duration,item.reward].filter(Boolean).join(' · '):'等待目录同步';
}
function renderMedals(medals){
  const signature=JSON.stringify((medals||[]).map(item=>[item.id,item.progress,item.acquired,item.equipped]));
  if(signature===medalSignature)return;
  medalSignature=signature;
  const panel=$('medals-panel'),root=$('medals');root.replaceChildren();
  panel.classList.toggle('hidden',!medals?.length);text('medal-count',`${medals?.filter(item=>item.acquired).length||0}/${medals?.length||0} 枚`);
  for(const item of medals||[]){
    const card=document.createElement('article');card.className=`medal${item.acquired?'':' unowned'}`;card.title=[item.requirement,item.description].filter(Boolean).join('\n');
    const img=document.createElement('img');img.src=item.imageUrl;img.alt=item.name;img.loading='lazy';img.width=58;img.height=58;
    const copy=document.createElement('span'),name=document.createElement('b'),progress=document.createElement('small');
    name.textContent=item.name;progress.textContent=[item.category,item.progress].filter(Boolean).join(' · ');copy.append(name,progress);card.append(img,copy);
    if(item.equipped){const badge=document.createElement('em');badge.textContent='已佩戴';card.append(badge)}
    root.append(card);
  }
}
function interactionType(value){return ({1:'喂食',2:'踩踩',5:'洗澡',6:'火花',6400:'打工',6700:'冒险'})[value]||'互动'}
function renderInteractions(items){
  const signature=JSON.stringify((items||[]).map(item=>[item.id,item.timestamp]));
  if(signature===interactionSignature)return;
  interactionSignature=signature;
  const panel=$('interactions-panel'),root=$('interactions');root.replaceChildren();
  panel.classList.toggle('hidden',!items?.length);text('interaction-count',`${items?.length||0} 条`);
  for(const item of items||[]){
    const row=document.createElement('article');row.className='interaction';
    const head=document.createElement('div'),who=document.createElement('b'),meta=document.createElement('span'),body=document.createElement('p');
    who.textContent=item.petName||`QQ ${item.uin||'未知'}`;
    const time=Number(item.timestamp)>0?new Date(item.timestamp).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'时间未知';
    meta.textContent=[interactionType(item.eventType),item.uin?`QQ ${item.uin}`:'',time].filter(Boolean).join(' · ');
    body.textContent=item.text||'';head.append(who,meta);row.append(head,body);root.append(row);
  }
}
function renderCareerTree(careers){
  const signature=JSON.stringify(careers);
  if(signature===careerSignature)return;
  careerSignature=signature;
  const panel=$('career-tree-panel'),root=$('career-tree');root.replaceChildren();
  panel.classList.toggle('hidden',!careers?.length);
  for(const career of careers||[]){
    const branch=document.createElement('article'),name=document.createElement('h3'),detail=document.createElement('small');
    branch.className='career-branch';name.textContent=career.name||'???';detail.textContent=`职业编号 ${career.careerType}`;
    branch.append(name,detail);root.append(branch);
    if(career.message){const reason=document.createElement('small');reason.className='career-reason';reason.textContent=`解锁说明：${career.message}`;branch.append(reason)}
  }
}
function renderAssetPanels(){
  const course=selectedCatalogItem('school'),work=selectedCatalogItem('work');
  renderCatalogPreview('course-preview',course,'自动选择课程');renderCatalogPreview('work-preview',work,'自动选择岗位');
  renderCareerTree(latestCatalogs.careers||[]);
  const reward=[...catalogItems('school'),...catalogItems('work')].find(item=>item.rewardIconUrl)?.rewardIconUrl||'';
  setImage($('gold-reward-icon'),reward);
  const story=latestState.story||{},prefix=String(story.storyId||'').split('_',1)[0];
  const storyItem=prefix==='6100'?course:prefix==='6400'?work:prefix==='6700'?selectedCatalogItem('adventure'):null;
  setImage($('story-icon'),story?.storyId?storyItem?.iconUrl||'':'');
}
function compactLogs(lines){
  const output=[];
  const indexes=new Map();
  for(const line of lines||[]){
    const message=String(line).replace(/^\[[^\]]+\]\s*/,'').replace(/（(?:连续|共) \d+ 次）$/,'');
    const repeated=String(line).match(/（(?:连续|共) (\d+) 次）$/);
    const amount=repeated?Number(repeated[1]):1;
    if(indexes.has(message)){output[indexes.get(message)].count+=amount;continue}
    indexes.set(message,output.length);output.push({line:String(line).replace(/（(?:连续|共) \d+ 次）$/,''),count:amount});
  }
  return output.slice(0,60).map(item=>item.count>1?`${item.line}（共 ${item.count} 次）`:item.line);
}
function fillForm(config,force=false){
  latestConfig=config;
  if(formDirty&&!force)return;
  for(const element of form.elements){
    if(!element.name||!(element.name in config))continue;
    if(element.type==='checkbox')element.checked=Boolean(config[element.name]);
    else element.value=String(config[element.name]??'');
  }
}
function applyControlState(){
  for(const element of form.elements)element.disabled=false;
  $('save').disabled=false;
  $('start').disabled=false;
}
function render(state){
  latestState=state;
  updateDocumentTitle();
  automationRunning=Boolean(state.automationRunning);
  text('pet-name',state.account.petName?`· ${state.account.petName}`:'');
  renderAccount(state.account);
  text('connection',state.connected?'已连接':'未连接');$('connection').className=`pill ${state.connected?'ok':'warn'}`;
  text('updated-at',state.updatedAt?`同步于 ${new Date(state.updatedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}`:'等待首次同步');
  text('automation',state.automationRunning?'运行中':'已停止');$('automation').className=`pill ${state.automationRunning?'ok':''}`;
  text('start',automationRunning?'停止':'启动');$('start').className=`small ${automationRunning?'danger':'success'}`;
  showError(state.error||'');
  const v=state.values||{};text('gold',num(v.gold));text('feel',num(v.feel));text('hunger',num(v.hunger));text('clean',num(v.clean));text('total',num(v.total));text('strength',num(v.strength));text('intelligence',num(v.intelligence));text('charm',num(v.charm));
  const profile=state.profile||{};
  const avatar=$('pet-avatar'),fallback=$('pet-avatar-fallback'),personality=$('personality-art');
  if(profile.avatarUrl&&avatar.dataset.src!==profile.avatarUrl){
    avatar.dataset.src=profile.avatarUrl;avatar.classList.remove('loaded');
    avatar.onload=()=>{avatar.classList.add('loaded');fallback.classList.add('hidden')};
    avatar.onerror=()=>{avatar.classList.remove('loaded');fallback.classList.remove('hidden')};
    avatar.src=profile.avatarUrl;
  }
  if(profile.personalityUrl&&personality.dataset.src!==profile.personalityUrl){personality.dataset.src=profile.personalityUrl;personality.src=profile.personalityUrl}
  $('pet-portrait').dataset.full=profile.fullAvatarUrl||profile.avatarUrl||'';
  text('avatar-caption',profile.name?`${profile.name} · 手机端高清立绘`:'宠物高清立绘');
  text('pet-level',profile.level?`Lv.${profile.level}`:'--');
  text('pet-birthday',profileDate(profile.birthdayAt));text('pet-gender',profile.gender||'--');text('pet-species',profile.species||'--');text('pet-personality',profile.personality||'--');
  text('pet-experience',profile.levelExperience?`${num(profile.currentExperience)} / ${num(profile.levelExperience)}`:num(profile.currentExperience));
  text('experience-rate',profile.experienceRate?`成长倍率 ×${num(profile.experienceRate,1)}`:'');
  const fatigue=state.fatigue;
  text('fatigue',fatigue?.fatigued===true?`是（${fatigue.tier} 小时档）`:fatigue?.fatigued===false?'否':'未知');
  $('fatigue').className=fatigue?.fatigued===true?'state-bad':fatigue?.fatigued===false?'state-good':'state-unknown';
  const story=state.story||{},type=storyType(story);text('story-status',story.storyId?(story.finished?`${type}（待结算）`:type):'空闲');text('story-id',story.storyId||'无');syncStoryCountdown(story);
  const inv=state.inventory||{};text('biscuits',inv.biscuits);text('shrimp',inv.shrimp);text('soap',inv.soap);text('bath-ball',inv.bathBall);
  const counts=state.progress?.counts||{};for(const key of ['school','work','adventure','feed','wash','visitFriend','visitStranger','careOther'])text(`count-${key}`,counts[key]||0);
  text('daily-experience',state.progress?.dailyExperienceGain||0);
  const config=state.config||{},rotation=state.progress?.schoolRotationIndex||0;
  const order=['physical','culture','art'],names={physical:'力量',culture:'智力',art:'魅力'};
  const base=Math.max(0,order.indexOf(config.schoolAttribute));
  const active=config.schoolRotationEnabled?order[(base+rotation)%3]:config.schoolAttribute;
  text('school-rotation-status',`当前学习属性：${names[active]||'--'}${config.schoolRotationEnabled?`（每 ${config.schoolRotationEvery} 次轮换）`:'（固定）'}`);
  text('logs',compactLogs(state.logs).join('\n')||'尚无日志');fillForm(config);renderMedals(profile.medals||[]);renderInteractions(state.interactions||[]);renderAssetPanels();applyControlState();
}
async function load(){
  const ticket=++statusTicket;
  try{
    const state=await request('/status');
    if(ticket!==statusTicket||savingConfig)return;
    render(state);
    if(!initialCatalogLoaded){initialCatalogLoaded=true;void loadCatalogs(true)}
  }catch(error){if(ticket===statusTicket&&!savingConfig)showError(error.message)}
}
function scheduleStatusRefresh(){
  clearTimeout(timer);
  const period=Math.max(3,Math.min(300,Math.trunc(Number(latestConfig.intervalSeconds)||15)))*1000;
  const updatedAt=Date.parse(latestState.updatedAt||'');
  const untilNext=Number.isFinite(updatedAt)?updatedAt+period-Date.now()+250:period;
  const delay=Math.max(750,Math.min(period,untilNext));
  timer=setTimeout(async()=>{await load();scheduleStatusRefresh()},delay);
}
async function act(path,message){
  document.querySelectorAll('button').forEach(button=>button.disabled=true);
  try{await request(path,'POST');toast(message);await load();}catch(error){showError(error.message)}finally{document.querySelectorAll('button').forEach(button=>button.disabled=false);applyControlState()}
}
function readForm(){
  const result={...latestConfig};
  for(const element of form.elements){
    if(!element.name)continue;
    if(element.type==='checkbox')result[element.name]=element.checked;
    else if(element.type==='number'||['courseSubEvent','workJobSubEvent'].includes(element.name))result[element.name]=Number(element.value);
    else result[element.name]=element.value;
  }
  return result;
}
function replaceOptions(name,items,placeholder,getValue,getLabel){
  const select=form.elements[name],current=String(formDirty?select.value:latestConfig[name]??'');select.replaceChildren();
  const first=document.createElement('option');first.value=placeholder.value;first.textContent=placeholder.label;select.append(first);
  for(const item of items){const option=document.createElement('option');option.value=String(getValue(item));option.textContent=getLabel(item);select.append(option)}
  select.value=current;
}
async function loadCatalogs(silent=false){
  if(catalogsLoading)return;
  catalogsLoading=true;
  try{
    const data=await request('/catalogs','POST');
    latestCatalogs=data;
    replaceOptions('courseSubEvent',data.courses||[],{value:'0',label:'自动最高效率'},x=>x.subEventType,x=>`${[x.name,x.duration,x.reward].filter(Boolean).join(' · ')}${x.canDo?'':'（不可用）'}`);
    const jobs=(data.careers||[]).flatMap(c=>c.jobs||[]);
    replaceOptions('workJobSubEvent',jobs,{value:'0',label:'自动最高效率'},x=>x.subEventType,x=>`${[x.careerName,x.name,x.duration,x.reward].filter(Boolean).join(' · ')}${x.canDo?'':'（不可用）'}`);
    replaceOptions('adventureOption',data.adventures||[],{value:'',label:'服务器首个可用项'},x=>x.name,x=>`${x.name} · ${x.duration}${x.canDo?'':'（不可用）'}`);
    renderAssetPanels();
    if(!silent)toast(`已刷新目录：${data.courses?.length||0} 门课程，${jobs.length} 个岗位`);
  }catch(error){if(!silent)showError(error.message)}finally{catalogsLoading=false}
}
$('start').onclick=()=>act(automationRunning?'/automation/stop':'/automation/start',automationRunning?'自动托管已停止':'自动托管已启动');
$('account-visibility').onclick=()=>{accountVisible=!accountVisible;renderAccount(latestState.account)};
form.elements.courseSubEvent.addEventListener('change',renderAssetPanels);
form.elements.workJobSubEvent.addEventListener('change',renderAssetPanels);
form.elements.schoolAttribute.addEventListener('change',renderAssetPanels);
form.elements.schoolRotationEnabled.addEventListener('change',renderAssetPanels);
form.elements.adventureOption.addEventListener('change',renderAssetPanels);
const markFormDirty=()=>{formDirty=true;$('save').textContent='保存设置（未保存）'};
form.addEventListener('input',markFormDirty);
form.addEventListener('change',markFormDirty);
$('pet-portrait').onclick=()=>{const url=$('pet-portrait').dataset.full;if(!url)return;setImage($('full-avatar'),url);$('avatar-dialog').showModal()};
$('avatar-close').onclick=()=>$('avatar-dialog').close();
$('avatar-dialog').onclick=event=>{if(event.target===$('avatar-dialog'))$('avatar-dialog').close()};
$('save').onclick=async()=>{
  savingConfig=true;statusTicket+=1;
  try{latestConfig=await request('/config','PUT',readForm());formDirty=false;fillForm(latestConfig,true);$('save').textContent='保存设置';scheduleStatusRefresh();toast('设置已保存')}
  catch(error){showError(error.message)}
  finally{statusTicket+=1;savingConfig=false}
};
storyCountdownTimer=setInterval(renderStoryCountdown,1000);
load().then(scheduleStatusRefresh);window.addEventListener('beforeunload',event=>{clearTimeout(timer);clearInterval(storyCountdownTimer);if(formDirty){event.preventDefault();event.returnValue=''}});
}
