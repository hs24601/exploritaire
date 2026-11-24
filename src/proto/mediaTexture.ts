import { Texture } from 'three';
import { loadMediaImage } from './mediaCache';

export async function loadMediaTexture(src: string): Promise<Texture> {
  const texture = new Texture(await loadMediaImage(src));
  texture.needsUpdate = true;
  return texture;
}
