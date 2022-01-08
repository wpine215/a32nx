// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { FlightPlan, FlightPlanSegment } from '@fmgc/flightplanning/new/FlightPlan';
import { Airway } from 'msfs-navdata';

export class EnrouteSegment implements FlightPlanSegment {
    elements: EnrouteElement[] = []

    get allLegs() {
        return [];
    }

    constructor(
        private flightPlan: FlightPlan,
    ) {
    }
}

export interface EnrouteElement {
    airwayData: Airway,
    airwayIdent?: string,
    viaIcaoCode?: string,
}
