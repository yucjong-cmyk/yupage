// 첫 화면 WebGL 셰이더 배경 (네온 육각 만화경)
(() => {
  const canvas = document.getElementById('shader');
  const hero = document.querySelector('.hero');
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) return; // CSS 그라데이션 배경이 대신 보입니다

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const vert = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
  const frag = `
  precision highp float;
  uniform vec2 R;
  uniform float T;
  uniform vec2 M;
  #define PI 3.14159265
  #define TAU 6.28318531

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  vec3 pal(float t){ return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67))); }

  // 육각형 격자: xy = 칸 안 좌표, zw = 칸 id
  vec4 hexCell(vec2 uv){
    vec2 r = vec2(1.0, 1.7320508);
    vec2 h = r * 0.5;
    vec2 a = mod(uv, r) - h;
    vec2 b = mod(uv - h, r) - h;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    return vec4(gv, uv - gv);
  }

  // 육각 트루쳇: 번갈아 있는 세 꼭짓점을 중심으로 한 호
  float truchet(vec2 gv, vec2 id){
    float flip = hash(id) > 0.5 ? 1.0 : 0.0;
    float d = 1e9;
    for (int k = 0; k < 3; k++){
      float ang = PI / 6.0 + (float(k) * 2.0 + flip) * PI / 3.0;
      vec2 v = vec2(cos(ang), sin(ang)) * 0.57735;
      d = min(d, abs(length(gv - v) - 0.288675));
    }
    return d;
  }

  void main(){
    vec2 p = (gl_FragCoord.xy - 0.5 * R) / R.y;
    p -= M * 0.35;                      // 끌기로 중심 이동
    float r = length(p);
    float a = atan(p.y, p.x);

    // 로그-극좌표로 감아 만화경처럼 회전하며 빨려 들어가는 무늬
    float N = 9.0;
    vec2 uv = vec2(a / TAU * N + T * 0.03, log(r) * N / TAU * 1.732 - T * 0.25);

    vec4 c = hexCell(uv);
    vec2 id = vec2(mod(floor(c.z * 2.0 + 0.5), N * 2.0), floor(c.w * 2.0 + 0.5));
    float d = truchet(c.xy, id);

    float w = 0.04;
    float line = smoothstep(w, w * 0.4, d);
    float glow = 0.012 / (d + 0.01);

    float hue = hash(id) * 0.6 + c.w * 0.05 + T * 0.04;
    vec3 col = pal(hue) * (line * 1.1 + glow * 0.35);

    // 칸 안쪽 은은한 면
    col += pal(hue + 0.5) * 0.06 * (1.0 - smoothstep(0.0, 0.5, length(c.xy)));

    // 중심은 어둡게, 가장자리로 갈수록 서서히
    col *= smoothstep(0.02, 0.35, r);
    col *= 1.0 - smoothstep(0.7, 1.4, r) * 0.6;

    vec3 base = vec3(0.07, 0.055, 0.2);
    col = base + col;
    gl_FragColor = vec4(pow(col, vec3(0.95)), 1.0);
  }`;

  function compile(type, src){
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, vert);
  const fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uR = gl.getUniformLocation(prog, 'R');
  const uT = gl.getUniformLocation(prog, 'T');
  const uM = gl.getUniformLocation(prog, 'M');

  // 끌기 상태 (부드럽게 따라가도록 target/current 분리)
  const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
  let dragging = false, last = null;

  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (reduce) render(20000);
  }

  function render(ms){
    cur.x += (target.x - cur.x) * 0.08;
    cur.y += (target.y - cur.y) * 0.08;
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, ms / 1000);
    gl.uniform2f(uM, cur.x, cur.y);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(hero);

  function loop(ms){
    if (visible) render(ms);
    requestAnimationFrame(loop);
  }

  hero.addEventListener('pointerdown', e => { dragging = true; last = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', e => {
    if (!dragging) return;
    const h = canvas.clientHeight;
    target.x = Math.max(-1, Math.min(1, target.x + (e.clientX - last.x) / h * 2));
    target.y = Math.max(-1, Math.min(1, target.y - (e.clientY - last.y) / h * 2));
    last = { x: e.clientX, y: e.clientY };
    if (reduce) render(20000);
  });

  window.addEventListener('resize', resize);
  resize();
  if (!reduce) requestAnimationFrame(loop);
})();
