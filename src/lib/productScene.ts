import * as T from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Original procedural concepts, not scans or manufacturing representations.
export function createProduct(name: string, color: string) {
  const group = new T.Group();
  const fabric = new T.MeshStandardMaterial({ color, roughness: .88 });
  const rubber = new T.MeshStandardMaterial({ color: '#eeeae0', roughness: .7 });
  const dark = new T.MeshStandardMaterial({ color: '#222321', roughness: .8 });
  const accent = new T.MeshStandardMaterial({ color: '#ff7900', roughness: .5 });
  const sole = new T.Group();
  const add = (geometry: T.BufferGeometry, material: T.Material, parent = group) => {
    const mesh = new T.Mesh(geometry, material); parent.add(mesh); return mesh;
  };
  const line = (points: T.Vector3[], material: T.Material, radius = .016, parent = group) =>
    add(new T.TubeGeometry(new T.CatmullRomCurve3(points), 32, radius, 8, false), material, parent);
  const shoe = name.startsWith('SPOT');
  if (shoe) {
    // Closed cross-section mesh, profiled from heel to broad toe with raised collar.
    const shell = (bottom: number, height: number, widths: number[], tops: number[]) => {
      const pos: number[] = [], indices: number[] = [];
      const n = 81, segments = 48;
      const profile = new T.CatmullRomCurve3(widths.map((w,i)=>new T.Vector3(-1.55+i/(widths.length-1)*3.1,w,tops[i])));
      for (let i = 0; i < n; i++) for (let j = 0; j <= segments; j++) {
        const a = j / segments * Math.PI * 2;
        const profilePoint = profile.getPoint(i/(n-1));
        pos.push(profilePoint.x, bottom + Math.pow((Math.sin(a) + 1) / 2, .8) * height * profilePoint.z, Math.cos(a) * Math.max(.002,profilePoint.y));
      }
      for (let i = 0; i < n - 1; i++) for (let j = 0; j < segments; j++) {
        const a = i * (segments + 1) + j, b = a + segments + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(indices); g.computeVertexNormals(); return g;
    };
    const widths = [.015,.30,.43,.46,.43,.45,.51,.53,.47,.32,.015];
    add(shell(-.43,.31,widths,[.4,.8,1,1,1,1,.95,.9,.8,.7,.35]), rubber, sole);
    add(shell(-.47,.10,widths.map(w=>w*1.02),[.4,.9,1,1,1,1,1,1,1,.7,.35]), dark, sole);
    add(shell(-.19,.94,widths.map(w=>w*.94),[.1,.8,1,1,.85,.65,.44,.38,.32,.25,.05]), fabric);
    const collar = add(new T.TorusGeometry(.255,.082,12,48),dark); collar.rotation.x=Math.PI/2; collar.position.set(-.77,.62,0); collar.scale.set(1.3,1,1);
    for(let i=0;i<6;i++) {
      const x=-.42+i*.15, y=.60-i*.061;
      line([new T.Vector3(x,y,-.22),new T.Vector3(x+.07,y+.06,0),new T.Vector3(x+.02,y,.22)],rubber,.025);
    }
    for(const side of [-1,1]) {
      line([new T.Vector3(-1.1,.05,side*.37),new T.Vector3(-.5,.1,side*.46),new T.Vector3(.1,.02,side*.47),new T.Vector3(.85,-.02,side*.47)],accent,.043);
      for(let i=0;i<12;i++) {
        const x=-.15+i*.082;
        line([new T.Vector3(x,.05,side*.46),new T.Vector3(x+.025,.18,side*.43)],rubber,.007);
      }
    }
    for(let i=0;i<13;i++) { const tread=add(new T.BoxGeometry(.07,.04,.62),dark,sole); tread.position.set(-1.2+i*.19,-.47,0); }
    group.add(sole); group.rotation.set(.08,-.35,-.12);
  } else {
    const short = name.includes('Short'), top = name.includes('Top'), jacket = name.includes('Campera');
    const points = short ? [[-.65,.8],[.65,.8],[.85,-.85],[.12,-.85],[0,-.1],[-.12,-.85],[-.85,-.85]] : top ? [[-.4,1],[-.22,1],[-.15,.65],[.15,.65],[.22,1],[.4,1],[.47,-.65],[-.47,-.65]] : [[-.36,1],[-.75,.85],[-1.2,jacket?-.55:.22],[-.85,jacket?-.72:.05],[-.58,.38],[-.62,-1],[.62,-1],[.58,.38],[.85,jacket?-.72:.05],[1.2,jacket?-.55:.22],[.75,.85],[.36,1],[.24,.72],[-.24,.72]];
    const shape = new T.Shape(points.map(([x,y])=>new T.Vector2(x,y))); shape.closePath();
    const base = new T.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:true,bevelThickness:.04,bevelSize:.045,bevelSegments:5,steps:1}); base.center();
    // Subdivide the garment surfaces before adding a gentle fabric drape.
    const positions = base.getAttribute('position');
    const vertices: number[] = [];
    const split = (a:T.Vector3,b:T.Vector3,c:T.Vector3,depth:number) => {
      if(depth===0){vertices.push(...a.toArray(),...b.toArray(),...c.toArray());return;}
      const ab=a.clone().lerp(b,.5),bc=b.clone().lerp(c,.5),ca=c.clone().lerp(a,.5);
      split(a,ab,ca,depth-1);split(ab,b,bc,depth-1);split(ca,bc,c,depth-1);split(ab,bc,ca,depth-1);
    };
    for(let i=0;i<positions.count;i+=3) split(new T.Vector3().fromBufferAttribute(positions,i),new T.Vector3().fromBufferAttribute(positions,i+1),new T.Vector3().fromBufferAttribute(positions,i+2),2);
    for(let i=0;i<vertices.length;i+=3){
      const x=vertices[i],y=vertices[i+1],z=vertices[i+2];
      const fullness=.18*Math.max(0,1-Math.pow(x/.72,2))*Math.max(0,1-Math.pow(y/1.15,4));
      vertices[i+2]=z+Math.sign(z)*fullness+.018*Math.sin(x*24+y*2)*(1-Math.min(1,Math.abs(y)));
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));const smooth=mergeVertices(geometry);smooth.computeVertexNormals();geometry.dispose();base.dispose();
    add(smooth,fabric);
    if(jacket) line([new T.Vector3(0,-.92,.23),new T.Vector3(0,0,.33),new T.Vector3(0,.87,.26)],rubber,.018);
    const logo=add(new T.BoxGeometry(.19,.05,.015),accent); logo.position.set(.26,.38,.34);
    // Side seams and lower hem give the concept physical construction.
    line([new T.Vector3(-.5,-.8,.19),new T.Vector3(0,-.82,.21),new T.Vector3(.5,-.8,.19)],dark,.009);
    group.rotation.y=-.3;
  }
  return {group, sole, shoe};
}
