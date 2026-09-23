// Static geometry batcher.
// Hundreds of desks, chairs, plants and walls are merged into a handful of meshes
// (one per material) so a phone renders the whole office in ~15 draw calls.
// A cheap "baked AO" darkens vertices near the floor, which grounds objects
// without any real-time ambient occlusion pass.
import * as THREE from 'three';

const UNIT = {
  box: new THREE.BoxGeometry(1, 1, 1),
  plane: new THREE.PlaneGeometry(1, 1),
  sphere: new THREE.SphereGeometry(1, 10, 8),
  cone: new THREE.ConeGeometry(1, 1, 8),
};
const cylCache = new Map();
function cylGeo(top, seg) {
  const k = top + ':' + seg;
  if (!cylCache.has(k)) cylCache.set(k, new THREE.CylinderGeometry(top, 1, 1, seg));
  return cylCache.get(k);
}

const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
const vp = new THREE.Vector3(), vs = new THREE.Vector3(), v = new THREE.Vector3(), n = new THREE.Vector3();
const nm = new THREE.Matrix3(), col = new THREE.Color();

export class Batch {
  constructor({ ao = true, aoMin = 0.58, uv = false } = {}) {
    this.ao = ao; this.aoMin = aoMin; this.uv = uv;
    this.pos = []; this.nor = []; this.col = []; this.uvs = []; this.idx = [];
    this.vc = 0;
  }

  add(geo, matrix, color, uvRect = null, uvScale = null) {
    const P = geo.attributes.position, N = geo.attributes.normal, UV = geo.attributes.uv, I = geo.index;
    nm.getNormalMatrix(matrix);
    col.set(color);
    const base = this.vc;
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(matrix);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize();
      this.pos.push(v.x, v.y, v.z);
      this.nor.push(n.x, n.y, n.z);
      let f = 1;
      if (this.ao) {
        const t = Math.min(1, Math.max(0, v.y / 1.35));
        f = this.aoMin + (1 - this.aoMin) * (t * t * (3 - 2 * t));
        if (n.y < -0.5) f *= 0.8; // undersides
      }
      this.col.push(col.r * f, col.g * f, col.b * f);
      if (this.uv) {
        const u = UV ? UV.getX(i) : 0, w = UV ? UV.getY(i) : 0;
        if (uvRect) this.uvs.push(uvRect.u0 + u * (uvRect.u1 - uvRect.u0), uvRect.v0 + w * (uvRect.v1 - uvRect.v0));
        else if (uvScale) this.uvs.push(u * uvScale[0], w * uvScale[1]);
        else this.uvs.push(u, w);
      }
    }
    if (I) for (let i = 0; i < I.count; i++) this.idx.push(I.getX(i) + base);
    else for (let i = 0; i < P.count; i++) this.idx.push(base + i);
    this.vc += P.count;
  }

  _m(x, y, z, sx, sy, sz, o) {
    e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    q.setFromEuler(e);
    return m4.compose(vp.set(x, y, z), q, vs.set(sx, sy, sz));
  }
  // y is the BOTTOM of the box
  box(x, y, z, w, h, d, color, o = {}) { this.add(UNIT.box, this._m(x, y + h / 2, z, w, h, d, o), color); }
  // centered box
  cbox(x, y, z, w, h, d, color, o = {}) { this.add(UNIT.box, this._m(x, y, z, w, h, d, o), color); }
  cyl(x, y, z, r, h, color, o = {}) { this.add(cylGeo(o.top ?? 1, o.seg || 12), this._m(x, y + h / 2, z, r * (o.sx || 1), h, r * (o.sz || 1), o), color); }
  sphere(x, y, z, sx, sy, sz, color, o = {}) { this.add(UNIT.sphere, this._m(x, y, z, sx, sy, sz, o), color); }
  cone(x, y, z, r, h, color, o = {}) { this.add(UNIT.cone, this._m(x, y + h / 2, z, r, h, r, o), color); }
  quad(x, y, z, w, h, color, o = {}) { this.add(UNIT.plane, this._m(x, y, z, w, h, 1, o), color, o.uv || null, o.uvScale || null); }

  mesh(material, { shadows = false } = {}) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (this.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = shadows; m.castShadow = shadows;
    m.matrixAutoUpdate = false; m.updateMatrix();
    return m;
  }
}
