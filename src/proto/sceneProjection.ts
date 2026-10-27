/** Screen-space boxes for live map actors, projected from their world data
 * and the live camera. Overlays (callouts, anchors) read these instead of
 * measuring the DOM, which forced a full layout on every camera frame. */
export type ScreenBox = { left: number; top: number; right: number; bottom: number; width: number; height: number };
export type SceneActorBox = { id: string; box: ScreenBox };
export type SceneProjector = {
  /** Client-space viewport of the projected scene. */
  viewport: () => ScreenBox;
  /** Visible, unclipped actors in client coordinates. */
  actors: () => SceneActorBox[];
};

let current: SceneProjector | null = null;

export const registerSceneProjector = (projector: SceneProjector) => {
  current = projector;
  return () => { if (current === projector) current = null; };
};

/** Null when no live map projects its actors; callers fall back to the DOM. */
export const sceneActorBoxes = () => current?.actors() ?? null;
export const sceneViewport = () => current?.viewport() ?? null;

/** Top-center of an actor's projected art, when it is inside the scene viewport. */
export const sceneActorAnchor = (id: string): { x: number; y: number } | null | undefined => {
  if (!current) return undefined;
  const actor = current.actors().find(entry => entry.id === id), view = current.viewport();
  // Unprojected (hidden, clipped or unknown) actors defer to the DOM.
  if (!actor) return undefined;
  const x = (actor.box.left + actor.box.right) / 2, y = actor.box.top;
  return x >= view.left && x <= view.right && y >= view.top && y <= view.bottom ? { x, y } : null;
};
