// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { FlightPlanDefinition } from '@fmgc/flightplanning/new/FlightPlanDefinition';
import { DepartureSegment } from '@fmgc/flightplanning/new/segments/DepartureSegment';
import { LegType, ProcedureLeg, Waypoint } from 'msfs-navdata';
import { EnrouteSegment } from '@fmgc/flightplanning/new/segments/EnrouteSegment';
import { FlightPlanSegment } from '@fmgc/flightplanning/new/segments/FlightPlanSegment';

export class FlightPlan {
    static empty(): FlightPlan {
        return new FlightPlan();
    }

    static fromDefinition(definition: FlightPlanDefinition): FlightPlan {
        const flightPlan = new FlightPlan();

        flightPlan.departure = new DepartureSegment(flightPlan);
        flightPlan.arrival = new ArrivalSegment();
        flightPlan.approach = new ApproachSegment();
        flightPlan.missedApproach = new MissedApproachSegment();

        return flightPlan;
    }

    private constructor() {
    }

    /**
     * Departure segment (origin airport or runway, SID, enroute transition)
     */
    departure = new DepartureSegment(this);

    enroute = new EnrouteSegment(this);

    /**
     * Arrival segment (enroute transition, STAR)
     */
    arrival: ArrivalSegment = new ArrivalSegment();

    /**
     * Approach segment (runway transition or approach via, approach)
     */
    approach: ApproachSegment = new ApproachSegment();

    /**
     * Missed approach segment
     */
    missedApproach: MissedApproachSegment = new MissedApproachSegment();

    get allLegs() {
        return [...this.departure.allLegs, ...this.enroute.allLegs, ...this.arrival.allLegs, ...this.approach.allLegs, ...this.missedApproach.allLegs];
    }

    insertWaypointAfter(index: number, waypoint: Waypoint) {
        if (index < 0 || index > this.allLegs.length) {
            throw new Error(`[FMS/FPM] Tried to insert waypoint out of bounds (index=${index})`);
        }

        const duplicate = this.findDuplicate(waypoint);

        if (duplicate) {
            const [startSegment, indexInStartSegment] = this.getIndexInSegment(index);
            const [endSegment, indexInEndSegment] = duplicate;

            if (startSegment === endSegment) {
                startSegment.removeRange(indexInStartSegment + 1, indexInEndSegment);
            } else {
                startSegment.removeRange(indexInStartSegment + 1, startSegment.allLegs.length - indexInStartSegment);
                endSegment.removeRange(0, indexInEndSegment);
            }
        }
    }

    private getIndexInSegment(index: number): [segment: FlightPlanSegment, index: number] {
        let maximum = this.departure.allLegs.length;

        if (index < maximum) {
            return [this.departure, index];
        }
        maximum += this.enroute.allLegs.length;

        if (index < maximum) {
            return [this.enroute, index - (maximum - this.enroute.allLegs.length)];
        }
        maximum += this.arrival.allLegs.length;

        if (index < maximum) {
            return [this.arrival, index - (maximum - this.arrival.allLegs.length)];
        }
        maximum += this.approach.allLegs.length;

        if (index < maximum) {
            return [this.approach, index - (maximum - this.approach.allLegs.length)];
        }
        maximum += this.missedApproach.allLegs.length;

        if (index < maximum) {
            return [this.missedApproach, index - (maximum - this.missedApproach.allLegs.length)];
        }

        throw new Error(`[FMS/FPM] Tried to find segment for an out of bounds index (index=${index})`);
    }

    private findDuplicate(waypoint: Waypoint): [FlightPlanSegment, number] | null {
        const departureDuplicate = this.departure.findIndexOfWaypoint(waypoint);

        if (departureDuplicate !== -1) {
            return [this.departure, departureDuplicate];
        }

        const enrouteDuplicate = this.enroute.findIndexOfWaypoint(waypoint);

        if (enrouteDuplicate !== -1) {
            return [this.enroute, enrouteDuplicate];
        }

        const approachDuplicate = this.approach.findIndexOfWaypoint(waypoint);

        if (approachDuplicate !== -1) {
            return [this.approach, approachDuplicate];
        }

        // TODO missed approach ?

        return null;
    }

    /**
     * Merges part of either the departure or arrival segment into the enroute segment.
     *
     * @param mergeTo the index until which to merge legs.
     *
     *                If this is positive, then the arrival segment is merged into the enroute segment and the index represents the waypoint until which arrival legs are
     *                merged into the enroute segment.
     *
     *                If this is negative, then the departure segment is merged into the enroute segment and the index represents the waypoint until which departure legs are
     *                merged into the enroute segment, counting from the end of the departure segment.
     *
     *                In both cases, the index is inclusive (the leg at the index ends up in the enroute segment)
     *
     * @private
     */
    private truncateSegmentIntoEnroute(mergeTo: number) {
        if (mergeTo < 0) { // Truncate departure
            const departureSegmentStartIndex = this.departure.allLegs.length + mergeTo;

            this.departure.truncate(departureSegmentStartIndex);
        }
    }

    private static isProcedureLegEquivalentToWaypoint(procedureLeg: ProcedureLeg, waypoint: Waypoint): boolean {
        if (procedureLeg.type !== LegType.AF && procedureLeg.type !== LegType.IF && procedureLeg.type !== LegType.DF && procedureLeg.type !== LegType.TF && procedureLeg.type !== LegType.RF) {
            return false;
        }

        const legFix = procedureLeg.waypoint;

        if (!legFix) {
            throw new Error(`[FMS/FPM] Comparing procedure leg of type ${procedureLeg.type} against waypoint, but procedure leg has no associated waypoint.`);
        }

        return legFix.databaseId === waypoint.databaseId;
    }
}

export class ArrivalSegment extends FlightPlanSegment {
    allLegs = []

    truncate(fromIndex: number) {
    }
}

export class ApproachSegment extends FlightPlanSegment {
    allLegs = []

    truncate(fromIndex: number) {
    }
}

export class MissedApproachSegment extends FlightPlanSegment {
    allLegs = []

    truncate(fromIndex: number) {
    }
}
