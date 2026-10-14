"use client";
import { useEffect, useRef } from "react";

export type BackdropEffect = "silk" | "particles" | "aurora" | "none";

type Props = {
  effect: BackdropEffect;
  /** Base / mid / accent colors (#rrggbb). */
  from: string;
  to: string;
  accent: string;
  className?: string;
  /** 0..1 — how strongly the pointer bends the scene. */
  interactive?: number;
};

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;

// Flowing satin: a height field of layered waves, lit like folded fabric.
const SILK_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse;
  uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
  varying vec2 vUv;
  float wave(vec2 p, float t) {
    float v = sin(p.x * 1.5 + t * 0.32 + sin(p.y * 1.1 + t * 0.18) * 1.5);
    v += 0.6 * sin(p.y * 2.2 - t * 0.25 + sin(p.x * 1.6 - t * 0.14) * 1.2);
    v += 0.3 * sin((p.x + p.y) * 3.0 + t * 0.4);
    return v;
  }
  void main() {
    vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.2;
    p += (uMouse - 0.5) * 0.35;
    float w = wave(p, uTime);
    float e = 0.01;
    float wx = wave(p + vec2(e, 0.0), uTime) - w;
    float wy = wave(p + vec2(0.0, e), uTime) - w;
    vec3 n = normalize(vec3(-wx / e * 0.14, -wy / e * 0.14, 1.0));
    float light = dot(n, normalize(vec3(-0.45, 0.55, 0.75)));
    float spec = pow(max(light, 0.0), 28.0) * 0.32;
    float t = smoothstep(-1.8, 1.8, w);
    vec3 col = mix(uA, uB, t);
    col = mix(col, uC, smoothstep(0.6, 1.0, t) * 0.28);
    col *= 0.88 + 0.2 * light;
    col += spec;
    float vig = smoothstep(1.3, 0.15, length((vUv - 0.5) * vec2(1.25, 1.0)));
    gl_FragColor = vec4(mix(uA, col, 0.5 + 0.5 * vig), 1.0);
  }
`;

// Soft drifting light blobs.
const AURORA_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse;
  uniform vec3 uA; uniform vec3 uB; uniform vec3 uC;
  varying vec2 vUv;
  float blob(vec2 p, vec2 c, float r) { return smoothstep(r, 0.0, length(p - c)); }
  void main() {
    vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float t = uTime * 0.12;
    vec2 m = (uMouse - 0.5) * 0.15;
    vec3 col = uA;
    col = mix(col, uB, blob(p, vec2(sin(t) * 0.45, cos(t * 1.3) * 0.25) + m, 0.75) * 0.85);
    col = mix(col, uC, blob(p, vec2(cos(t * 0.8) * 0.55, sin(t * 1.1) * 0.3) - m, 0.55) * 0.35);
    col = mix(col, vec3(0.98, 0.9, 0.78), blob(p, vec2(sin(t * 1.7 + 2.0) * 0.5, cos(t * 0.6) * 0.35), 0.5) * 0.45);
    float grain = fract(sin(dot(vUv * uRes, vec2(12.9898, 78.233))) * 43758.5453);
    gl_FragColor = vec4(col + (grain - 0.5) * 0.015, 1.0);
  }
`;

// Petals / sparkles floating up through the frame.
const POINTS_VERT = /* glsl */ `
  uniform float uTime; uniform float uPixelRatio; uniform vec2 uMouse;
  attribute float aSize; attribute float aSpeed; attribute float aPhase; attribute vec3 aColor;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y = mod(p.y + uTime * aSpeed + 6.0, 12.0) - 6.0;
    p.x += sin(uTime * 0.6 + aPhase) * 0.35 + (uMouse.x - 0.5) * p.z * 0.25;
    p.z += cos(uTime * 0.4 + aPhase) * 0.2;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixelRatio * (12.0 / -mv.z);
    vColor = aColor;
    vAlpha = smoothstep(6.0, 3.5, abs(p.y)) * (0.45 + 0.55 * sin(uTime + aPhase * 3.0) * 0.5 + 0.25);
  }
`;
const POINTS_FRAG = /* glsl */ `
  precision highp float;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * Decorative WebGL background. Three.js is loaded on demand, rendering stops
 * when the element is off-screen or the tab is hidden, and visitors who prefer
 * reduced motion get a single still frame. The solid base colour sits
 * underneath, so the area always looks finished — even without WebGL.
 */
export default function ThreeBackdrop({ effect, from, to, accent, className = "", interactive = 1 }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || effect === "none") return;
    // Very low-end devices: keep the plain background colour.
    if (typeof navigator !== "undefined" && (navigator.hardwareConcurrency ?? 4) <= 2) return;

    let disposed = false;
    let cleanup = () => {};

    import("three").then((THREE) => {
      if (disposed) return;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "low-power" });
      } catch {
        return; // no WebGL — the plain background stays
      }
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      renderer.setPixelRatio(dpr);
      renderer.domElement.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0;transition:opacity .9s ease";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const mouse = new THREE.Vector2(0.5, 0.5);
      const target = new THREE.Vector2(0.5, 0.5);
      const uniforms = {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uMouse: { value: mouse },
        uA: { value: new THREE.Color(...hexToRgb(from)) },
        uB: { value: new THREE.Color(...hexToRgb(to)) },
        uC: { value: new THREE.Color(...hexToRgb(accent)) },
        uPixelRatio: { value: dpr },
      };

      let camera: InstanceType<typeof THREE.Camera>;
      const disposables: { dispose: () => void }[] = [];

      if (effect === "particles") {
        const persp = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
        persp.position.z = 9;
        camera = persp;
        const count = window.innerWidth < 640 ? 70 : 140;
        const pos = new Float32Array(count * 3);
        const size = new Float32Array(count);
        const speed = new Float32Array(count);
        const phase = new Float32Array(count);
        const color = new Float32Array(count * 3);
        // Accent + warm metallics read well on a light solid background.
        const palette: [number, number, number][] = [hexToRgb(accent), hexToRgb("#D9A86C"), hexToRgb("#E3A3AF"), hexToRgb("#C9B3A6")];
        for (let i = 0; i < count; i++) {
          pos[i * 3] = (Math.random() - 0.5) * 16;
          pos[i * 3 + 1] = (Math.random() - 0.5) * 12;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
          size[i] = 3 + Math.random() * 9;
          speed[i] = 0.12 + Math.random() * 0.3;
          phase[i] = Math.random() * Math.PI * 2;
          const c = palette[i % palette.length];
          color.set(c, i * 3);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
        geo.setAttribute("aSpeed", new THREE.BufferAttribute(speed, 1));
        geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
        geo.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
        const mat = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: POINTS_VERT,
          fragmentShader: POINTS_FRAG,
          transparent: true,
          depthWrite: false,
          blending: THREE.NormalBlending,
        });
        scene.add(new THREE.Points(geo, mat));
        disposables.push(geo, mat);
      } else {
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const geo = new THREE.PlaneGeometry(2, 2);
        const mat = new THREE.ShaderMaterial({
          uniforms,
          vertexShader: VERT,
          fragmentShader: effect === "aurora" ? AURORA_FRAG : SILK_FRAG,
        });
        scene.add(new THREE.Mesh(geo, mat));
        disposables.push(geo, mat);
      }

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        uniforms.uRes.value.set(w * dpr, h * dpr);
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(host);

      const onPointer = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        target.set(((e.clientX - r.left) / r.width - 0.5) * interactive + 0.5, (1 - (e.clientY - r.top) / r.height - 0.5) * interactive + 0.5);
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      let visible = true;
      let raf = 0;
      let last = performance.now();
      const io = new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible && !reduce) loop(performance.now());
      });
      io.observe(host);

      const frame = () => {
        mouse.lerp(target, 0.04);
        renderer.render(scene, camera);
      };
      const loop = (now: number) => {
        cancelAnimationFrame(raf);
        if (!visible || document.hidden || disposed) return;
        uniforms.uTime.value += Math.min(0.05, (now - last) / 1000);
        last = now;
        frame();
        raf = requestAnimationFrame(loop);
      };
      const onVisibility = () => {
        last = performance.now();
        if (!document.hidden && visible && !reduce) loop(last);
      };
      document.addEventListener("visibilitychange", onVisibility);

      uniforms.uTime.value = 4; // start mid-motion so the still frame looks composed
      frame();
      requestAnimationFrame(() => (renderer.domElement.style.opacity = "1"));
      if (!reduce) raf = requestAnimationFrame(loop);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", onVisibility);
        disposables.forEach((d) => d.dispose());
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [effect, from, to, accent, interactive]);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      style={{ background: from }}
    />
  );
}
