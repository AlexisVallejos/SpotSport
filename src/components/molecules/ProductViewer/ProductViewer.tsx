import { useEffect, useRef, useState } from 'react';
import styles from './ProductViewer.module.css';

type Props = { name: string; image?: string; featured?: boolean };
type Controls = { rotate: (x: number, y: number) => void; reset: () => void; zoom: (delta: number) => void; explode: (value: boolean) => void; color: (value: string) => void };
export default function ProductViewer({ name, image, featured = false }: Props) {
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#dedbd1');
  const host = useRef<HTMLDivElement>(null);
  const controls = useRef<Controls | null>(null);
  const drag = useRef<{x:number;y:number} | null>(null);
  const isShoe = name.startsWith('SPOT');
  useEffect(() => {
    if (!active || !host.current) return;
    let cancelled = false;
    let dispose: (()=>void) | undefined;
    Promise.all([import('three'), import('../../../lib/productScene')]).then(([T, {createProduct}]) => {
      if(cancelled || !host.current) return;
      const element = host.current;
      let renderer: InstanceType<typeof T.WebGLRenderer>;
      try { renderer = new T.WebGLRenderer({antialias:true,alpha:true}); } catch { setError(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));
      renderer.setClearColor(0x000000,0);
      renderer.outputColorSpace=T.SRGBColorSpace;
      element.appendChild(renderer.domElement);
      const scene = new T.Scene();
      const camera = new T.PerspectiveCamera(35,1,.1,50); camera.position.set(0,1.0,6.6); camera.lookAt(0,0,0);
      scene.add(new T.HemisphereLight(0xffffff,0x77766e,2.6));
      const light = new T.DirectionalLight(0xffffff,3.4); light.position.set(-3,5,4); scene.add(light);
      const rim = new T.DirectionalLight(0xffb875,1.5); rim.position.set(3,2,-3); scene.add(rim);
      const {group,sole,shoe} = createProduct(name, name.includes('Cancha')||name.includes('Top')?'#ff7900':name.includes('Pulso')||name.includes('Short')?'#30312e':'#dedbd1'); scene.add(group);
      const initial=group.rotation.clone();
      let visible=true;
      const draw=()=>{if(visible&&!document.hidden) renderer.render(scene,camera);};
      const resize = new ResizeObserver(()=> { const {width,height}=element.getBoundingClientRect(); renderer.setSize(width,height); camera.aspect=width/Math.max(height,1); camera.updateProjectionMatrix(); draw(); }); resize.observe(element);
      const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;draw();}); observer.observe(element);
      const visibility=()=>draw(); document.addEventListener('visibilitychange',visibility);
      const lost=(event:Event)=>{event.preventDefault();setError(true);}; renderer.domElement.addEventListener('webglcontextlost',lost);
      controls.current={
        rotate:(x,y)=>{group.rotation.y+=x;group.rotation.x=Math.max(-1.2,Math.min(1.2,group.rotation.x+y));draw();},
        reset:()=>{group.rotation.copy(initial);camera.position.set(0,1,6.6);sole.position.y=0;draw();},
        zoom:(delta)=>{camera.position.z=Math.max(4.5,Math.min(9,camera.position.z+delta));draw();},
        explode:(value)=>{if(shoe)sole.position.y=value?-.65:0;draw();},
        color:(value)=>{const mesh=group.children.find(c=>c instanceof T.Mesh) as InstanceType<typeof T.Mesh>; if(mesh) (mesh.material as InstanceType<typeof T.MeshStandardMaterial>).color.set(value);draw();}
      };
      setReady(true);draw();
      dispose=()=>{resize.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',lost);const mats=new Set<InstanceType<typeof T.Material>>();group.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));}});mats.forEach(m=>m.dispose());renderer.dispose();renderer.domElement.remove();controls.current=null;};
    }).catch(()=>{if(!cancelled)setError(true);});
    return ()=>{cancelled=true;dispose?.();};
  },[active,name]);
  const reset=()=>{controls.current?.reset();setExploded(false);};
  return <div className={`${styles.viewer} ${featured?styles.featured:''}`}>
    {(!ready||error) && <img className={styles.photo} src={image} alt={name} loading="lazy" decoding="async" draggable={false}/>}
    {active && <div ref={host} className={styles.canvas} style={{visibility:ready&&!error?'visible':'hidden'}} tabIndex={ready?0:-1} role="group" aria-label={`Vista 3D de ${name}. Arrastrá o usá las flechas para girar. Inicio restablece.`}
      onPointerDown={e=>{if(e.button!==0)return;drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(!drag.current)return;controls.current?.rotate((e.clientX-drag.current.x)*.012,(e.clientY-drag.current.y)*.008);drag.current={x:e.clientX,y:e.clientY};}}
      onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
      onKeyDown={e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key)){e.preventDefault();if(e.key==='Home')reset();else controls.current?.rotate(e.key==='ArrowLeft'?-.18:e.key==='ArrowRight'?.18:0,e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0);}}}/>} 
    {!active && <button className={styles.activate} onClick={()=>setActive(true)} aria-label={`Ver ${name} en 3D`}><span className={styles.dot}/>Explorar en 3D <span>↗</span></button>}
    {active && !ready && !error && <span role="status" className={styles.status}>Preparando vista 3D…</span>}
    {error && <span role="status" className={styles.status}>Vista 3D no disponible. Mostrando fotografía.</span>}
    {ready&&!error && <>
      <div className={styles.topline}><span>ESTUDIO SPOT / 3D</span><button onClick={()=>{setActive(false);setReady(false);setExploded(false);setSelectedColor('#dedbd1');}} aria-label={`Volver a la foto de ${name}`}>Foto ↗</button></div>
      <div className={styles.toolbar} aria-label={`Controles de ${name}`}>
        <button onClick={()=>controls.current?.rotate(-.35,0)} aria-label="Girar a la izquierda">↶</button>
        <button onClick={()=>controls.current?.rotate(.35,0)} aria-label="Girar a la derecha">↷</button>
        <button onClick={()=>controls.current?.zoom(-.5)} aria-label="Acercar">+</button>
        <button onClick={()=>controls.current?.zoom(.5)} aria-label="Alejar">−</button>
        <button onClick={reset} aria-label="Restablecer vista">↺</button>
        {featured && isShoe && <button className={styles.explode} aria-pressed={exploded} onClick={()=>{controls.current?.explode(!exploded);setExploded(!exploded);}}>{exploded?'Unir suela':'Separar suela'}</button>}
      </div>
      {featured && <div className={styles.colorOptions} aria-label="Color del concepto">{['#dedbd1','#30312e','#ff7900'].map((color,i)=><button key={color} style={{backgroundColor:color}} aria-label={['Color marfil','Color negro','Color naranja'][i]} aria-pressed={selectedColor===color} onClick={()=>{controls.current?.color(color);setSelectedColor(color);}}/>)}</div>}
      <p className={styles.disclosure}>Arrastrá para girar · Modelo conceptual aproximado</p>
    </>}
  </div>;
}
