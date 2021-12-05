import { VerticalCheckpoint } from "./climb/ClimbProfileBuilderResult";

class GeometryProfile {
    private checkpoints: VerticalCheckpoint[];

    constructor(checkpoints: VerticalCheckpoint[]) {
        this.checkpoints = [...checkpoints].sort((a, b) => a.distanceFromStart - b.distanceFromStart)
    }

    private interpolateAltitude(distanceFromStart: number): number {
        if (distanceFromStart < this.checkpoints[0].distanceFromStart) {
            return this.checkpoints[0].altitude;
        }

        for (let i = 0; i < this.checkpoints.length - 1; i++) {
            if (distanceFromStart >= this.checkpoints[i].distanceFromStart && distanceFromStart < this.checkpoints[i + 1].distanceFromStart) {
                return this.checkpoints[i].altitude + (distanceFromStart - this.checkpoints[i].distanceFromStart) * (this.checkpoints[i + 1].altitude - this.checkpoints[i].altitude) / (this.checkpoints[i + 1].distanceFromStart - this.checkpoints[i].distanceFromStart);
            }
        }

        return this.checkpoints[this.checkpoints.length - 1].altitude;
    }
}
