import { gameTime } from '../../gameTime';
import { useEffect, useRef } from 'react';
import type { CameraState } from '../../hooks/useCameraControls';
import { getVisualTableLighting, type TableLight, type LightOccluder } from '../protoLighting';
import { useGlobalLights } from '../globalLighting';
import type { TableTilt } from '../tableTilt';
import { subscribeVisualLight } from '../visualLightClock';
import { drawTableLight, tableLightNeedsAnimation, type GlobalLightCache } from './tableLightCanvas';

type Props = {
  hours:number; lights:readonly TableLight[]; occluders:readonly LightOccluder[];
  view:{width:number;height:number}; getCamera:()=>CameraState;
  getTilt:(camera:CameraState)=>TableTilt;
  onCameraFrame:(listener:(camera:CameraState)=>void)=>()=>void;
  onUnavailable:()=>void;
};

/** Project the existing ground wash into a bounded viewport texture. Letting
 * CSS rasterize a changing, perspective-stretched 3× viewport canvas made its
 * intermediate surface enormous near the camera. The same finite plane now
 * costs at most 512×320 output pixels, regardless of zoom or camera descent. */
export function GroundLightCanvas(props:Props) {
  const globalLights=useGlobalLights();
  const canvas=useRef<HTMLCanvasElement>(null),input=useRef(props);input.current=props;
  const redraw=useRef<()=>void>(()=>{});
  useEffect(()=>{
    const surface=canvas.current!;
    // Camera/CSS compositing can run faster than this throttled light pass.
    // Keep the bounded last frame valid until its replacement is drawn.
    const gl=surface.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:true});
    if(!gl){props.onUnavailable();return;}
    const compile=(type:number,source:string)=>{
      const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;}return shader;
    };
    const vertex=compile(gl.VERTEX_SHADER,'attribute vec2 position; void main(){gl_Position=vec4(position,0.,1.);}');
    const fragment=compile(gl.FRAGMENT_SHADER,`precision highp float;
      uniform sampler2D wash; uniform vec2 view, raster, plane;
      uniform vec3 tilt; uniform float aim;
      uniform vec4 liveCamera, washCamera;
      vec2 turn(vec2 p,float angle){float c=cos(angle),s=sin(angle);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);}
      void main(){
        vec2 screen=(gl_FragCoord.xy/raster-.5)*view; screen.y=-screen.y-aim;
        float denominator=tilt.x*tilt.z+screen.y*tilt.y;
        if(denominator<=0.)discard;
        float y=screen.y*tilt.z/denominator;
        vec2 p=vec2(screen.x*(tilt.z-y*tilt.y)/tilt.z,y);
        // Reproject the retained wash using this camera frame. Painting its
        // light pools stays throttled; their ground anchors do not lag behind.
        vec2 world=(turn(p,-liveCamera.w)-liveCamera.xy)/liveCamera.z;
        vec2 uv=turn(world*washCamera.z+washCamera.xy,washCamera.w)/plane+.5;
        if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))discard;
        gl_FragColor=texture2D(wash,uv);
      }`);
    if(!vertex||!fragment){if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);props.onUnavailable();return;}
    const program=gl.createProgram()!;gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);props.onUnavailable();return;}
    const buffer=gl.createBuffer()!,texture=gl.createTexture()!;
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    gl.useProgram(program);const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    // Canvas pixels arrive premultiplied, matching the browser compositor.
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    const uniforms=Object.fromEntries(['wash','view','raster','plane','tilt','aim','liveCamera','washCamera'].map(name=>[name,gl.getUniformLocation(program,name)]));
    const source=document.createElement('canvas'),ctx=source.getContext('2d')!;
    const cache:GlobalLightCache={canvas:document.createElement('canvas'),key:''};
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    let last=-Infinity,timer=0,stopped=false;
    let painted:CameraState|null=null;
    const draw=(force=false)=>{
      if(stopped||document.hidden)return;
      const now=gameTime.now(),remaining=40-(now-last);
      const repaint=force||remaining<=0||!painted;
      if(!repaint&&!timer)timer=gameTime.setTimeout(()=>{timer=0;draw();},remaining);
      const current=input.current,{width,height}=current.view,live=current.getCamera(),tilt=current.getTilt(live);
      if(!width||!height)return;
      const plane={width:width*3,height:height*3},resolution=Math.min(.25,1024/plane.width,640/plane.height);
      const sw=Math.round(plane.width*resolution),sh=Math.round(plane.height*resolution);
      if(source.width!==sw||source.height!==sh){source.width=sw;source.height=sh;}
      if(repaint){
        last=now;
        ctx.setTransform(resolution,0,0,resolution,0,0);
        drawTableLight(ctx,plane,live,getVisualTableLighting(current.hours),current.lights,motion.matches?0:now,current.occluders,cache);
        painted={...live};
      }
      const scale=Math.min(.25,512/width,320/height),w=Math.round(width*scale),h=Math.round(height*scale);
      if(surface.width!==w||surface.height!==h){surface.width=w;surface.height=h;}
      gl.viewport(0,0,w,h);gl.useProgram(program);gl.bindTexture(gl.TEXTURE_2D,texture);
      if(repaint)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
      gl.uniform1i(uniforms.wash,0);gl.uniform2f(uniforms.view,width,height);gl.uniform2f(uniforms.raster,w,h);gl.uniform2f(uniforms.plane,plane.width,plane.height);
      const angle=tilt.angle*Math.PI/180;gl.uniform3f(uniforms.tilt,Math.cos(angle),Math.sin(angle),tilt.perspective);gl.uniform1f(uniforms.aim,tilt.aimY??0);
      for(const [name,camera] of [['liveCamera',live],['washCamera',painted!]] as const)
        gl.uniform4f(uniforms[name],camera.x,camera.y,camera.scale,(camera.yaw??0)*Math.PI/180);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
    };
    const unsubscribe=props.onCameraFrame(()=>draw());
    const clock=subscribeVisualLight(()=>{const current=input.current;if(!motion.matches&&tableLightNeedsAnimation(getVisualTableLighting(current.hours),current.lights))draw();});
    redraw.current=()=>draw(true);draw(true);
    const lost=(event:Event)=>{event.preventDefault();props.onUnavailable();};surface.addEventListener('webglcontextlost',lost);
    return()=>{stopped=true;gameTime.clearTimeout(timer);redraw.current=()=>{};unsubscribe();clock();surface.removeEventListener('webglcontextlost',lost);
      gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);};
  },[props.getCamera,props.getTilt,props.onCameraFrame,props.onUnavailable]);
  useEffect(()=>{redraw.current();},[globalLights,props.hours,props.lights,props.view.width,props.view.height]);
  return <canvas ref={canvas} aria-hidden="true" data-ground-light="bounded" className="pointer-events-none absolute inset-0 z-0" style={{width:'100%',height:'100%'}}/>;
}
