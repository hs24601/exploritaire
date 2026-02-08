import type { ActorWatercolorTemplate } from './presets';

export type ActorWatercolorOverride = {
  actorId: string; // Actor definition id
  baseColor: string;
  template: ActorWatercolorTemplate;
};

export type OrimWatercolorOverride = {
  orimId: string;
  baseColor: string;
  template: ActorWatercolorTemplate;
};

// ACTOR_WATERCOLOR_OVERRIDES_START
export const ACTOR_WATERCOLOR_OVERRIDES: ActorWatercolorOverride[] = [
  {
    "actorId": "fox",
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
  },
  {
    "actorId": "wolf",
    "baseColor": "#e5e2d7",
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
          "baseColor": "#9e936b"
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
          "baseColor": "#29261b"
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
          "baseColor": "#6c6447"
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
          "baseColor": "#b3aa89",
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
// ACTOR_WATERCOLOR_OVERRIDES_END

// ORIM_WATERCOLOR_OVERRIDES_START
export const ORIM_WATERCOLOR_OVERRIDES: OrimWatercolorOverride[] = [
  {
    "orimId": "bide",
    "baseColor": "#00b7ff",
    "template": {
      "splotches": [
        {
          "gradientScale": 0.6,
          "scale": 1.2,
          "offset": [
            0,
            0.04
          ],
          "blendMode": "screen",
          "opacity": 1,
          "shape": "circle",
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
          }
        },
        {
          "gradientScale": 0.4,
          "scale": 1.5,
          "offset": [
            0.05,
            0.02
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
          "baseColor": "#9d58b6"
        },
        {
          "gradientScale": 0.4,
          "scale": 1.5,
          "offset": [
            0.05,
            0.02
          ],
          "blendMode": "screen",
          "opacity": 0,
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
          }
        },
        {
          "gradientScale": 0.4,
          "scale": 1.5,
          "offset": [
            0.05,
            0.02
          ],
          "blendMode": "screen",
          "opacity": 0,
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
          }
        },
        {
          "gradientScale": 0.4,
          "scale": 1.5,
          "offset": [
            0.05,
            0.02
          ],
          "blendMode": "screen",
          "opacity": 0,
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
          }
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
// ORIM_WATERCOLOR_OVERRIDES_END
