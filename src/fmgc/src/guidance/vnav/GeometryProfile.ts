import { Feet, Knots, NauticalMiles } from '../../../../../typings';
import { VerticalCheckpoint, VerticalCheckpointReason } from './climb/ClimbProfileBuilderResult';
import { Geometry } from '../Geometry';
import { TFLeg } from '../lnav/legs/TF';
import { RFLeg } from '../lnav/legs/RF';
import { AltitudeConstraint, AltitudeConstraintType, SpeedConstraint, SpeedConstraintType } from '../lnav/legs';

// TODO: Merge this with VerticalCheckpoint
interface VerticalWaypointPrediction {
    waypointIndex: number,
    distanceFromStart: NauticalMiles
    altitude: Feet,
    speed: Knots,
    altitudeConstraint: AltitudeConstraint,
    speedConstraint: SpeedConstraint,
    isAltitudeConstraintMet: boolean,
    isSpeedConstraintMet: boolean,
}

export class GeometryProfile {
    private totalFlightPlanDistance: NauticalMiles = 0;

    constructor(private geometry: Geometry, private checkpoints: VerticalCheckpoint[]) {
        this.checkpoints = [...checkpoints].sort((a, b) => a.distanceFromStart - b.distanceFromStart);

        this.totalFlightPlanDistance = this.totalDistance();
    }

    private totalDistance(): NauticalMiles {
        let totalDistance = 0;

        for (const [i, leg] of this.geometry.legs.entries()) {
            totalDistance += leg.distance;
        }

        return totalDistance;
    }

    /**
     * Find the altitude at which the profile predicts us to be at a distance along the flightplan.
     * @param distanceFromStart Distance along that path
     * @returns Predicted altitude
     */
    private interpolateAltitude(distanceFromStart: NauticalMiles): Feet {
        if (distanceFromStart < this.checkpoints[0].distanceFromStart) {
            return this.checkpoints[0].altitude;
        }

        for (let i = 0; i < this.checkpoints.length - 1; i++) {
            if (distanceFromStart >= this.checkpoints[i].distanceFromStart && distanceFromStart < this.checkpoints[i + 1].distanceFromStart) {
                return this.checkpoints[i].altitude
                    + (distanceFromStart - this.checkpoints[i].distanceFromStart) * (this.checkpoints[i + 1].altitude - this.checkpoints[i].altitude)
                    / (this.checkpoints[i + 1].distanceFromStart - this.checkpoints[i].distanceFromStart);
            }
        }

        return this.checkpoints[this.checkpoints.length - 1].altitude;
    }

    /**
     * I am not sure how well this works.
     * Find speed target to the next waypoint
     * @param distanceFromStart Distance along that path
     * @returns Predicted altitude
     */
    private findSpeedTarget(distanceFromStart: NauticalMiles): Feet {
        if (distanceFromStart < this.checkpoints[0].distanceFromStart) {
            return this.checkpoints[0].speed;
        }

        for (let i = 0; i < this.checkpoints.length - 2; i++) {
            if (distanceFromStart >= this.checkpoints[i].distanceFromStart && distanceFromStart < this.checkpoints[i + 1].distanceFromStart) {
                return this.checkpoints[i].speed;
            }
        }

        return this.checkpoints[this.checkpoints.length - 1].speed;
    }

    /**
     * Find distance to first point along path at which we cross a certain altitude.
     * @param altitude Altitude to find along the path
     * @returns Distance along path
     */
    private interpolateDistance(altitude: Feet): NauticalMiles {
        if (altitude < this.checkpoints[0].altitude) {
            return this.checkpoints[0].distanceFromStart;
        }

        for (let i = 0; i < this.checkpoints.length - 1; i++) {
            if (altitude >= this.checkpoints[i].altitude && altitude < this.checkpoints[i + 1].altitude) {
                return this.checkpoints[i].distanceFromStart
                    + (altitude - this.checkpoints[i].altitude) * (this.checkpoints[i + 1].distanceFromStart - this.checkpoints[i].distanceFromStart)
                    / (this.checkpoints[i + 1].altitude - this.checkpoints[i].altitude);
            }
        }

        return Infinity;
    }

    /**
     * This is used to display predictions in the MCDU
     */
    computePredictionsAtWaypoints(): Map<number, VerticalWaypointPrediction> {
        const predictions = new Map<number, VerticalWaypointPrediction>();
        let totalDistance = this.totalFlightPlanDistance;

        for (const [i, leg] of this.geometry.legs.entries()) {
            if (leg instanceof TFLeg || leg instanceof RFLeg) {
                const predictedAltitudeAtEndOfLeg = this.interpolateAltitude(totalDistance);
                const predictedSpeedAtEndOfLeg = this.findSpeedTarget(totalDistance);

                predictions.set(i, {
                    waypointIndex: i,
                    distanceFromStart: totalDistance,
                    altitude: predictedAltitudeAtEndOfLeg,
                    speed: predictedSpeedAtEndOfLeg,
                    altitudeConstraint: leg.altitudeConstraint,
                    isAltitudeConstraintMet: this.isAltitudeConstraintMet(predictedAltitudeAtEndOfLeg, leg.altitudeConstraint),
                    speedConstraint: leg.speedConstraint,
                    isSpeedConstraintMet: this.isSpeedConstraintMet(predictedSpeedAtEndOfLeg, leg.speedConstraint),
                });
            } else {
                console.warn('[FMS/VNAV] Invalid leg when printing flightplan');
            }

            totalDistance -= leg.distance;
        }

        return predictions;
    }

    findDistanceToTopOfClimbFromEnd(): NauticalMiles | undefined {
        return this.totalFlightPlanDistance - this.checkpoints.find((checkpoint) => checkpoint.reason === VerticalCheckpointReason.TopOfClimb)?.distanceFromStart;
    }

    findDistanceFromEndToEarliestLevelOffForRestriction(): NauticalMiles | undefined {
        return this.totalFlightPlanDistance - this.checkpoints.find((checkpoint) => checkpoint.reason === VerticalCheckpointReason.LevelOffForConstraint)?.distanceFromStart;
    }

    findDistanceFromEndToEarliestContinueClimb(): NauticalMiles | undefined {
        return this.totalFlightPlanDistance - this.checkpoints.find((checkpoint) => checkpoint.reason === VerticalCheckpointReason.ContinueClimb)?.distanceFromStart;
    }

    // TODO: Make this not iterate over map
    findDistancesFromEndToSpeedChanges(): NauticalMiles[] {
        const result: NauticalMiles[] = [];

        const predictions = this.computePredictionsAtWaypoints();

        for (const [i, prediction] of predictions) {
            if (!predictions.has(i + 1)) {
                continue;
            }

            if (predictions.get(i + 1).speed > prediction.speed) {
                result.push(this.totalFlightPlanDistance - prediction.distanceFromStart);
            }
        }

        return result;
    }

    private isAltitudeConstraintMet(altitude: Feet, constraint?: AltitudeConstraint): boolean {
        if (!constraint) {
            return true;
        }

        switch (constraint.type) {
        case AltitudeConstraintType.at:
            return Math.abs(altitude - constraint.altitude1) < 250;
        case AltitudeConstraintType.atOrAbove:
            return (altitude - constraint.altitude1) > -250;
        case AltitudeConstraintType.atOrBelow:
            return (altitude - constraint.altitude1) < 250;
        case AltitudeConstraintType.range:
            return (altitude - constraint.altitude2) > -250 && (altitude - constraint.altitude1) < 250;
        default:
            console.error('Invalid altitude constraint type');
            return null;
        }
    }

    private isSpeedConstraintMet(speed: Feet, constraint?: SpeedConstraint): boolean {
        if (!constraint) {
            return true;
        }

        switch (constraint.type) {
        case SpeedConstraintType.at:
            return Math.abs(speed - constraint.speed) < 5;
        case SpeedConstraintType.atOrBelow:
            return speed - constraint.speed < 5;
        case SpeedConstraintType.atOrAbove:
            return speed - constraint.speed > -5;
        default:
            console.error('Invalid altitude constraint type');
            return null;
        }
    }
}
