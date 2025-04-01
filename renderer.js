// renderer.js
const THREE = require('three');

// Simple pass-through vertex shader (inlined)
const vertexShaderSource = `
  varying vec2 vUv;
  void main() {
    vUv = uv; 
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Fragment shader (inlined)
const fragmentShaderSource = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uCenter;
uniform float uZoom;
uniform int uFractalType; // 0 = Mandelbrot, 1 = Julia
uniform vec2 uJuliaConstant;

// New uniforms for color customization:
uniform vec3 uColorOffset;
uniform vec3 uColorFrequency;

vec2 mapToFractalSpace(vec2 uv) {
  float aspect = uResolution.x / uResolution.y;
  vec2 coords = (uv - 0.5) * 2.0;
  coords.x *= aspect;
  coords /= uZoom;
  coords += uCenter;
  return coords;
}

int mandelbrotIterations(vec2 c) {
  vec2 z = vec2(0.0);
  int maxIter = 200;
  for (int i = 0; i < 200; i++) {
    float x = (z.x * z.x) - (z.y * z.y) + c.x;
    float y = 2.0 * z.x * z.y + c.y;
    z = vec2(x, y);
    if (dot(z, z) > 4.0) {
      return i;
    }
  }
  return maxIter;
}

int juliaIterations(vec2 z, vec2 c) {
  int maxIter = 200;
  for (int i = 0; i < 200; i++) {
    float x = (z.x * z.x) - (z.y * z.y) + c.x;
    float y = 2.0 * z.x * z.y + c.y;
    z = vec2(x, y);
    if (dot(z, z) > 4.0) {
      return i;
    }
  }
  return maxIter;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 coords = mapToFractalSpace(uv);

  int iters = 0;
  if (uFractalType == 0) {
    iters = mandelbrotIterations(coords);
  } else {
    iters = juliaIterations(coords, uJuliaConstant);
  }

  float t = float(iters) / 200.0;

  vec3 color = vec3(0.0);
  if (iters < 200) {
    // Use the new uniforms to customize colors:
    color = vec3(
      0.5 + 0.5 * cos(uColorFrequency.r * t + uColorOffset.r),
      0.5 + 0.5 * cos(uColorFrequency.g * t + uColorOffset.g),
      0.5 + 0.5 * cos(uColorFrequency.b * t + uColorOffset.b)
    );
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

// Holds fractal-specific parameters
let fractalParams = {
    centerX: -0.5,
    centerY: 0.0,
    zoom: 1.0,
    fractalType: 0, // 0 = Mandelbrot, 1 = Julia
    juliaConstant: new THREE.Vector2(0.355, 0.355),
};

let guiParams = {
    fractalType: fractalParams.fractalType,
    zoom: fractalParams.zoom,
    centerX: fractalParams.centerX,
    centerY: fractalParams.centerY,
    juliaConstantX: fractalParams.juliaConstant.x,
    juliaConstantY: fractalParams.juliaConstant.y,
    // New color parameters
    colorOffsetR: 3.0,
    colorOffsetG: 1.0,
    colorOffsetB: 5.0,
    colorFrequency: 6.28,
};

// Three.js variables
let scene, camera, renderer, quad;
let timeStart = Date.now();

// For mouse dragging
let isDragging = false;
let lastMouse = { x: 0, y: 0 };

init();
animate();

function init() {
    // Grab our <canvas> from index.html
    const canvas = document.getElementById('fractalCanvas');
    renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Create a scene
    scene = new THREE.Scene();

    // OrthographicCamera that covers the entire clip-space from -1 to +1
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    // Fullscreen plane geometry that goes from -1..+1 in both X & Y
    const geometry = new THREE.PlaneGeometry(2, 2);

    // Our custom ShaderMaterial with the fractal shaders
    const material = new THREE.ShaderMaterial({
        vertexShader: vertexShaderSource,
        fragmentShader: fragmentShaderSource,
        uniforms: {
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uTime: { value: 0.0 },
            uCenter: { value: new THREE.Vector2(fractalParams.centerX, fractalParams.centerY) },
            uZoom: { value: fractalParams.zoom },
            uFractalType: { value: fractalParams.fractalType },
            uJuliaConstant: { value: fractalParams.juliaConstant },
            // New color uniforms:
            uColorOffset: { value: new THREE.Vector3(guiParams.colorOffsetR, guiParams.colorOffsetG, guiParams.colorOffsetB) },
            uColorFrequency: { value: new THREE.Vector3(guiParams.colorFrequency, guiParams.colorFrequency, guiParams.colorFrequency) },
        },
    });

    // Create a mesh using the plane geometry + fractal material
    quad = new THREE.Mesh(geometry, material);
    scene.add(quad);

    // Listen for window resize to keep canvas full-screen
    window.addEventListener('resize', onWindowResize);
    // Listen for mouse wheel (zoom)
    window.addEventListener('wheel', onWheel);
    // Listen for mouse events (pan)
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    // Listen for keyboard events
    window.addEventListener('keydown', onKeyDown);

    // Initialize dat.GUI for interactive controls
    const gui = new dat.GUI();
    gui.add(guiParams, 'fractalType', { Mandelbrot: 0, Julia: 1 }).onChange((val) => {
        fractalParams.fractalType = Number(val);
        quad.material.uniforms.uFractalType.value = fractalParams.fractalType;
    });
    gui.add(guiParams, 'zoom', 0.1, 10).onChange((val) => {
        fractalParams.zoom = val;
        quad.material.uniforms.uZoom.value = fractalParams.zoom;
    });
    gui.add(guiParams, 'centerX', -2, 2).onChange((val) => {
        fractalParams.centerX = val;
        quad.material.uniforms.uCenter.value.x = val;
    });
    gui.add(guiParams, 'centerY', -2, 2).onChange((val) => {
        fractalParams.centerY = val;
        quad.material.uniforms.uCenter.value.y = val;
    });

    const juliaFolder = gui.addFolder('Julia Constant');
    juliaFolder.add(guiParams, 'juliaConstantX', -1, 1).onChange((val) => {
        fractalParams.juliaConstant.x = val;
        quad.material.uniforms.uJuliaConstant.value.x = val;
    });
    juliaFolder.add(guiParams, 'juliaConstantY', -1, 1).onChange((val) => {
        fractalParams.juliaConstant.y = val;
        quad.material.uniforms.uJuliaConstant.value.y = val;
    });
    juliaFolder.open();

    const colorFolder = gui.addFolder('Color Settings');
    colorFolder.add(guiParams, 'colorOffsetR', 0, 10).onChange((val) => {
        quad.material.uniforms.uColorOffset.value.x = val;
    });
    colorFolder.add(guiParams, 'colorOffsetG', 0, 10).onChange((val) => {
        quad.material.uniforms.uColorOffset.value.y = val;
    });
    colorFolder.add(guiParams, 'colorOffsetB', 0, 10).onChange((val) => {
        quad.material.uniforms.uColorOffset.value.z = val;
    });
    colorFolder.add(guiParams, 'colorFrequency', 0, 10).onChange((val) => {
        quad.material.uniforms.uColorFrequency.value.set(val, val, val);
    });
    colorFolder.open();
}

function animate() {
    requestAnimationFrame(animate);

    // Update time uniform for any time-based effects
    quad.material.uniforms.uTime.value = (Date.now() - timeStart) * 0.001;

    // Render scene
    renderer.render(scene, camera);
}

function onWindowResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    quad.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
}

function onWheel(e) {
    if (e.deltaY < 0) {
        // Zoom in
        fractalParams.zoom *= 1.1;
    } else {
        // Zoom out
        fractalParams.zoom /= 1.1;
    }
    quad.material.uniforms.uZoom.value = fractalParams.zoom;
}

function onMouseDown(e) {
    isDragging = true;
    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
}

function onMouseMove(e) {
    if (!isDragging) return;

    let dx = e.clientX - lastMouse.x;
    let dy = e.clientY - lastMouse.y;

    // Convert pixel drag to fractal coordinate shift
    let factor = (1.0 / fractalParams.zoom) * 0.002;
    fractalParams.centerX -= dx * factor;
    fractalParams.centerY += dy * factor;

    quad.material.uniforms.uCenter.value.set(fractalParams.centerX, fractalParams.centerY);

    lastMouse.x = e.clientX;
    lastMouse.y = e.clientY;
}

function onMouseUp() {
    isDragging = false;
}

function onKeyDown(e) {
    if (e.key === 'j' || e.key === 'J') {
        // Toggle fractal type: 0 => 1, or 1 => 0
        fractalParams.fractalType = 1 - fractalParams.fractalType;
        quad.material.uniforms.uFractalType.value = fractalParams.fractalType;
    }

    // Only tweak Julia constant if we're in Julia mode
    if (fractalParams.fractalType === 1) {
        if (e.key === 'ArrowLeft') fractalParams.juliaConstant.x -= 0.01;
        if (e.key === 'ArrowRight') fractalParams.juliaConstant.x += 0.01;
        if (e.key === 'ArrowUp') fractalParams.juliaConstant.y += 0.01;
        if (e.key === 'ArrowDown') fractalParams.juliaConstant.y -= 0.01;

        quad.material.uniforms.uJuliaConstant.value = fractalParams.juliaConstant;
    }
}