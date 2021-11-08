import { Geometry } from '@fmgc/guidance/Geometry';
import { Predictions, StepResults } from '../Predictions';
import { ClimbProfileBuilderResult } from './ClimbProfileBuilderResult';
import { Common, FlapConf } from '../common';
import { Fmgc } from '@fmgc/guidance/GuidanceController';
import { EngineModel } from '../EngineModel';
import { TFLeg } from '@fmgc/guidance/lnav/legs/TF';
import { RFLeg } from '@fmgc/guidance/lnav/legs/RF';
import { AltitudeConstraint } from '@fmgc/guidance/lnav/legs';

interface VerticalCheckpoint {
    distanceFromEnd: number,
    altitude: number,
    predictedN1: number,
}

export class ClimbPathBuilder {
    private static TONS_TO_POUNDS = 2240;

    private airfieldElevation: number;
    private accelerationAltitude: number;
    private cruiseAltitude: number;

    constructor(private fmgc: Fmgc) { }

    update() {
        console.log(`[FMS/VNAV] Updating ClimbPathBuilder`)

        this.airfieldElevation = SimVar.GetSimVarValue('L:A32NX_DEPARTURE_ELEVATION', 'feet');
        this.accelerationAltitude = SimVar.GetSimVarValue('L:AIRLINER_ACC_ALT', 'number');
        this.cruiseAltitude = SimVar.GetSimVarValue('L:AIRLINER_CRUISE_ALTITUDE', 'number');
    }

    computeClimbPath(geometry: Geometry): ClimbProfileBuilderResult {
        const checkpoints: VerticalCheckpoint[] = [];

        const totalDistance = this.computeTotalFlightPlanDistance(geometry);

        const takeoffRollDistance = this.computeTakeOffRollDistance();
        checkpoints.push({
            distanceFromEnd: totalDistance - takeoffRollDistance,
            altitude: this.airfieldElevation,
            predictedN1: SimVar.GetSimVarValue('L:A32NX_AUTOTHRUST_THRUST_LIMIT_TOGA', 'Percent'),
        });

        const { distanceTraveled: distanceTraveledSrs } = this.computeTakeoffStepPrediction(this.airfieldElevation, this.accelerationAltitude, this.fmgc.getFOB() * ClimbPathBuilder.TONS_TO_POUNDS);
        checkpoints.push({
            distanceFromEnd: totalDistance - (takeoffRollDistance + distanceTraveledSrs),
            altitude: this.accelerationAltitude,
            predictedN1: SimVar.GetSimVarValue('L:A32NX_AUTOTHRUST_THRUST_LIMIT_TOGA', 'Percent'),
        });

        let totalDistanceForClb = 0;
        let fob = this.fmgc.getFOB() * ClimbPathBuilder.TONS_TO_POUNDS;

        for (let altitude = this.accelerationAltitude; altitude < this.cruiseAltitude; altitude = Math.min(altitude + 1000, this.cruiseAltitude)) {
            const climbSpeed = altitude > 10000 ? this.fmgc.getManagedClimbSpeed() : 250;
            const { predictedN1: commandedN1, distanceTraveled: distanceTraveledSegment, fuelBurned } = this.computeClimbSegmentPrediction(altitude, Math.min(altitude + 1000, this.cruiseAltitude), climbSpeed, fob);

            totalDistanceForClb += distanceTraveledSegment;
            fob -= fuelBurned;

            checkpoints.push({
                distanceFromEnd: totalDistance - (totalDistanceForClb + takeoffRollDistance + distanceTraveledSrs),
                altitude: Math.min(altitude + 1000, this.cruiseAltitude),
                predictedN1: commandedN1,
            })
        }

        this.printAltitudePredictionsAtAltitudes(geometry, checkpoints.sort((a, b) => b.distanceFromEnd - a.distanceFromEnd));

        const distanceToTopOfClimb = takeoffRollDistance + distanceTraveledSrs + totalDistanceForClb;
        const distanceToTopOfClimbFromEnd = totalDistance - distanceToTopOfClimb

        this.printDistanceFromTocToClosestWaypoint(geometry, distanceToTopOfClimbFromEnd)

        return {
            distanceToRotation: takeoffRollDistance,
            distanceToAccelerationAltitude: takeoffRollDistance + distanceTraveledSrs,
            distanceToTopOfClimb,
            distanceToTopOfClimbFromEnd
        }
    }

    private printAltitudePredictionsAtAltitudes(geometry: Geometry, sortedCheckpoints: VerticalCheckpoint[]): number {
        let totalDistanceFromEnd = 0;
        console.log(sortedCheckpoints);

        for (const [i, leg] of geometry.legs.entries()) {
            totalDistanceFromEnd += leg.distance;

            if (leg instanceof TFLeg || leg instanceof RFLeg) {
                const predictedAltitude = this.interpolateAltitude(totalDistanceFromEnd, sortedCheckpoints);
                console.log({ totalDistanceFromEnd, 'waypoint': leg.from.ident, predictedAltitude, constraint: leg.altitudeConstraint })
            } else {
                console.warn(`[FMS/VNAV] Invalid leg when printing flightplan`)
            }
        }

        return totalDistanceFromEnd;
    }

    private interpolateAltitude(distanceFromEnd: number, sortedCheckpoints: VerticalCheckpoint[]): number {
        if (distanceFromEnd > sortedCheckpoints[0].distanceFromEnd) {
            return sortedCheckpoints[0].altitude;
        }

        for (let i = 0; i < sortedCheckpoints.length - 1; i++) {
            if (distanceFromEnd <= sortedCheckpoints[i].distanceFromEnd && distanceFromEnd > sortedCheckpoints[i + 1].distanceFromEnd) {
                return sortedCheckpoints[i + 1].altitude - (distanceFromEnd - sortedCheckpoints[i + 1].distanceFromEnd) * (sortedCheckpoints[i + 1].altitude - sortedCheckpoints[i].altitude) / (sortedCheckpoints[i].distanceFromEnd - sortedCheckpoints[i + 1].distanceFromEnd);
            }
        }

        return sortedCheckpoints[sortedCheckpoints.length - 1].altitude;
    }

    private computeTakeoffStepPrediction(starting_altitude: number, accelerationAltitude: number, fuelWeight: number): StepResults & { predictedN1: number } {
        const midwayAltitudeSrs = (accelerationAltitude + starting_altitude) / 2;

        const predictedN1 = SimVar.GetSimVarValue('L:A32NX_AUTOTHRUST_THRUST_LIMIT_TOGA', 'Percent');

        const machSrs = this.computeMachFromCas(midwayAltitudeSrs, this.isaDeviation(), this.fmgc.getV2Speed() + 10);

        return { predictedN1, ...Predictions.altitudeStep(starting_altitude, accelerationAltitude - starting_altitude, this.fmgc.getV2Speed() + 10, machSrs, predictedN1, this.fmgc.getZeroFuelWeight() * ClimbPathBuilder.TONS_TO_POUNDS, fuelWeight, 0, this.isaDeviation(), this.fmgc.getTropoPause(), false, FlapConf.CONF_1) };
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
    private computeClimbSegmentPrediction(startingAltitude: number, targetAltitude: number, climbSpeed: number, fob: number): StepResults & { predictedN1: number } {
        const midwayAltitudeClimb = (startingAltitude + targetAltitude) / 2;
        const isaDeviation = this.isaDeviation();

        const machClimb = this.computeMachFromCas(midwayAltitudeClimb, isaDeviation, climbSpeed);
        const estimatedTat = this.totalAirTemperatureFromMach(midwayAltitudeClimb, machClimb, isaDeviation)
        const predictedN1 = this.getClimbThrustN1Limit(estimatedTat, midwayAltitudeClimb);

        return { predictedN1 , ...Predictions.altitudeStep(startingAltitude, targetAltitude - startingAltitude, climbSpeed, machClimb, predictedN1, this.fmgc.getZeroFuelWeight() * ClimbPathBuilder.TONS_TO_POUNDS, fob, 0, this.isaDeviation(), this.fmgc.getTropoPause()) };
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

    computeTakeOffRollDistance(): number {
        // TODO
        return 0.6;
    }
}
