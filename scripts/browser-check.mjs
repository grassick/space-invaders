import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5173');
 await page.locator('#demo').click();
 await page.waitForTimeout(1500);
 assert.equal(await page.locator('#overlay').isVisible(),false);
 await page.locator('#pause').click();
 await page.waitForTimeout(100);
 assert.equal(await page.locator('#overlayTitle').textContent(),'Mission paused.');
 await page.locator('#demo').click();
 await page.locator('#camera').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Camera ready'),{},{timeout:30000});
 await page.waitForTimeout(2000);
 assert.equal(await page.locator('#calibrate').isEnabled(),true);
 assert.equal(await page.locator('#start').isDisabled(),true);
 await page.screenshot({path:'/tmp/headspace-desktop.png',fullPage:true});
 await page.locator('#camera').click();
 assert.match(await page.locator('#status').textContent(),/Camera off/);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/headspace-mobile.png',fullPage:true});
 const simulated=await browser.newPage();
 simulated.on('pageerror',e=>errors.push(e.message));
 await simulated.addInitScript(()=>{
   window.signalLost=false;
   window.Worker=class {
     constructor(){this.timer=setInterval(()=>{
       if(!this.onmessage)return;
       const x=.27+Math.sin(performance.now()/600)*.15;
       this.onmessage({data:{type:'faces',faces:window.signalLost?[]:[{x,y:.4,w:.12,h:.2},{x:x+.45,y:.4,w:.12,h:.2}]}});
     },50);}
     postMessage(d){if(d.type==='init')setTimeout(()=>this.onmessage({data:{type:'ready'}}),10);else d.bitmap.close();}
     terminate(){clearInterval(this.timer);}
   };
 });
 await simulated.goto('http://localhost:5173');
 await simulated.locator('#camera').click();
 await simulated.waitForFunction(()=>document.querySelector('#calibrate').disabled===false);
 await simulated.clock.install();
 await simulated.locator('#calibrate').click();
 await simulated.clock.runFor(31000);
 assert.equal(await simulated.locator('#start').isEnabled(),true,await simulated.locator('#overlay').innerText());
 await simulated.locator('#start').click();
 await simulated.clock.runFor(1600);
 assert.equal(await simulated.locator('#overlay').isVisible(),false);
 await simulated.evaluate(()=>window.signalLost=true);
 await simulated.clock.runFor(900);
 assert.equal(await simulated.locator('#overlayTitle').textContent(),'Hold position.');
 await simulated.evaluate(()=>window.signalLost=false);
 await simulated.clock.runFor(1600);
 assert.equal(await simulated.locator('#overlay').isVisible(),false);
 await simulated.locator('#demo').click();
 await simulated.locator('#calibrationMode').selectOption('joint');
 assert.equal(await simulated.locator('#start').isDisabled(),true);
 await simulated.locator('#calibrate').click();
 await simulated.clock.runFor(23500);
 assert.equal(await simulated.locator('#start').isEnabled(),true,await simulated.locator('#overlay').innerText());
 await simulated.locator('#players').selectOption('1');
 await simulated.locator('#calibrate').click();
 await simulated.clock.runFor(23500);
 assert.equal(await simulated.locator('#start').isEnabled(),true,await simulated.locator('#overlay').innerText());
 await simulated.locator('#camera').click();
 assert.deepEqual(errors,[]);
 console.log('Browser checks passed: demo, pause, actual worker/model initialization and frame processing with fake camera, camera stop, mobile layout, simulated individual/joint/single-player calibration and tracking-loss recovery; no page errors.');
} finally {await browser.close();}
