
export class TerrainSystem {
    private heights: Float32Array;
    private width: number;
    private depth: number;

    constructor(width: number, depth: number) {
        this.width = width;
        this.depth = depth;
        this.heights = new Float32Array(width * depth);
        this.generateProcedural();
    }

    private generateProcedural() {
        for (let z = 0; z < this.depth; z++) {
            for (let x = 0; x < this.width; x++) {
                const h = Math.sin(x * 0.5) * 0.5 + Math.cos(z * 0.5) * 0.5;
                this.heights[z * this.width + x] = h;
            }
        }
    }

    public getHeight(x: number, z: number): number {
        const gx = x + this.width / 2;
        const gz = z + this.depth / 2;
        if (gx < 0 || gx >= this.width - 1 || gz < 0 || gz >= this.depth - 1) return 0;
        const x0 = Math.floor(gx); const x1 = x0 + 1;
        const z0 = Math.floor(gz); const z1 = z0 + 1;
        const h00 = this.heights[z0 * this.width + x0];
        const h10 = this.heights[z0 * this.width + x1];
        const h01 = this.heights[z1 * this.width + x0];
        const h11 = this.heights[z1 * this.width + x1];
        const tx = gx - x0; const tz = gz - z0;
        const h0 = h00 * (1 - tx) + h10 * tx;
        const h1 = h01 * (1 - tx) + h11 * tx;
        return h0 * (1 - tz) + h1 * tz;
    }
}
