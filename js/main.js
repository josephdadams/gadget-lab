'use strict';
// Sets up the 3D scene and runs the game loop.
renderer = new THREE.WebGLRenderer({ canvas, antialias: devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
scene = new THREE.Scene();
const HORIZON = new THREE.Color('#c4e2f7');
scene.fog = new THREE.Fog(HORIZON, 170, 720);
scene.background = HORIZON;
camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.2, 1600);

buildCity();
scene.add(new THREE.HemisphereLight('#e4f3ff', '#5b5340', 0.8));
const sun = new THREE.DirectionalLight('#fff3dc', 0.75);
sun.position.copy(sunDir).multiplyScalar(100);
scene.add(sun);
const sky = new THREE.Mesh(new THREE.SphereGeometry(1300, 24, 12), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color('#4ea4f0') }, horizon: { value: HORIZON } },
  vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main() { float h = normalize(vP).y; gl_FragColor = vec4(mix(horizon, top, smoothstep(0.0, 0.45, h)), 1.0); }',
}));
sky.renderOrder = -1;
scene.add(sky);

makePeople();
makePlayer();
makeDragon();
setView(firstPerson);
camYaw = 0; camPitch = 0.12;
updateCashUI(); updateGadgetUI();

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
if (matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  pollInput(dt);
  if (state === 'play') {
    updateGadgets(dt);
    updateDragon(dt);
    updatePlayer(dt);
    updateCrooks(dt);
  } else if (state === 'menu') {
    camYaw += dt * 0.06; // slow look around the city behind the menu
    if (dragon.state === 'roam') updateDragon(dt);
    player.mesh.updateMatrixWorld(true);
  }
  if (state !== 'lab') updatePeople(dt);
  updateFx(dt);
  hqSpinner.rotation.y += dt * 0.8; hqSpinner.rotation.x += dt * 0.3;
  updateCamera(dt);
  sky.position.copy(camera.position);
  updateHud(dt);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
// keep the save fresh while swinging around (stats like distance don't save on their own)
setInterval(() => { if (state === 'play') persist(); }, 5000);
$('playBtn').focus();
