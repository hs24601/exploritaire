import type { ActorWatercolorTemplate } from './presets';

export type WatercolorTemplateEntry = {
  id: string;
  label: string;
  baseColor: string;
  template: ActorWatercolorTemplate;
};

// ACTOR_WATERCOLOR_TEMPLATES_START
export const ACTOR_WATERCOLOR_TEMPLATES: WatercolorTemplateEntry[] = [
  {
    "id": "fox",
    "label": "Fox",
    "baseColor": "#cb9f01",
    "template": {
      "splotches": [
        {
          "gradientScale": 0.6,
          "scale": 1.4,
          "offset": [
            0,
            0
          ],
          "blendMode": "screen",
          "opacity": 0,
          "shape": "rectangle",
          "tendrils": {
            "count": 2,
            "lengthMin": 80,
            "lengthMax": 140,
            "strokeWidth": 5,
            "swayDuration": 8,
            "swayAngle": 3
          },
          "satellites": {
            "count": 2,
            "radiusMin": 10,
            "radiusMax": 18,
            "orbitRadius": 120,
            "driftDuration": 15
          },
          "animation": {
            "breatheDuration": 11,
            "breatheScale": 1.03,
            "highlightShiftDuration": 9
          },
          "baseColor": "#e2ff0a"
        },
        {
          "gradientScale": 0.4,
          "scale": 0.48,
          "offset": [
            0.12,
            -0.22
          ],
          "blendMode": "screen",
          "opacity": 1,
          "shape": "circle",
          "tendrils": {
            "count": 1,
            "lengthMin": 50,
            "lengthMax": 80,
            "strokeWidth": 4,
            "swayDuration": 8,
            "swayAngle": 3
          },
          "satellites": {
            "count": 1,
            "radiusMin": 8,
            "radiusMax": 14,
            "orbitRadius": 90,
            "driftDuration": 15
          },
          "animation": {
            "breatheDuration": 13,
            "breatheScale": 1.02,
            "highlightShiftDuration": 11
          },
          "baseColor": "#403204"
        },
        {
          "gradientScale": 0.4,
          "scale": 0.72,
          "offset": [
            0.3,
            0.3
          ],
          "blendMode": "screen",
          "opacity": 1,
          "shape": "rectangle",
          "tendrils": {
            "count": 1,
            "lengthMin": 50,
            "lengthMax": 80,
            "strokeWidth": 4,
            "swayDuration": 8,
            "swayAngle": 3
          },
          "satellites": {
            "count": 1,
            "radiusMin": 8,
            "radiusMax": 14,
            "orbitRadius": 90,
            "driftDuration": 15
          },
          "animation": {
            "breatheDuration": 13,
            "breatheScale": 1.02,
            "highlightShiftDuration": 11
          },
          "baseColor": "#b38c00"
        },
        {
          "gradientScale": 0.4,
          "scale": 1.26,
          "offset": [
            0.05,
            -0.08
          ],
          "blendMode": "screen",
          "opacity": 1,
          "shape": "rectangle",
          "tendrils": {
            "count": 1,
            "lengthMin": 50,
            "lengthMax": 80,
            "strokeWidth": 4,
            "swayDuration": 8,
            "swayAngle": 3
          },
          "satellites": {
            "count": 1,
            "radiusMin": 8,
            "radiusMax": 14,
            "orbitRadius": 90,
            "driftDuration": 15
          },
          "animation": {
            "breatheDuration": 13,
            "breatheScale": 1.02,
            "highlightShiftDuration": 11
          }
        },
        {
          "gradientScale": 0.4,
          "scale": 1.32,
          "offset": [
            0.05,
            -0.08
          ],
          "blendMode": "screen",
          "opacity": 1,
          "shape": "hollow-rect",
          "tendrils": {
            "count": 1,
            "lengthMin": 50,
            "lengthMax": 80,
            "strokeWidth": 4,
            "swayDuration": 8,
            "swayAngle": 3
          },
          "satellites": {
            "count": 1,
            "radiusMin": 8,
            "radiusMax": 14,
            "orbitRadius": 90,
            "driftDuration": 15
          },
          "animation": {
            "breatheDuration": 13,
            "breatheScale": 1.02,
            "highlightShiftDuration": 11
          },
          "baseColor": "#b6c27a",
          "innerSize": 0.72
        }
      ],
      "grain": {
        "enabled": true,
        "intensity": 0.04,
        "frequency": 0.08,
        "blendMode": "soft-light"
      },
      "overallScale": 1
    }
  }
];
// ACTOR_WATERCOLOR_TEMPLATES_END

// ORIM_WATERCOLOR_TEMPLATES_START
export const ORIM_WATERCOLOR_TEMPLATES: WatercolorTemplateEntry[] = [];
// ORIM_WATERCOLOR_TEMPLATES_END
