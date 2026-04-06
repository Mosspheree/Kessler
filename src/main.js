import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { twoline2satrec, propagate, gstime, eciToGeodetic, degreesLat, degreesLong } from 'satellite.js';

const R = 1.0, SCALE = 1/6371;
const container = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth/window.innerHeight, 0.001, 1000);
camera.position.set(0, 0, 3.8);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1.3;
controls.maxDistance = 10;

scene.add(new THREE.AmbientLight(0x223355, 3));
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(5,3,5); scene.add(sun);

// Stars
const sv = [];
for(let i=0;i<10000;i++){
  const t=Math.random()*Math.PI*2, p=Math.acos(2*Math.random()-1), r=50+Math.random()*50;
  sv.push(r*Math.sin(p)*Math.cos(t), r*Math.cos(p), r*Math.sin(p)*Math.sin(t));
}
const sg = new THREE.BufferGeometry();
sg.setAttribute('position', new THREE.Float32BufferAttribute(sv,3));
scene.add(new THREE.Points(sg, new THREE.PointsMaterial({color:0xffffff,size:0.04})));

// Earth
const earth = new THREE.Mesh(
  new THREE.SphereGeometry(R,64,64),
  new THREE.MeshPhongMaterial({color:0x1a3a6a,emissive:0x081828,shininess:20})
);
scene.add(earth);

// Continents (rough outline using Lambert zones)
const contMat = new THREE.MeshPhongMaterial({color:0x2d5a27,emissive:0x0a1a08,shininess:5});
[[0.3,0.15,0.4,0.5],[0.55,0.1,0.25,0.45],[0.15,0.55,0.2,0.3]].forEach(([lat,lon,w,h])=>{
  const g = new THREE.SphereGeometry(R*1.001,16,16,lon*Math.PI*2,w*Math.PI*2,(0.5-lat)*Math.PI,h*Math.PI);
  scene.add(new THREE.Mesh(g,contMat));
});

// Atmosphere
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(R*1.025,32,32),
  new THREE.MeshPhongMaterial({color:0x4488ff,transparent:true,opacity:0.06,side:THREE.FrontSide})
));

// Orbital shells (LEO, MEO, GEO rings)
[[1.063,0x00ffff,0.03,'LEO'],[1.35,0xffaa00,0.02,'MEO'],[1.65,0xff44ff,0.015,'GEO']].forEach(([r,color,opacity,name])=>{
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r,0.002,8,120),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity})
  );
  ring.rotation.x = Math.PI/2;
  scene.add(ring);
});

// Grid
const gm = new THREE.LineBasicMaterial({color:0x00ffff,opacity:0.04,transparent:true});
for(let lat=-80;lat<=80;lat+=20){
  const pts=[];
  for(let lon=0;lon<=360;lon+=5){
    const phi=(90-lat)*Math.PI/180, th=lon*Math.PI/180;
    pts.push(new THREE.Vector3(R*1.001*Math.sin(phi)*Math.cos(th),R*1.001*Math.cos(phi),R*1.001*Math.sin(phi)*Math.sin(th)));
  }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gm));
}

function dot(color,size=0.006){
  return new THREE.Mesh(new THREE.SphereGeometry(size,6,6),new THREE.MeshBasicMaterial({color}));
}

function lla2xyz(lat,lon,alt){
  const r=R+alt*SCALE, phi=(90-lat)*Math.PI/180, th=(lon+180)*Math.PI/180;
  return new THREE.Vector3(r*Math.sin(phi)*Math.cos(th),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(th));
}

function propagateSat(satrec,date){
  try{
    const gmst=gstime(date);
    const {position}=propagate(satrec,date);
    if(!position||!position.x) return null;
    const geo=eciToGeodetic(position,gmst);
    return {lat:degreesLat(geo.latitude),lon:degreesLong(geo.longitude),alt:geo.height};
  }catch{return null;}
}

const TLES = [
  ['ISS (ZARYA)','1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9002','2 25544  51.6400 208.9163 0006703  86.9290 273.5169 15.49259098430600','payload','International Space Station — crewed'],
  ['STARLINK-1007','1 44713U 19074A   24001.50000000  .00002182  00000-0  17491-3 0  9993','2 44713  53.0554 180.4570 0001370  85.7940 274.3350 15.06386940232791','payload','SpaceX Starlink internet satellite'],
  ['NOAA 19','1 33591U 09005A   24001.50000000  .00000074  00000-0  68740-4 0  9998','2 33591  99.1920  45.2180 0013899 315.6120  44.4000 14.12273098762403','payload','NOAA weather observation satellite'],
  ['COSMOS 2251 DEB','1 34427U 93036PD  24001.50000000  .00000471  00000-0  13947-3 0  9990','2 34427  74.0385 208.8374 0033174 264.4898  95.2691 14.35491168  7873','debris','Debris from 2009 Iridium-Cosmos collision'],
  ['IRIDIUM 33 DEB','1 33766U 97051CE  24001.50000000  .00001364  00000-0  26924-3 0  9997','2 33766  86.3936 296.0564 0003529 200.0994 160.0124 14.33896089  6281','debris','Debris from 2009 Iridium-Cosmos collision'],
  ['FENGYUN 1C DEB','1 29228U 99025AFX 24001.50000000  .00000489  00000-0  71803-4 0  9993','2 29228  98.6188 327.5422 0014688 120.4508 239.7927 14.23033703260801','debris','Debris from 2007 Chinese ASAT test — 3000+ fragments'],
  ['SL-16 R/B','1 22285U 92093B   24001.50000000  .00000077  00000-0  99040-4 0  9995','2 22285  71.0173  45.8916 0012836 284.9990  74.9790 14.12457298595801','rocket','Zenit-2 rocket body — Soviet launch vehicle'],
  ['TERRA','1 25994U 99068A   24001.50000000  .00000019  00000-0  27330-4 0  9999','2 25994  98.2015  36.5910 0001184  87.0690 273.0630 14.57115084281651','payload','NASA Earth observation satellite'],
  ['AQUA','1 27424U 02022A   24001.50000000  .00000086  00000-0  37400-4 0  9994','2 27424  98.2141 136.2490 0001315  73.2100 286.9230 14.57110891140961','payload','NASA water cycle observation satellite'],
  ['COSMOS 1408 DEB','1 49271U 82092PQ  24001.50000000  .00000970  00000-0  15430-3 0  9994','2 49271  82.9612 100.3456 0008234 291.2341  68.8123 14.76234512 34521','debris','Debris from 2021 Russian ASAT test'],
  ['GPS BIIR-2','1 24876U 97035A   24001.50000000 -.00000025  00000-0  00000+0 0  9995','2 24876  55.4810 160.0360 0044626  31.0690 329.2590  2.00560594193182','payload','GPS navigation satellite — MEO orbit'],
  ['SL-8 R/B','1 13453U 82059B   24001.50000000  .00000123  00000-0  14230-3 0  9991','2 13453  74.0347 187.4561 0019234 145.6723 214.5634 14.29384756234512','rocket','Soviet Cosmos rocket body'],
  ['GLOBALSTAR M001','1 35280U 09017A   24001.50000000  .00000051  00000-0  00000+0 0  9994','2 35280  51.9999 351.5234 0001870 282.1950  77.8810 13.34285532767152','payload','Globalstar communications satellite'],
  ['BREEZE-M DEB','1 38746U 12044C   24001.50000000  .00000234  00000-0  00000+0 0  9998','2 38746  49.9823  23.4512 3456789 123.4567 234.5678  6.98765432123456','debris','Proton-M Breeze-M upper stage debris'],
  ['DELTA 1 DEB','1 08744U 76023D   24001.50000000  .00000056  00000-0  89230-4 0  9997','2 08744  89.9123 267.8901 0023456 198.7654 161.2890 13.86543219876543','debris','Delta rocket debris — 50+ years in orbit'],
];

const COLORS = {payload:0x44aaff, rocket:0xffaa44, debris:0xff4444, cascade:0xff00ff};
let sats=[], debrisFields=[], cascades=0, simTime=0, running=false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredSat = null;

function buildSats(){
  const now = new Date();
  const oa = document.getElementById('oa');
  const ob = document.getElementById('ob');
  oa.innerHTML = ob.innerHTML = '';
  TLES.forEach(([name,l1,l2,type,desc])=>{
    try{
      const satrec = twoline2satrec(l1,l2);
      const pos = propagateSat(satrec,now);
      if(!pos) return;
      const mesh = dot(COLORS[type]||COLORS.payload, type==='debris'?0.004:0.007);
      mesh.position.copy(lla2xyz(pos.lat,pos.lon,pos.alt));
      scene.add(mesh);
      sats.push({name,satrec,type,mesh,desc,pos});
      oa.innerHTML += `<option value="${sats.length-1}">${name}</option>`;
      ob.innerHTML += `<option value="${sats.length-1}">${name}</option>`;
    }catch{}
  });
  if(sats.length>1) ob.selectedIndex=1;
  document.getElementById('s-total').textContent = sats.length;
  document.getElementById('go').disabled = false;
  document.getElementById('load').style.display = 'none';
  document.getElementById('instructions').style.display = 'block';
}

function spawnCloud(origin, count, isCascade){
  const frags=[];
  for(let i=0;i<count;i++){
    const v=new THREE.Vector3((Math.random()-.5)*0.003,(Math.random()-.5)*0.003,(Math.random()-.5)*0.003);
    const m=dot(isCascade?COLORS.cascade:COLORS.debris,0.003);
    const offset=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).normalize().multiplyScalar(0.02);
    m.position.copy(origin).add(offset);
    scene.add(m);
    frags.push({pos:m.position.clone(),vel:v,mesh:m});
  }
  debrisFields.push({frags,age:0,isCascade});
}

function addLog(msg, isWarning=false){
  const el=document.getElementById('entries');
  const div=document.createElement('div');
  div.style.color = isWarning ? '#ff4' : '#f88';
  div.textContent = `${new Date().toLocaleTimeString()} — ${msg}`;
  el.appendChild(div);
  el.scrollTop=el.scrollHeight;
  document.getElementById('log').style.display='block';
}

function showTooltip(sat){
  const tip = document.getElementById('tooltip');
  const altKm = sat.pos ? sat.pos.alt.toFixed(0) : '—';
  const orbital = sat.pos ? (sat.pos.alt < 2000 ? 'LEO' : sat.pos.alt < 35000 ? 'MEO' : 'GEO') : '—';
  tip.innerHTML = `
    <div style="color:#0ff;font-size:12px;font-weight:bold;margin-bottom:4px">${sat.name}</div>
    <div style="color:#aaa;font-size:10px;margin-bottom:6px">${sat.desc||''}</div>
    <div style="font-size:10px;color:#888">Type: <span style="color:#fff">${sat.type}</span></div>
    <div style="font-size:10px;color:#888">Altitude: <span style="color:#fff">${altKm} km</span></div>
    <div style="font-size:10px;color:#888">Shell: <span style="color:#fff">${orbital}</span></div>
  `;
  tip.style.display='block';
}

function triggerCollision(){
  const ia=parseInt(document.getElementById('oa').value);
  const ib=parseInt(document.getElementById('ob').value);
  if(ia===ib){alert('Please select two different objects');return;}
  const sa=sats[ia], sb=sats[ib];
  const pos=sa.mesh.position.clone();

  // Flash effect
  sa.mesh.material.color.set(0xffffff);
  sb.mesh.position.copy(pos);
  sb.mesh.material.color.set(0xffffff);

  // Explosion ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.01,0.003,8,32),
    new THREE.MeshBasicMaterial({color:0xff8800,transparent:true,opacity:1})
  );
  ring.position.copy(pos);
  ring.lookAt(camera.position);
  scene.add(ring);

  let ringScale = 1;
  const expandRing = setInterval(()=>{
    ringScale += 0.3;
    ring.scale.setScalar(ringScale);
    ring.material.opacity -= 0.05;
    if(ring.material.opacity <= 0){ clearInterval(expandRing); scene.remove(ring); }
  }, 30);

  setTimeout(()=>{
    scene.remove(sa.mesh); scene.remove(sb.mesh);
    sats=sats.filter(s=>s!==sa&&s!==sb);
    spawnCloud(pos,150,false);
    addLog(`💥 COLLISION: ${sa.name} × ${sb.name}`,true);
    addLog(`⚠ Generating ~150 debris fragments in ${sa.type==='payload'?'LEO':'orbital'} shell`);
    cascades++; running=true;
    document.getElementById('go').disabled=true;
    document.getElementById('instructions').style.display='none';
    updateStats();
  },600);
}

function updateStats(){
  const td=debrisFields.reduce((s,d)=>s+d.frags.length,0);
  document.getElementById('s-total').textContent=sats.length;
  document.getElementById('s-debris').textContent=td;
  document.getElementById('s-cas').textContent=cascades;
  document.getElementById('s-time').textContent=simTime.toFixed(0)+'s';
}

document.getElementById('go').addEventListener('click',triggerCollision);
document.getElementById('rst').addEventListener('click',()=>location.reload());

// Hover detection
window.addEventListener('mousemove',e=>{
  mouse.x=(e.clientX/window.innerWidth)*2-1;
  mouse.y=-(e.clientY/window.innerHeight)*2+1;
  const tip=document.getElementById('tooltip');
  tip.style.left=(e.clientX+15)+'px';
  tip.style.top=(e.clientY+15)+'px';
  raycaster.setFromCamera(mouse,camera);
  const meshes=sats.map(s=>s.mesh);
  const hits=raycaster.intersectObjects(meshes);
  if(hits.length>0){
    const sat=sats.find(s=>s.mesh===hits[0].object);
    if(sat){ showTooltip(sat); hoveredSat=sat; }
  } else {
    tip.style.display='none';
    hoveredSat=null;
  }
});

window.addEventListener('resize',()=>{
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth,window.innerHeight);
});

let last=performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now(), dt=(now-last)/1000; last=now;
  controls.update();
  earth.rotation.y+=0.0003;
  const date=new Date();
  sats.forEach(s=>{
    const pos=propagateSat(s.satrec,date);
    if(pos){ s.mesh.position.copy(lla2xyz(pos.lat,pos.lon,pos.alt)); s.pos=pos; }
  });
  if(running){
    simTime+=dt;
    debrisFields.forEach(field=>{
      field.age+=dt;
      field.frags.forEach(f=>{
        const toC=f.pos.clone().negate().normalize();
        f.vel.addScaledVector(toC,0.000003);
        f.pos.addScaledVector(f.vel,1);
        f.mesh.position.copy(f.pos);
        if(f.pos.length()<R*1.01){
          f.pos.normalize().multiplyScalar(R*1.05);
          f.vel.reflect(f.pos.clone().normalize()).multiplyScalar(0.4);
        }
      });
      if(field.age>3&&field.age<3.1){
        sats.forEach(sat=>{
          const d=sat.mesh.position.distanceTo(field.frags[0]?.mesh.position||new THREE.Vector3());
          if(d<0.12&&Math.random()<0.35){
            addLog(`🔴 CASCADE: fragment struck ${sat.name}`,true);
            spawnCloud(sat.mesh.position.clone(),60,true);
            scene.remove(sat.mesh);
            sats=sats.filter(s=>s!==sat);
            cascades++;
          }
        });
      }
    });
    updateStats();
  }
  renderer.render(scene,camera);
}

document.getElementById('lt').textContent='Building orbital model...';
buildSats();
animate();
