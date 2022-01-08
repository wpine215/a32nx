// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { FlightPlanDefinition } from '@fmgc/flightplanning/new/FlightPlanDefinition';
import { DepartureSegment } from '@fmgc/flightplanning/new/segments/DepartureSegment';
import { ProcedureLeg } from 'msfs-navdata';

export class FlightPlan {
    static empty(): FlightPlan {
        return new FlightPlan();
    }

    static fromDefinition(definition: FlightPlanDefinition): FlightPlan {
        const flightPlan = new FlightPlan();

        flightPlan.departure = new DepartureSegment();
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

    /**
     * Arrival segment (enroute transition, STAR)
     */
    arrival: ArrivalSegment

    /**
     * Approach segment (runway transition or approach via, approach)
     */
    approach: ApproachSegment

    /**
     * Missed approach segment
     */
    missedApproach: MissedApproachSegment
}

export interface FlightPlanSegment {

    /**
     * All the leg contained in this segment
     */
    allLegs: ProcedureLeg[],

}

export class ArrivalSegment implements FlightPlanSegment {
    allLegs = []
}

export class ApproachSegment implements FlightPlanSegment {
    allLegs = []
}

export class MissedApproachSegment implements FlightPlanSegment {
    allLegs = []
}
