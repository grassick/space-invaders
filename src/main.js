import {clamp,mapPosition,assignFaces,validRange} from './tracking.js';
const $=id=>document.getElementById(id), canvas=$('game'), ctx=canvas.getContext('2d'), video=$('video'), faceCtx=$('faces').getContext('2d');
const colors=['#76f8d1','#fc9fc8'];
let count=2,tracks=[],ranges=null,stream=null,worker=null,ready=false,busy=false,lastFrame=-1,lastDetection=0,calibration=null,demo=false,playing=false,paused=false,gameOver=false,goodSince=0;
let score=0,lives=5,wave=1,enemies=[],shots=[],bombs=[],particles=[],ships=[],direction=1,fireTime=0,bombTime=0,invulnerable=0,last=performance.now(),gameTime=0;
const keys=new Set();
const stars=Array.from({length:100},(_,i)=>({x:(i*173.19)%1000,y:(i*97.73)%700,r:i%4===0?1.7:.7}));
function resetTracks(){tracks=Array.from({length:count},()=>({x:.5,y:.5,seen:0,vx:0}));ships=Array.from({length:count},(_,i)=>({x:count===1?500:350+i*300}));}
resetTracks();
function overlay(title,text,tag='MISSION CONTROL'){$('overlay').classList.remove('hidden');$('overlayTitle').textContent=title;$('overlayText').textContent=text;$('overlayTag').textContent=tag;}
function status(text){$('status').textContent=text;}
function fresh(t,now=performance.now()){return t.seen>0&&now-t.seen<450;}
function controls(){const locked=playing||!!calibration;$('players').disabled=locked;$('calibrationMode').disabled=locked;$('calibrate').disabled=!ready||locked;$('start').disabled=(!demo&&(!ranges||!ready))||!!calibration||playing;$('pause').disabled=!playing;$('demo').disabled=!!calibration;}
function invalidate(){ranges=null;calibration=null;goodSince=0;demo=false;resetTracks();$('calibrationHelp').textContent='Movement settings changed. Calibrate again before launching.';controls();}
$('players').onchange=()=>{count=Number($('players').value);invalidate();};
$('calibrationMode').onchange=invalidate;
$('invert').onchange=()=>{if(playing){paused=true;$('pause').textContent='Resume';}};
function stopCamera(){ready=false;busy=false;worker?.terminate();worker=null;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;$('camera').disabled=false;$('camera').innerHTML='Enable camera <span>↗</span>';$('cameraHint').hidden=false;faceCtx.clearRect(0,0,640,480);calibration=null;ranges=null;controls();}
$('camera').onclick=async()=>{
  if(stream){stopCamera();status('Camera off. Enable it and recalibrate to continue.');return;}
  $('camera').disabled=true;demo=false;status('Requesting camera access…');
  try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access requires localhost or HTTPS.');
    stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
    video.srcObject=stream;await video.play();$('cameraHint').hidden=true;
    stream.getVideoTracks()[0].addEventListener('ended',()=>{stopCamera();status('Camera disconnected. Reconnect and enable it again.');});
    status('Loading local face detector…');
    worker=new Worker('./tracking-worker.js');
    worker.onerror=()=>{stopCamera();status('Face detector could not start. Reload and try again.');};
    worker.onmessage=({data})=>{
      if(data.type==='ready'){ready=true;$('camera').disabled=false;$('camera').textContent='Turn camera off';status('Camera ready. Stand in view, then calibrate.');controls();}
      if(data.type==='faces'){busy=false;lastDetection=performance.now();assignFaces(tracks,data.faces,lastDetection);}
      if(data.type==='error'){stopCamera();status(`Tracking error: ${data.message}. Try enabling the camera again.`);}
    };
    worker.postMessage({type:'init'});
  }catch(error){stopCamera();status(error.name==='NotAllowedError'?'Camera permission denied. Allow camera access in Chrome’s address bar, then retry.':`Camera unavailable: ${error.message}`);}
};
async function detect(now){
  if(!ready||busy||video.readyState<2||video.currentTime===lastFrame||now-lastDetection<50)return;
  busy=true;lastFrame=video.currentTime;
  try{const bitmap=await createImageBitmap(video);if(!worker){bitmap.close();busy=false;return;}worker.postMessage({type:'frame',bitmap,width:bitmap.width,height:bitmap.height,time:now},[bitmap]);}
  catch(error){busy=false;status(`Could not read camera frame: ${error.message}`);}
}
$('calibrate').onclick=()=>{
  demo=false;playing=false;ranges=null;resetTracks();
  calibration={stage:-1,begin:performance.now(),samples:Array.from({length:count},()=>[])};
  $('calibrationHelp').textContent='Starting positions: player 1 on the left of the preview, player 2 on the right. Keep your faces visible.';
  controls();
};
function updateCalibration(now){
  if(!calibration)return;
  const c=calibration,joint=$('calibrationMode').value==='joint';
  if(c.stage===-1){
    overlay('Find your starting positions.','Stand side by side, facing the camera.\nPlayer 1 is on the left of the mirrored preview.','CALIBRATION');
    if(!tracks.every(t=>fresh(t,now))){c.begin=now;return;}
    if(now-c.begin>2500){c.stage=0;c.begin=now;}
    return;
  }
  const elapsed=(now-c.begin)/1000;
  const who=joint&&count===2?'Both players':`Player ${c.stage+1}`;
  if(elapsed<3){overlay(`${who}: get ready.`,`In ${Math.ceil(3-elapsed)}… move all the way left and right within your playing area.\n${joint?'Take turns reaching the shared room boundaries.':'Other player: stay in view, near your starting position.'}`,'CALIBRATION');return;}
  const duration=joint?16:10;
  overlay(`${who}: sweep left and right.`,`${Math.max(0,Math.ceil(duration+3-elapsed))} seconds remaining · Keep looking toward the camera.\n${joint?'Cover the full shared space, taking turns at each edge.':'Cover your full comfortable movement range.'}`,'CALIBRATION');
  const indices=joint?tracks.map((_,i)=>i):[c.stage];
  indices.forEach(i=>{if(fresh(tracks[i],now))c.samples[i].push(tracks[i].x);});
  if(elapsed<duration+3)return;
  if(!joint&&c.stage<count-1){c.stage++;c.begin=now;return;}
  const extent=values=>{const s=[...values].sort((a,b)=>a-b);return {min:s[Math.floor(s.length*.02)],max:s[Math.floor(s.length*.98)]};};
  const proposed=joint?Array.from({length:count},()=>extent(c.samples.flat())):c.samples.map(extent);
  const enough=c.samples.every(s=>s.length>60);
  if(!enough||!proposed.every(validRange)){
    overlay('Let’s try that again.','We need a wider movement range and a clear view of every face.\nPress Calibrate movement to repeat.');
    $('calibrationHelp').textContent='Calibration incomplete. Move farther left and right, and keep both faces visible.';
  }else{
    ranges=proposed;overlay('Your crew is ready.','Move left and right to check your defenders below.\nPress Launch mission when you’re ready.','CALIBRATION COMPLETE');
    $('calibrationHelp').textContent=`${joint?'Shared room boundaries':'Individual ranges'} saved for this session. Invert movement if the screen responds backwards.`;
  }
  calibration=null;controls();
}
function newWave(){enemies=[];for(let row=0;row<4;row++)for(let col=0;col<10;col++)enemies.push({x:180+col*65,y:80+row*52,row});direction=1;bombs=[];shots=[];bombTime=1.2;}
function launch(asDemo=false){demo=asDemo;playing=true;paused=false;gameOver=false;score=0;lives=5;wave=1;gameTime=0;invulnerable=1;fireTime=0;goodSince=0;particles=[];resetShips();newWave();$('pause').textContent='Pause';$('start').textContent='Launch mission';$('demo').textContent='End mission';controls();}
function resetShips(){ships=Array.from({length:count},(_,i)=>({x:count===1?500:350+i*300}));}
$('start').onclick=()=>launch(demo);
$('demo').onclick=()=>{if(playing){playing=false;paused=false;demo=false;overlay('Mission ended.','Calibrate your camera or launch another mission.');$('demo').textContent='Keyboard demo';controls();}else{launch(true);$('demo').textContent='End mission';status('Keyboard demo: P1 uses A / D. P2 uses ← / →. Automatic firing.');}};
$('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Resume':'Pause';};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.arena').requestFullscreen();}catch{status('Fullscreen unavailable in this browser window.');}};
window.addEventListener('keydown',e=>{if(['INPUT','SELECT'].includes(e.target.tagName))return;if(['Space','ArrowLeft','ArrowRight','KeyA','KeyD'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat&&playing)$('pause').click();});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(playing){paused=true;$('pause').textContent='Resume';}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){paused=true;$('pause').textContent='Resume';}});
window.addEventListener('pagehide',()=>{stream?.getTracks().forEach(t=>t.stop());worker?.terminate();});
function burst(x,y,color){for(let i=0;i<12;i++)particles.push({x,y,vx:(Math.random()-.5)*170,vy:(Math.random()-.5)*170,life:.6,color});}
function damage(){if(invulnerable>0)return;lives--;invulnerable=1.6;ships.forEach((s,i)=>burst(s.x,637,colors[i]));if(lives<=0)endGame('Your watch is over.');}
function endGame(title){playing=false;gameOver=true;overlay(title,`Team score: ${score} · Wave ${wave}\nLaunch again for another mission.`,'MISSION COMPLETE');$('demo').textContent='Keyboard demo';controls();}
function step(dt,now){
  if(demo){ships.forEach((s,i)=>{const left=i===0?'KeyA':'ArrowLeft',right=i===0?'KeyD':'ArrowRight';s.x=clamp(s.x+((keys.has(right)?1:0)-(keys.has(left)?1:0))*600*dt,28,972);});}
  else if(ranges){ships.forEach((s,i)=>{if(fresh(tracks[i],now)){const target=28+mapPosition(tracks[i].x,ranges[i],$('invert').checked)*944;s.x+=(target-s.x)*(1-Math.exp(-dt*16));}});}
  if(!playing)return;
  if(paused){overlay('Mission paused.','Press Resume or Space to return to the fight.');return;}
  if(!demo){
    if(!ready||!tracks.every(t=>fresh(t,now))){goodSince=0;overlay('Hold position.','Tracking paused. Bring every face back into view.\nIf colors swap, end the mission and recalibrate.','CREW SIGNAL LOST');return;}
    if(!goodSince)goodSince=now;
    if(now-goodSince<900){overlay('Crew acquired.', 'Hold steady. Resuming…');return;}
  }
  $('overlay').classList.add('hidden');gameTime+=dt;invulnerable-=dt;fireTime-=dt;bombTime-=dt;
  if(fireTime<=0){ships.forEach((s,i)=>shots.push({x:s.x,y:616,color:colors[i]}));fireTime=.32;}
  const speed=(24+wave*9+(40-enemies.length)*1.2)*dt;
  if(enemies.some(e=>e.x+direction*speed<32||e.x+direction*speed>968)){direction*=-1;enemies.forEach(e=>e.y+=22);}
  enemies.forEach(e=>e.x+=direction*speed);
  if(enemies.some(e=>e.y>=598)){endGame('The invaders reached Earth.');return;}
  if(bombTime<=0&&enemies.length){const columns=new Map();for(const e of enemies){const k=Math.round(e.x);if(!columns.has(k)||columns.get(k).y<e.y)columns.set(k,e);}const bottom=[...columns.values()],e=bottom[Math.floor(Math.random()*bottom.length)];bombs.push({x:e.x,y:e.y+18});bombTime=Math.max(.22,1.0-wave*.07);}
  for(const shot of shots){shot.y-=620*dt;const hit=enemies.findIndex(e=>Math.abs(e.x-shot.x)<22&&Math.abs(e.y-shot.y)<19);if(hit>=0){const e=enemies.splice(hit,1)[0];burst(e.x,e.y,shot.color);score+=(4-e.row)*10;shot.y=-100;}}
  shots=shots.filter(s=>s.y>-10);
  for(const b of bombs){b.y+=(185+wave*15)*dt;if(ships.some(s=>Math.abs(s.x-b.x)<25&&Math.abs(637-b.y)<18)){b.y=800;damage();}}
  bombs=bombs.filter(b=>b.y<720);
  particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;});particles=particles.filter(p=>p.life>0);
  if(!enemies.length&&playing){wave++;score+=100;newWave();invulnerable=1.5;}
}
const sprites=[['00100100','00011000','00111100','01111110','11011011','11111111','00100100','01011010'],['00100100','01000010','01111110','11011011','11111111','10111101','10100101','00100100']];
function alien(e,dim=false){const rows=sprites[Math.floor(gameTime*2)%2];ctx.fillStyle=dim?'#23434c':['#a5c4ff','#b3a3ed','#86d9cd','#73f3cc'][e.row];rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')ctx.fillRect(e.x+(x-4)*4,e.y+(y-4)*4,4,4);}));}
function draw(now){ctx.fillStyle='#080f1c';ctx.fillRect(0,0,1000,700);stars.forEach(s=>{ctx.fillStyle=s.r>1?'#547180':'#293c50';ctx.fillRect(s.x,(s.y+now*.003)%700,s.r,s.r);});ctx.strokeStyle='#203346';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,665);ctx.lineTo(1000,665);ctx.stroke();
  if(!playing&&!gameOver&&!enemies.length){for(let r=0;r<4;r++)for(let c=0;c<10;c++)alien({x:180+c*65,y:80+r*52,row:r},true);}
  else enemies.forEach(e=>alien(e));
  shots.forEach(s=>{ctx.fillStyle=s.color;ctx.shadowColor=s.color;ctx.shadowBlur=12;ctx.fillRect(s.x-2,s.y,4,18);});ctx.shadowBlur=0;
  bombs.forEach(b=>{ctx.fillStyle='#ffb275';ctx.fillRect(b.x-3,b.y,6,16);});
  ships.forEach((s,i)=>{ctx.globalAlpha=invulnerable>0&&playing?(.45+.55*Math.abs(Math.sin(now/80))):1;ctx.fillStyle=colors[i];ctx.shadowColor=colors[i];ctx.shadowBlur=15;ctx.beginPath();ctx.moveTo(s.x,616);ctx.lineTo(s.x+9,631);ctx.lineTo(s.x+24,639);ctx.lineTo(s.x+24,650);ctx.lineTo(s.x-24,650);ctx.lineTo(s.x-24,639);ctx.lineTo(s.x-9,631);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#0b2630';ctx.fillRect(s.x-4,635,8,7);ctx.globalAlpha=1;ctx.fillStyle=colors[i];ctx.font='11px monospace';ctx.textAlign='center';ctx.fillText(`P${i+1}`,s.x,687);});
  particles.forEach(p=>{ctx.globalAlpha=clamp(p.life/.6);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);});ctx.globalAlpha=1;
  $('score').textContent=String(score).padStart(5,'0');$('wave').textContent=String(wave).padStart(2,'0');$('lives').textContent='♥ '.repeat(Math.max(0,lives));
}
function drawTracking(now){faceCtx.clearRect(0,0,640,480);tracks.forEach((t,i)=>{if(!fresh(t,now))return;faceCtx.strokeStyle=colors[i];faceCtx.lineWidth=3;faceCtx.strokeRect((t.x-t.w/2)*640,(t.y-t.h/2)*480,t.w*640,t.h*480);faceCtx.fillStyle=colors[i];faceCtx.font='bold 20px sans-serif';faceCtx.fillText(`P${i+1}`,(t.x-t.w/2)*640,(t.y-t.h/2)*480-8);});$('playerStatus').innerHTML=tracks.map((t,i)=>`<div style="color:${colors[i]}">● Player ${i+1} <span style="float:right">${fresh(t,now)?'Tracking':'Not in view'}</span></div>`).join('');}
function loop(now){const dt=Math.min((now-last)/1000,.04);last=now;detect(now);updateCalibration(now);step(dt,now);draw(now);drawTracking(now);requestAnimationFrame(loop);}
controls();requestAnimationFrame(loop);
