import { Geometry } from '@fmgc/guidance/Geometry';
import { Predictions, StepResults } from '../Predictions';
import { ClimbProfileBuilderResult, VerticalCheckpoint, VerticalCheckpointReason } from './ClimbProfileBuilderResult';
import { Common, FlapConf, VerticalWaypointType } from '../common';
import { Fmgc } from '@fmgc/guidance/GuidanceController';
import { EngineModel } from '../EngineModel';
import { TFLeg } from '@fmgc/guidance/lnav/legs/TF';
import { RFLeg } from '@fmgc/guidance/lnav/legs/RF';
import { AltitudeConstraint, AltitudeConstraintType, SpeedConstraintType } from '@fmgc/guidance/lnav/legs';
import { FlightPlanManager } from '@fmgc/flightplanning/FlightPlanManager';
import { SegmentType } from '@fmgc/wtsdk';

export class ClimbPathBuilder {
    private static TONS_TO_POUNDS = 2240;

    private airfieldElevation: number;
    private accelerationAltitude: number;
    private thrustReductionAltitude: number;
    private cruiseAltitude: number;
    private climbSpeedLimit: number;
    private climbSpeedLimitAltitude: number;
    private perfFactor: number;

    constructor(private fmgc: Fmgc, private flightPlanManager: FlightPlanManager) {
        SimVar.SetSimVarValue('L:A32NX_STATUS_PERF_FACTOR', 'Percent', 0);
    }

    update() {
        console.log(`[FMS/VNAV] Updating ClimbPathBuilder`)

        this.airfieldElevation = SimVar.GetSimVarValue('L:A32NX_DEPARTURE_ELEVATION', 'feet');
        this.accelerationAltitude = SimVar.GetSimVarValue('L:AIRLINER_ACC_ALT', 'number');
        this.thrustReductionAltitude = SimVar.GetSimVarValue('L:AIRLINER_THR_RED_ALT', 'number');
        this.cruiseAltitude = SimVar.GetSimVarValue('L:AIRLINER_CRUISE_ALTITUDE', 'number');
        this.climbSpeedLimit = 250; // TODO: Make dynamic
        this.climbSpeedLimitAltitude = 10000; // TODO: Make dynamic
        this.perfFactor = SimVar.GetSimVarValue('L:A32NX_STATUS_PERF_FACTOR', 'Percent');
    }

    computeClimbPath(geometry: Geometry): ClimbProfileBuilderResult {
        // temporary
        const isOnGround = SimVar.GetSimVarValue('SIM ON GROUND', 'Bool');

        if (!isOnGround) {
            console.log(`[FMS/VNAV] Using enroute predictions`)
            return this.computeLivePrediction(geometry);
        }

        const checkpoints: VerticalCheckpoint[] = [];

        const totalDistance = this.computeTotalFlightPlanDistance(geometry);

        this.addTakeoffRollCheckpoint(checkpoints, this.fmgc.getFOB() * ClimbPathBuilder.TONS_TO_POUNDS);
        this.addTakeoffStepCheckpoint(checkpoints, this.airfieldElevation, this.thrustReductionAltitude);
        this.addAccelerationAltitudeStep(checkpoints, this.thrustReductionAltitude, this.accelerationAltitude, this.fmgc.getV2Speed() + 10);
        this.addClimbSteps(geometry, checkpoints, this.accelerationAltitude);

        this.printAltitudePredictionsAtAltitudes(geometry, [...checkpoints].sort((a, b) => a.distanceFromStart - b.distanceFromStart));

        const distanceToTopOfClimbFromEnd = totalDistance - checkpoints[checkpoints.length - 1].distanceFromStart;
        this.printDistanceFromTocToClosestWaypoint(geometry, distanceToTopOfClimbFromEnd)

        return {
            checkpoints,
            distanceToTopOfClimbFromEnd,
        }
    }

    /**
     * Compute climb profile assuming climb thrust until top of climb. This does not care if we're below acceleration/thrust reduction altitude.
     * @param geometry
     * @returns
     */
    computeLivePrediction(geometry: Geometry): ClimbProfileBuilderResult {
        const checkpoints: VerticalCheckpoint[] = [];

        const currentAltitude = SimVar.GetSimVarValue('INDICATED ALTITUDE', 'feet');
        const totalDistance = this.computeTotalFlightPlanDistance(geometry);
        console.log(`totalDistanceFromPresentPosition: ${JSON.stringify(totalDistance)}`);

        this.addPresentPositionCheckpoint(geometry, checkpoints, currentAltitude)
        this.addClimbSteps(geometry, checkpoints, currentAltitude);

        const distanceToTopOfClimbFromEnd = totalDistance - checkpoints[checkpoints.length - 1].distanceFromStart;

        this.printAltitudePredictionsAtAltitudes(geometry, [...checkpoints].sort((a, b) => a.distanceFromStart - b.distanceFromStart));
        this.printDistanceFromTocToClosestWaypoint(geometry, distanceToTopOfClimbFromEnd)
        console.log('Current max speed: ', this.findMaxSpeedAtDistanceAlongTrack(geometry, this.computeDistanceFromOriginToPresentPosition(geometry)));

        return {
            checkpoints,
            distanceToTopOfClimbFromEnd,
        }
    }

    private addPresentPositionCheckpoint(geometry: Geometry, checkpoints: VerticalCheckpoint[], altitude: number) {
        checkpoints.push({
            reason: VerticalCheckpointReason.PresentPosition,
            distanceFromStart: this.computeDistanceFromOriginToPresentPosition(geometry),
            altitude,
            predictedN1: SimVar.GetSimVarValue('L:A32NX_AUTOTHRUST_THRUST_LIMIT', 'Percent'),
            remainingFuelOnBoard: this.fmgc.getFOB() * ClimbPathBuilder.TONS_TO_POUNDS,
            speed: SimVar.GetSimVarValue('AIRSPEED INDICATED', 'knots'),
        })
    }

    private printAltitudePredictionsAtAltitudes(geometry: Geometry, sortedCheckpoints: VerticalCheckpoint[]) {
        let totalDistance = this.computeTotalFlightPlanDistance(geometry);

        for (const [i, leg] of geometry.legs.entries()) {
            if (leg instanceof TFLeg || leg instanceof RFLeg) {
                const predictedAltitudeAtStartOfLeg = this.interpolateAltitude(totalDistance, sortedCheckpoints);

                if (this.isAltitudeConstraintMet(predictedAltitudeAtStartOfLeg, leg.altitudeConstraint)) {
                    console.log({ i, 'from': leg.from.ident, 'to': leg.to.ident, predictedAltitude: predictedAltitudeAtStartOfLeg, segment: leg.segment, constraint: leg.altitudeConstraint?.altitude1, maxSpeed: this.findMaxSpeedAtDistanceAlongTrack(geometry, totalDistance), speedConstraint: leg.speedConstraint?.speed })
                } else {
                    console.warn({ i, 'from': leg.from.ident, 'to': leg.to.ident, predictedAltitude: predictedAltitudeAtStartOfLeg, segment: leg.segment, constraint: leg.altitudeConstraint?.altitude1, maxSpeed: this.findMaxSpeedAtDistanceAlongTrack(geometry, totalDistance), speedConstraint: leg.speedConstraint?.speed })
                }
            } else {
                console.warn(`[FMS/VNAV] Invalid leg when printing flightplan`)
            }

            totalDistance -= leg.distance;
        }
    }

    private interpolateAltitude(distanceFromStart: number, sortedCheckpoints: VerticalCheckpoint[]): number {
        if (distanceFromStart < sortedCheckpoints[0].distanceFromStart) {
            return sortedCheckpoints[0].altitude;
        }

        for (let i = 0; i < sortedCheckpoints.length - 1; i++) {
            if (distanceFromStart > sortedCheckpoints[i].distanceFromStart && distanceFromStart < sortedCheckpoints[i + 1].distanceFromStart) {
                return sortedCheckpoints[i].altitude + (distanceFromStart - sortedCheckpoints[i].distanceFromStart) * (sortedCheckpoints[i + 1].altitude - sortedCheckpoints[i].altitude) / (sortedCheckpoints[i + 1].distanceFromStart - sortedCheckpoints[i].distanceFromStart);
            }
        }

        return sortedCheckpoints[sortedCheckpoints.length - 1].altitude;
    }

    private addTakeoffStepCheckpoint(checkpoints: VerticalCheckpoint[], groundAltitude: number, thrustReductionAltitude: number) {
        const midwayAltitudeSrs = (thrustReductionAltitude + groundAltitude) / 2;
        const predictedN1 = SimVar.GetSimVarValue('L:A32NX_AUTOTHRUST_THRUST_LIMIT_TOGA', 'Percent');
        const flapsSetting: FlapConf = SimVar.GetSimVarValue('L:A32NX_TO_CONFIG_FLAPS', 'Enum');
        const speed = this.fmgc.getV2Speed() + 10;
        const machSrs = this.computeMachFromCas(midwayAltitudeSrs, this.isaDeviation(), speed);
        const remainingFuelOnBoard = checkpoints[checkpoints.length - 1].remainingFuelOnBoard

        const { fuelBurned, distanceTraveled } = Predictions.altitudeStep(groundAltitude, thrustReductionAltitude - groundAltitude, speed, machSrs, predictedN1, this.fmgc.getZeroFuelWeight() * ClimbPathBuilder.TONS_TO_POUNDS, remainingFuelOnBoard, 0, this.isaDeviation(), this.fmgc.getTropoPause(), false, flapsSetting, this.perfFactor)

        checkpoints.push({
            reason: VerticalCheckpointReason.ThrustReductionAltitude,
            distanceFromStart: checkpoints[checkpoints.length - 1].distanceFromStart + distanceTraveled,
            altitude: this.thrustReductionAltitude,
            predictedN1,
            remainingFuelOnBoard: remainingFuelOnBoard - fuelBurned,
            speed
        });
    }

    private printDistanceFromTocToClosestWaypoint(geometry: Geometry, distanceToTopOfClimbFromEnd: number) {
        for (const [i, leg] of geometry.legs.entries()) {
            distanceToTopOfClimbFromEnd -= leg.distance;

            if (distanceToTopOfClimbFromEnd <= 0) {
                if (leg instanceof TFLeg || leg instanceof RFLeg) {
                    console.log(`[FMS/VNAV] Expected level off: ${-distanceToTopOfClimbFromEnd} nm after ${leg.from.ident}`)
                } else {
                    console.warn(`[FMS/VNAV] Tried computing distance to nearest waypoint, but it's not on a TF/RF leg.`)
                }

                return;
            }
        }
    }

    private irTemperatureAtAltitude(altitude: number, isaDeviation: number): number {
        return Common.getIsaTemp(altitude) + isaDeviation;
    }

    private totalAirTemperatureFromMach(altitude: number, mach: number, isaDeviation: number) {
        // From https://en.wikipedia.org/wiki/Total_air_temperature, using gamma = 1.4
        return (this.irTemperatureAtAltitude(altitude, isaDeviation) + 273.15) * (1 + 0.2 * Math.pow(mach, 2)) - 273.15
    }

    private computeMachFromCas(altitude: number, isaDev: number, speed: number): number {
        const thetaSrs = Common.getTheta(altitude, isaDev);
        const deltaSrs = Common.getDelta(thetaSrs);

        return Common.CAStoMach(speed, deltaSrs);
    }

    private addAccelerationAltitudeStep(checkpoints: VerticalCheckpoint[], startingAltitude: number, targetAltitude: number, speed: number) {
        const remainingFuelOnBoard = checkpoints[checkpoints.length - 1].remainingFuelOnBoard;
        const { predictedN1, fuelBurned, distanceTraveled } = this.computeClimbSegmentPrediction(startingAltitude, targetAltitude, speed, remainingFuelOnBoard);

        checkpoints.push({
            reason: VerticalCheckpointReason.AccelerationAltitude,
            distanceFromStart: checkpoints[checkpoints.length - 1].distanceFromStart + distanceTraveled,
            altitude: this.accelerationAltitude,
            predictedN1: predictedN1,
            remainingFuelOnBoard: remainingFuelOnBoard - fuelBurned,
            speed
        });
    }

    private addClimbSteps(geometry: Geometry, checkpoints: VerticalCheckpoint[], startingAltitude: number) {
        for (let altitude = startingAltitude; altitude < this.cruiseAltitude; altitude = Math.min(altitude + 1500, this.cruiseAltitude)) {
            const distanceAtStartOfStep = checkpoints[checkpoints.length - 1].distanceFromStart;
            const climbSpeed = Math.min(
                altitude > this.climbSpeedLimitAltitude ? this.fmgc.getManagedClimbSpeed() : this.climbSpeedLimit,
                this.findMaxSpeedAtDistanceAlongTrack(geometry, distanceAtStartOfStep)
            );

            const targetAltitude = Math.min(altitude + 1500, this.cruiseAltitude);
            const remainingFuelOnBoard = checkpoints[checkpoints.length - 1].remainingFuelOnBoard

            const { predictedN1, distanceTraveled, fuelBurned } = this.computeClimbSegmentPrediction(altitude, targetAltitude, climbSpeed, remainingFuelOnBoard);

            checkpoints.push({
                reason: targetAltitude === this.cruiseAltitude ? VerticalCheckpointReason.TopOfClimb : VerticalCheckpointReason.AtmosphericConditions,
                distanceFromStart: distanceAtStartOfStep + distanceTraveled,
                altitude: targetAltitude,
                predictedN1,
                remainingFuelOnBoard: remainingFuelOnBoard - fuelBurned,
                speed: climbSpeed
            })
        }
    }

    private computeClimbSegmentPrediction(startingAltitude: number, targetAltitude: number, climbSpeed: number, remainingFuelOnBoard: number): StepResults & { predictedN1: number } {
        const midwayAltitudeClimb = (startingAltitude + targetAltitude) / 2;
        const isaDeviation = this.isaDeviation();

        const machClimb = this.computeMachFromCas(midwayAltitudeClimb, isaDeviation, climbSpeed);
        const estimatedTat = this.totalAirTemperatureFromMach(midwayAltitudeClimb, machClimb, isaDeviation)
        const predictedN1 = this.getClimbThrustN1Limit(estimatedTat, midwayAltitudeClimb);

        return { predictedN1, ...Predictions.altitudeStep(startingAltitude, targetAltitude - startingAltitude, climbSpeed, machClimb, predictedN1, this.fmgc.getZeroFuelWeight() * ClimbPathBuilder.TONS_TO_POUNDS, remainingFuelOnBoard, 0, this.isaDeviation(), this.fmgc.getTropoPause(), false, FlapConf.CLEAN, this.perfFactor) };
    }

    private computeTotalFlightPlanDistance(geometry: Geometry): number {
        let totalDistance = 0;

        for (const [i, leg] of geometry.legs.entries()) {
            totalDistance += leg.distance
        }

        return totalDistance;
    }

    private computeTotalFlightPlanDistanceFromPresentPosition(geometry: Geometry): number {
        let totalDistance = this.flightPlanManager.getDistanceToActiveWaypoint();
        let numberOfLegsToGo = geometry.legs.size;

        for (const [i, leg] of geometry.legs.entries()) {
            // Because of how sequencing works, the first leg (last one in geometry.legs) is behind the aircraft and the second one is the one we're on. The distance of the one we're on is included through the getDistanceToActiveWaypoint() at the beginning.
            if (numberOfLegsToGo-- > 2) {
                totalDistance += leg.distance
            }
        }

        return totalDistance;
    }

    // I know this is bad performance wise, since we are iterating over the map twice
    private computeDistanceFromOriginToPresentPosition(geometry: Geometry): number {
        return this.computeTotalFlightPlanDistance(geometry) - this.computeTotalFlightPlanDistanceFromPresentPosition(geometry)
    }

    private isaDeviation(): number {
        const ambientTemperature = SimVar.GetSimVarValue('AMBIENT TEMPERATURE', 'celsius');
        const altitude = SimVar.GetSimVarValue('INDICATED ALTITUDE', 'feet');
        return ambientTemperature - Common.getIsaTemp(altitude)
    }

    private getClimbThrustN1Limit(tat: number, pressureAltitude: number) {
        return EngineModel.tableInterpolation(EngineModel.maxClimbThrustTableLeap, tat, pressureAltitude);
    }

    private addTakeoffRollCheckpoint(checkpoints: VerticalCheckpoint[], remainingFuelOnBoard: number) {
        checkpoints.push({
            reason: VerticalCheckpointReason.Liftoff,
            distanceFromStart: 0.6,
            altitude: this.airfieldElevation,
            predictedN1: SimVar.GetSimVarValue('L:A32NX_AUTOTHRUST_THRUST_LIMIT_TOGA', 'Percent'),
            remainingFuelOnBoard,
            speed: this.fmgc.getV2Speed() + 10 // I know this is not perfectly accurate
        });
    }

    private isAltitudeConstraintMet(altitude: number, constraint?: AltitudeConstraint): boolean {
        if (!constraint)
            return true;

        switch (constraint.type) {
            case AltitudeConstraintType.at:
                // TODO: Figure out actual condition when a constraint counts as "met"
                return Math.abs(altitude - constraint.altitude1) < 100
            case AltitudeConstraintType.atOrAbove:
                return altitude >= constraint.altitude1
            case AltitudeConstraintType.atOrBelow:
                return altitude <= constraint.altitude1
            case AltitudeConstraintType.range:
                return altitude >= constraint.altitude1 && altitude <= constraint.altitude2
        }
    }

    private findMaxSpeedAtDistanceAlongTrack(geometry: Geometry, distanceAlongTrack: number): number {
        let mostRestrictiveSpeedLimit: number = Infinity;
        let distanceAlongTrackForStartOfLegWaypoint = this.computeTotalFlightPlanDistance(geometry);

        for (const [i, leg] of geometry.legs.entries()) {
            distanceAlongTrackForStartOfLegWaypoint -= leg.distance;

            if (distanceAlongTrackForStartOfLegWaypoint + leg.distance < distanceAlongTrack) {
                break;
            }

            if (leg.segment !== SegmentType.Origin && leg.segment !== SegmentType.Departure) {
                continue;
            }

            if (leg.speedConstraint?.speed > 100 && (leg.speedConstraint.type === SpeedConstraintType.atOrBelow || leg.speedConstraint.type === SpeedConstraintType.at)) {
                mostRestrictiveSpeedLimit = Math.min(mostRestrictiveSpeedLimit, leg.speedConstraint.speed);
            }
        }

        return mostRestrictiveSpeedLimit;
    }
}
