const fs=require('node:fs'),crypto=require('node:crypto'),THREE=require('three');
const source='public/assets/sources/book/castle-waterfall/original.glb',bytes=fs.readFileSync(source),length=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+length)),binary=28+length;
// Shape_258 is the sloping cascade. Shape_259 uses the same texture but is
// the entire horizontal moat; it must not be brought into the natural scene.
const mesh=gltf.meshes.find(mesh=>mesh.primitives.some(p=>gltf.materials[p.material].name==='Shape_258'));
if(!mesh)throw Error('Original waterfall Shape_258 not found');
const primitive=mesh.primitives[0],geometry=new THREE.BufferGeometry();
function attribute(id){const a=gltf.accessors[id],v=gltf.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],Type={5126:Float32Array,5123:Uint16Array,5125:Uint32Array,5121:Uint8Array}[a.componentType],out=new Type(a.count*size),stride=v.byteStride||size*Type.BYTES_PER_ELEMENT;for(let i=0;i<a.count;i++){const at=binary+(v.byteOffset||0)+(a.byteOffset||0)+i*stride;const chunk=bytes.subarray(at,at+size*Type.BYTES_PER_ELEMENT);out.set(new Type(chunk.buffer.slice(chunk.byteOffset,chunk.byteOffset+chunk.byteLength)),i*size);}return new THREE.BufferAttribute(out,size,a.normalized||false);}
for(const [key,name]of Object.entries({POSITION:'position',NORMAL:'normal',TEXCOORD_0:'uv'}))if(primitive.attributes[key]!==undefined)geometry.setAttribute(name,attribute(primitive.attributes[key]));
if(primitive.indices!==undefined)geometry.setIndex(attribute(primitive.indices));
geometry.applyMatrix4(new THREE.Matrix4().fromArray(gltf.nodes[0].matrix));geometry.computeBoundingBox();
const destination='public/assets/runtime/book/castle/original-waterfall.json';fs.writeFileSync(destination,JSON.stringify(geometry.toJSON()));
const manifest={source,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),mesh:mesh.name,material:'Shape_258',excludedMaterial:'Shape_259 (moat)',vertices:geometry.attributes.position.count,triangles:(geometry.index?.count??geometry.attributes.position.count)/3,uvPreserved:true,asset:gltf.asset,destination};fs.writeFileSync('public/assets/sources/book/castle-waterfall/manifest.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
