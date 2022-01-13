// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { FlightPlan } from '@fmgc/flightplanning/new/FlightPlan';
import { Waypoint } from 'msfs-navdata';
import { FlightPlanLeg } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { FlightPlanSegment } from './FlightPlanSegment';

export class EnrouteSegment extends FlightPlanSegment {
    allLegs: FlightPlanLeg[] = []

    constructor(
        private flightPlan: FlightPlan,
    ) {
        super();
    }

    insertWaypoint(waypoint: Waypoint) {
        this.insertLeg(FlightPlanLeg.fromEnrouteWaypoint(waypoint));
    }

    insertLeg(leg: FlightPlanLeg) {
        this.allLegs.push(leg);
    }

    insertLegs(...elements: FlightPlanLeg[]) {
        this.allLegs.push(...elements);
    }

    truncate(fromIndex: number) {
        this.allLegs.splice(fromIndex);
    }

    removeRange(from: number, to: number) {
        this.allLegs.splice(from, to - from);
    }
}

export interface EnrouteElement {
    airwayIdent?: string,
    waypoint: Waypoint,
}
