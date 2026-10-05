
import * as THREE from 'three';

export interface LightingState {
    sunPosition: [number, number, number];
    moonPosition: [number, number, number];
    ambientIntensity: [number, number, number];
    ambientColor: [number, number, number];
    rainDelta: number;
}

export class TimeOfDaySystem {
    private hour: number = 12; 
    private speed: number = 0.1; 

    public update(deltaMs: number): LightingState {
        this.hour = (this.hour + (deltaMs / 1000) * this.speed) % 24;
        const sunAngle = ((this.hour - 6) / 24) * Math.PI * 2;
        const moonAngle = sunAngle + Math.PI;
        const radius = 50;
        const sunPos: [number, number, number] = [Math.cos(sunAngle) * radius, Math.sin(sunAngle) * radius, -radius * 0.5];
        const moonPos: [number, number, number] = [Math.cos(moonAngle) * radius, Math.sin(moonAngle) * radius, -radius * 0.5];

        let ambientIntensity: [number, number, number] = [0.2, 0.2, 0.3];
        let ambientColor: [number, number, number] = [0.5, 0.5, 0.7];

        if (this.hour > 5 && this.hour < 7) { 
            const t = (this.hour - 5) / 2;
            ambientIntensity = [0.2 + t*0.3, 0.2 + t*0.3, 0.3 + t*0.2];
            ambientColor = [0.5 + t*0.5, 0.5 + t*0.3, 0.7 - t*0.2];
        } else if (this.hour >= 7 && this.hour <= 17) { 
            ambientIntensity = [0.5, 0.5, 0.5];
            ambientColor = [1.0, 0.8, 0.8];
        } else if (this.hour > 17 && this.hour < 19) { 
            const t = (this.hour - 17) / 2;
            ambientIntensity = [0.5 - t*0.3, 0.5 - t*0.3, 0.5 - t*0.2];
            ambientColor = [1.0 - t*0.5, 0.8 - t*0.3, 0.8 - t*0.1];
        }

        return { sunPosition: sunPos, moonPosition: moonPos, ambientIntensity, ambientColor, rainDelta: 0 };
    }

    public setHour(h: number) { this.hour = h % 24; }
    public getHour() { return this.hour; }
    public setSpeed(s: number) { this.speed = s; }
}
