import type { Card } from '../engine/types';
import type { WatercolorConfig } from './types';

export type WatercolorSandboxTarget = {
  id: string;
  label: string;
  card: Card;
  watercolorConfig: WatercolorConfig;
};

// WATERCOLOR_SANDBOX_TARGETS_START
export const WATERCOLOR_SANDBOX_TARGETS: WatercolorSandboxTarget[] = [
  {
    id: "sandbox-card",
    label: "Sandbox Card",
    card: {
        "id": "preview-card",
        "rank": 7,
        "suit": "💨",
        "element": "W",
        "sourceActorId": "preview"
      },
    baseColor: "#2196f3",
    template: {
        "splotches": [
          {
            "gradientScale": 0.6,
            "scale": 0.7,
            "offset": [
              0,
              0
            ],
            "blendMode": "screen",
            "opacity": 0.4,
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
            }
          },
          {
            "gradientScale": 0.4,
            "scale": 0.45,
            "offset": [
              0.05,
              -0.08
            ],
            "blendMode": "screen",
            "opacity": 0.3,
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
      },
    watercolorConfig: {
        "splotches": [
          {
            "gradientScale": 0.6,
            "scale": 0.7,
            "offset": [
              0,
              0
            ],
            "blendMode": "screen",
            "opacity": 0.4,
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
            "gradient": {
              "light": "#9bd0fa",
              "mid": "#2196f3",
              "dark": "#0f446d",
              "lightOpacity": 0.54,
              "midOpacity": 0.48,
              "darkOpacity": 0.42
            }
          },
          {
            "gradientScale": 0.4,
            "scale": 0.45,
            "offset": [
              0.05,
              -0.08
            ],
            "blendMode": "screen",
            "opacity": 0.3,
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
            "gradient": {
              "light": "#9bd0fa",
              "mid": "#2196f3",
              "dark": "#0f446d",
              "lightOpacity": 0.36000000000000004,
              "midOpacity": 0.32000000000000006,
              "darkOpacity": 0.27999999999999997
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
      },
  },
];
// WATERCOLOR_SANDBOX_TARGETS_END
