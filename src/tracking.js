export const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export function mapPosition(x, range, invert = false) {
  const p = clamp((x - range.min) / (range.max - range.min));
  return invert ? 1 - p : p;
}
// Global assignment avoids giving the same face to both defenders. Position and
// velocity retain continuity when players move; this is not biometric identity.
export function assignFaces(tracks, faces, now) {
  if (!tracks.some(t => t.seen)) {
    [...faces].sort((a,b) => a.x-b.x).slice(0,tracks.length).forEach((f,i) => update(tracks[i],f,now));
    return;
  }
  let best = {cost:Infinity, choices:[]};
  function visit(i, used, cost, choices) {
    if(i === tracks.length){if(cost < best.cost)best={cost,choices};return;}
    visit(i+1,used,cost+.24,[...choices,-1]);
    faces.forEach((f,j)=>{
      if(used.has(j))return;
      const t=tracks[i], elapsed=Math.min((now-t.seen)/1000,.2);
      const expected=t.x+(t.vx||0)*elapsed;
      const distance=t.seen?Math.hypot(f.x-expected,(f.y-t.y)*.6):0;
      if(distance>.4 && now-t.seen<1200)return;
      visit(i+1,new Set([...used,j]),cost+(t.seen ? (now-t.seen>1200 ? Math.min(distance,.20) : distance) : .18),[...choices,j]);
    });
  }
  visit(0,new Set(),0,[]);
  best.choices.forEach((j,i)=>{if(j>=0)update(tracks[i],faces[j],now);});
}
function update(t,f,now){const dt=(now-t.seen)/1000;t.vx=t.seen&&dt>0&&dt<.4?clamp((f.x-t.x)/dt,-2,2)*.5+(t.vx||0)*.5:0;Object.assign(t,f,{seen:now});}
export function validRange(range){return Number.isFinite(range.min)&&Number.isFinite(range.max)&&range.max-range.min>=.12;}
