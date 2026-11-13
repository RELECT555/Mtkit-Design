import {
  ACESFilmicToneMapping, Box3, DirectionalLight, Group, Mesh, PerspectiveCamera,
  PMREMGenerator, Scene, Vector3, WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

function disposeModel(model: Group) {
  model.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => material.dispose());
  });
}

export function createLogoScene(canvas: HTMLCanvasElement) {
  const options: WebGLContextAttributes = { alpha: true, antialias: true };
  const context = canvas.getContext("webgl2", options);
  if (!context) throw new Error("WebGL 2 is unavailable");

  const renderer = new WebGLRenderer({ canvas, context, ...options });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;

  const scene = new Scene();
  const room = new RoomEnvironment();
  const generator = new PMREMGenerator(renderer);
  const environment = generator.fromScene(room, 0.05);
  room.dispose();
  generator.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.8;
  scene.environmentRotation.y = -0.35;

  for (const [color, intensity, x, y, z] of [
    [0xffe4d7, 1.75, -4, 8, 10], [0xb8aaff, 1.3, 6, 3, -4],
    [0xff825d, 0.65, -4, -3, 4], [0xffffff, 0.35, 6, -3, 12],
  ]) {
    const light = new DirectionalLight(color, intensity);
    light.position.set(x, y, z);
    scene.add(light);
  }

  const camera = new PerspectiveCamera(35, 1, 0.1, 150);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  // Leave vertical swipes and pinch zoom to the browser on touch devices.
  canvas.style.touchAction = "pan-y pinch-zoom";
  // Explicit zoom buttons keep wheel scrolling available to the page.
  controls.enableZoom = false;
  const loader = new GLTFLoader();
  const models = new Map<string, Group>();
  const modelSize = new Vector3();
  let model: Group | undefined;
  let disposed = false;

  function render() {
    if (model && !disposed && !renderer.getContext().isContextLost()) renderer.render(scene, camera);
  }

  function fitDistance() {
    const halfFov = Math.tan(camera.fov * Math.PI / 360);
    return Math.max(modelSize.x * 0.65 / (halfFov * camera.aspect), modelSize.y * 0.74 / halfFov);
  }

  function reset() {
    if (!model) return;
    const wide = modelSize.x > modelSize.y * 2;
    controls.target.set(wide ? 0.16 : 0, 0, 0);
    camera.position.set(wide ? 0.2 : 0.43, wide ? 0.15 : 0.29, 1)
      .normalize().multiplyScalar(fitDistance()).add(controls.target);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
    render();
  }

  function fitCanvas() {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    const previousDistance = fitDistance();
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    if (model && previousDistance > 0) {
      camera.position.sub(controls.target).multiplyScalar(fitDistance() / previousDistance).add(controls.target);
      controls.update();
    }
    render();
  }
  fitCanvas();
  const resize = new ResizeObserver(fitCanvas);
  resize.observe(canvas);
  controls.addEventListener("change", render);
  canvas.addEventListener("webglcontextrestored", render);

  return {
    async show(url: string, signal: AbortSignal) {
      let next = models.get(url);
      if (!next) {
        const response = await fetch(url, { signal });
        if (!response.ok) throw new Error("Could not load the MTKit logo");
        next = (await loader.parseAsync(await response.arrayBuffer(), "")).scene;
        if (signal.aborted || disposed) {
          disposeModel(next);
          return;
        }
        models.set(url, next);
      }
      if (signal.aborted || disposed) return;
      if (model) scene.remove(model);
      model = next;
      scene.add(model);
      new Box3().setFromObject(model).getSize(modelSize);
      reset();
    },
    rotate(horizontal: number, vertical: number) {
      controls.rotateLeft(horizontal);
      controls.rotateUp(vertical);
    },
    zoom(factor: number) {
      camera.zoom = Math.min(2.1, Math.max(0.7, camera.zoom * factor));
      camera.updateProjectionMatrix();
      render();
    },
    reset,
    dispose() {
      disposed = true;
      resize.disconnect();
      canvas.removeEventListener("webglcontextrestored", render);
      controls.dispose();
      models.forEach(disposeModel);
      environment.dispose();
      renderer.dispose();
    },
  };
}
