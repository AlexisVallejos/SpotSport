import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const output=process.env.SPOT_VERIFY_OUT||'scrollcraft/builds/spot/verification';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
for(const config of [{name:'desktop',width:1440,height:1000},{name:'mobile',width:390,height:844},{name:'compact',width:360,height:640},{name:'reduced',width:1440,height:1000,reducedMotion:'reduce'}]){
 const context=await browser.newContext({viewport:{width:config.width,height:config.height},reducedMotion:config.reducedMotion||'no-preference'});
 await context.addInitScript(()=>{Element.prototype.setPointerCapture=()=>{};Element.prototype.releasePointerCapture=()=>{};Element.prototype.requestPointerLock=()=>Promise.resolve();});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.SPOT_VERIFY_URL||'http://127.0.0.1:5173',{waitUntil:'networkidle'});
 const skip=page.getByRole('button',{name:'Saltar intro'});if(await skip.isVisible())await skip.click();await page.waitForTimeout(800);
 await page.screenshot({path:`${output}/${config.name}-hero.png`});
 await page.evaluate(()=>window.scrollTo({top:400,behavior:'instant'}));await page.waitForTimeout(150);await page.screenshot({path:`${output}/${config.name}-hero-mid.png`});
 await page.locator('#calzado').scrollIntoViewIfNeeded();await page.waitForTimeout(150);await page.screenshot({path:`${output}/${config.name}-catalog.png`});
 const button=page.getByRole('button',{name:'Ver SPOT Órbita 01 en 3D'}).first();await button.click();
 const canvas=page.getByRole('group',{name:/Vista 3D de SPOT Órbita 01/}).first();await canvas.waitFor({state:'visible'});await canvas.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowUp');
 await page.screenshot({path:`${output}/${config.name}-shoe.png`});
 await page.getByRole('button',{name:'Volver a la foto de SPOT Órbita 01'}).first().click();
 await page.getByRole('button',{name:'Ver Remera Aire en 3D'}).click();await page.getByRole('group',{name:/Vista 3D de Remera Aire/}).waitFor({state:'visible'});await page.screenshot({path:`${output}/${config.name}-apparel.png`});
 const feature=page.locator('section[aria-labelledby="seleccion-titulo"]');await feature.scrollIntoViewIfNeeded();await feature.getByRole('button',{name:'Ver SPOT Órbita 01 en 3D'}).click();await feature.getByRole('button',{name:'Separar suela'}).waitFor();
 await page.screenshot({path:`${output}/${config.name}-studio.png`});await feature.getByRole('button',{name:'Separar suela'}).click();await expect(feature.getByRole('button',{name:'Unir suela'})).toHaveAttribute('aria-pressed','true');await feature.getByRole('button',{name:'Color naranja'}).click();await expect(feature.getByRole('button',{name:'Color naranja'})).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:`${output}/${config.name}-exploded.png`});
 const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,brokenImages:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),canvasCount:document.querySelectorAll('canvas').length}));
 if(config.name==='desktop'){
  for(const name of ['SPOT Pulso TR','SPOT Cancha 10','SPOT Distrito','Short Ritmo','Top Eje','Campera Movimiento']){
    await page.getByRole('button',{name:`Ver ${name} en 3D`,exact:true}).click();
    const group=page.getByRole('group',{name:new RegExp(`Vista 3D de ${name}`)});await group.waitFor({state:'visible'});
    const before=await group.screenshot();await group.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');const after=await group.screenshot();expect(before.equals(after)).toBe(false);
    await page.getByRole('button',{name:`Volver a la foto de ${name}`,exact:true}).click();
  }
  await feature.scrollIntoViewIfNeeded();const group=feature.getByRole('group');const box=await group.boundingBox();
  const before=await group.screenshot();await page.mouse.move(box.x+box.width*.4,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.6,box.y+box.height*.5,{steps:8});await page.mouse.up();const after=await group.screenshot();expect(before.equals(after)).toBe(false);
 }
 expect(state.overflow).toBe(false);expect(state.brokenImages).toEqual([]);expect(errors).toEqual([]);
 results.push({name:config.name,...state,errors});await context.close();
}
// WebGL disabled must preserve the product image and an explicit status.
const context=await browser.newContext();await context.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:get.call(this,type,...args);};});
const page=await context.newPage();await page.goto(process.env.SPOT_VERIFY_URL||'http://127.0.0.1:5173');await page.getByRole('button',{name:'Saltar intro'}).click();await page.waitForTimeout(700);await page.getByRole('button',{name:'Ver SPOT Órbita 01 en 3D'}).first().click();await page.getByRole('status').filter({hasText:'Vista 3D no disponible'}).waitFor();results.push({name:'no-webgl',fallback:true});
await fs.writeFile(`${output}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));await browser.close();
