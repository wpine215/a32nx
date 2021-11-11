import { Geometry } from '@fmgc/guidance/Geometry';
import { Predictions, StepResults } from '../Predictions';
import { ClimbProfileBuilderResult, VerticalCheckpoint, VerticalCheckpointReason } from './ClimbProfileBuilderResult';
import { Common, FlapConf } from '../common';
import { Fmgc } from '@fmgc/guidance/GuidanceController';
import { EngineModel } from '../EngineModel';
import { TFLeg } from '@fmgc/guidance/lnav/legs/TF';
import { RFLeg } from '@fmgc/guidance/lnav/legs/RF';
import { AltitudeConstraint } from '@fmgc/guidance/lnav/legs';

export class ClimbPathBuilder {
    private static TONS_TO_POUNDS = 2240;

    private airfieldElevation: number;
    private accelerationAltitude: number;
    private thrustReductionAltitude: number;
    private cruiseAltitude: number;
    private climbSpeedLimit: number;
    private climbSpeedLimitAltitude: number;

    constructor(private fmgc: Fmgc) { }

    update() {
        console.log(`[FMS/VNAV] Updating ClimbPathBuilder`)

        this.airfieldElevation = SimVar.GetSimVarValue('L:A32NX_DEPARTURE_ELEVATION', 'feet');
        this.accelerationAltitude = SimVar.GetSimVarValue('L:AIRLINER_ACC_ALT', 'number');
        this.thrustReductionAltitude = SimVar.GetSimVarValue('L:AIRLINER_THR_RED_ALT', 'number');
        this.cruiseAltitude = SimVar.GetSimVarValue('L:AIRLINER_CRUISE_ALTITUDE', 'number');
        this.climbSpeedLimit = 250; // TODO: Make dynamic
        this.climbSpeedLimitAltitude = 10000; // TODO: Make dynamic
    }

    computeClimbPath(geometry: Geometry): ClimbProfileBuilderResult {
        const checkpoints: VerticalCheckpoint[] = [];

        const totalDistance = this.computeTotalFlightPlanDistance(geometry);

        this.addTakeoffRollCheckpoint(checkpoints, this.fmgc.getFOB() * ClimbPathBuilder.TONS_TO_POUNDS);
        this.addTakeoffStepCheckpoint(checkpoints, this.airfieldElevation, this.thrustReductionAltitude);
        this.addAccelerationAltitudeStep(checkpoints, this.thrustReductionAltitude, this.accelerationAltitude, this.fmgc.getV2Speed() + 10);
        this.addClimbSteps(checkpoints);

        this.printAltitudePredictionsAtAltitudes(geometry, [...checkpoints].sort((a, b) => a.distanceFromStart - b.distanceFromStart));

        const distanceToTopOfClimbFromEnd = totalDistance - checkpoints[checkpoints.length - 1].distanceFromStart;
        this.printDistanceFromTocToClosestWaypoint(geometry, distanceToTopOfClimbFromEnd)

        return {
            checkpoints,
            distanceToTopOfClimbFromEnd,
        }
    }

    private printAltitudePredictionsAtAltitudes(geometry: Geometry, sortedCheckpoints: VerticalCheckpoint[]) {
        let totalDistance = this.computeTotalFlightPlanDistance(geometry);

        for (const [i, leg] of geometry.legs.entries()) {
            totalDistance -= leg.distance;

            if (leg instanceof TFLeg || leg instanceof RFLeg) {
                const predictedAltitude = this.interpolateAltitude(totalDistance, sortedCheckpoints);
                console.log({ totalDistance, 'waypoint': leg.from.ident, predictedAltitude, constraint: leg.altitudeConstraint })
            } else {
                console.warn(`[FMS/VNAV] Invalid leg when printing flightplan`)
            }
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
        const machSrs = this.computeMachFromCas(midwayAltitudeSrs, this.isaDeviation(), this.fmgc.getV2Speed() + 10);
        const remainingFuelOnBoard = checkpoints[checkpoints.length - 1].remainingFuelOnBoard

        const { fuelBurned, distanceTraveled } = Predictions.altitudeStep(groundAltitude, thrustReductionAltitude - groundAltitude, this.fmgc.getV2Speed() + 10, machSrs, predictedN1, this.fmgc.getZeroFuelWeight() * ClimbPathBuilder.TONS_TO_POUNDS, remainingFuelOnBoard, 0, this.isaDeviation(), this.fmgc.getTropoPause(), false, FlapConf.CONF_1)

        checkpoints.push({
            reason: VerticalCheckpointReason.ThrustReductionAltitude,
            distanceFromStart: checkpoints[checkpoints.length - 1].distanceFromStart + distanceTraveled,
            altitude: this.thrustReductionAltitude,
            predictedN1,
            remainingFuelOnBoard: remainingFuelOnBoard - fuelBurned,
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

    private addAccelerationAltitudeStep(checkpoints: VerticalCheckpoint[], startingAltitude: number, targetAltitude: number, climbSpeed: number) {
        const remainingFuelOnBoard = checkpoints[checkpoints.length - 1].remainingFuelOnBoard;
        const { predictedN1, fuelBurned, distanceTraveled } = this.computeClimbSegmentPrediction(startingAltitude, targetAltitude, climbSpeed, remainingFuelOnBoard);

        checkpoints.push({
            reason: VerticalCheckpointReason.AccelerationAltitude,
            distanceFromStart: checkpoints[checkpoints.length - 1].distanceFromStart + distanceTraveled,
            altitude: this.accelerationAltitude,
            predictedN1: predictedN1,
            remainingFuelOnBoard: remainingFuelOnBoard - fuelBurned,
        });
    }

    private addClimbSteps(checkpoints: VerticalCheckpoint[]) {
        for (let altitude = this.accelerationAltitude; altitude < this.cruiseAltitude; altitude = Math.min(altitude + 1000, this.cruiseAltitude)) {
            const climbSpeed = altitude > this.climbSpeedLimitAltitude ? this.fmgc.getManagedClimbSpeed() : this.climbSpeedLimit;
            const targetAltitude = Math.min(altitude + 1000, this.cruiseAltitude);
            const remainingFuelOnBoard = checkpoints[checkpoints.length - 1].remainingFuelOnBoard

            const { predictedN1, distanceTraveled, fuelBurned } = this.computeClimbSegmentPrediction(altitude, targetAltitude, climbSpeed, remainingFuelOnBoard);

            checkpoints.push({
                reason: targetAltitude === this.cruiseAltitude ? VerticalCheckpointReason.TopOfClimb : VerticalCheckpointReason.AtmosphericConditions,
                distanceFromStart: checkpoints[checkpoints.length - 1].distanceFromStart + distanceTraveled,
                altitude: targetAltitude,
                predictedN1,
                remainingFuelOnBoard: remainingFuelOnBoard - fuelBurned
            })
        }
    }

    private computeClimbSegmentPrediction(startingAltitude: number, targetAltitude: number, climbSpeed: number, remainingFuelOnBoard: number): StepResults & { predictedN1: number } {
        const midwayAltitudeClimb = (startingAltitude + targetAltitude) / 2;
        const isaDeviation = this.isaDeviation();

        const machClimb = this.computeMachFromCas(midwayAltitudeClimb, isaDeviation, climbSpeed);
        const estimatedTat = this.totalAirTemperatureFromMach(midwayAltitudeClimb, machClimb, isaDeviation)
        const predictedN1 = this.getClimbThrustN1Limit(estimatedTat, midwayAltitudeClimb);

        return { predictedN1, ...Predictions.altitudeStep(startingAltitude, targetAltitude - startingAltitude, climbSpeed, machClimb, predictedN1, this.fmgc.getZeroFuelWeight() * ClimbPathBuilder.TONS_TO_POUNDS, remainingFuelOnBoard, 0, this.isaDeviation(), this.fmgc.getTropoPause()) };
    }

    private computeTotalFlightPlanDistance(geometry: Geometry): number {
        let totalDistance = 0;

        for (const [i, leg] of geometry.legs.entries()) {
            totalDistance += leg.distance
        }

        return totalDistance;
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
        });
    }
}
