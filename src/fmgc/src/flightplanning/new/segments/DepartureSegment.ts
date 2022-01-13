// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Airport, Database, Departure, ExternalBackend, Runway } from 'msfs-navdata';
import { ProcedureTransition } from 'msfs-navdata/dist/shared/types/Common';
import { FlightPlan } from '@fmgc/flightplanning/new/FlightPlan';
import { FlightPlanLeg } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { FlightPlanSegment } from '@fmgc/flightplanning/new/segments/FlightPlanSegment';

export class DepartureSegment extends FlightPlanSegment {
    originAirport: Airport

    originRunway: Runway

    originRunwayTransition: ProcedureTransition

    originDeparture: Departure

    originEnrouteTransition: ProcedureTransition

    runwayTransitionLegs: FlightPlanLeg[] = []

    commonLegs: FlightPlanLeg[] = []

    enrouteTransitionLegs: FlightPlanLeg[] = []

    constructor(
        private flightPlan: FlightPlan,
    ) {
        super();
    }

    get allLegs() {
        return [...this.runwayTransitionLegs, ...this.commonLegs, ...this.enrouteTransitionLegs];
    }

    async setOriginIcao(icao: string) {
        const db = new Database(new ExternalBackend('http://localhost:5000'));

        const airports = await db.getAirports([icao]);
        const airport = airports.find((a) => a.ident === icao);

        if (!airport) {
            throw new Error(`[FMS/FPM] Can't find airport with ICAO '${icao}'`);
        }

        this.originAirport = airport;
        this.originRunway = undefined;
        this.originDeparture = undefined;
    }

    async setOriginRunway(runwayIdent: string) {
        const db = new Database(new ExternalBackend('http://localhost:5000'));

        if (!this.originAirport) {
            throw new Error('[FMS/FPM] Cannot set origin runway without origin airport');
        }

        const runways = await db.getRunways(this.originAirport.ident);

        const matchingRunway = runways.find((runway) => runway.ident === runwayIdent);

        if (!matchingRunway) {
            throw new Error(`[FMS/FPM] Can't find runway '${runwayIdent}' at ${this.originAirport.ident}`);
        }

        this.originRunway = matchingRunway;
    }

    async setDepartureProcedure(procedureIdent: string) {
        const db = new Database(new ExternalBackend('http://localhost:5000'));

        if (!this.originAirport || !this.originRunway) {
            throw new Error('[FMS/FPM] Cannot set departure procedure without origin airport and runway');
        }

        const proceduresAtAirport = await db.getDepartures(this.originAirport.ident);

        if (proceduresAtAirport.length === 0) {
            throw new Error(`[FMS/FPM] Cannot find procedures at ${this.originAirport.ident}`);
        }

        const matchingProcedure = proceduresAtAirport.find((proc) => proc.ident === procedureIdent);

        if (!matchingProcedure) {
            throw new Error(`[FMS/FPM] Can't find procedure '${procedureIdent}' for ${this.originAirport.ident}`);
        }

        const runwayTransition = matchingProcedure.runwayTransitions.find((transition) => transition.ident === this.originRunway.ident);

        this.originDeparture = matchingProcedure;

        // TODO stringing
        this.runwayTransitionLegs = runwayTransition?.legs?.map((leg) => FlightPlanLeg.fromProcedureLeg(leg)) ?? [];
        this.commonLegs = matchingProcedure.commonLegs.map((leg) => FlightPlanLeg.fromProcedureLeg(leg));
    }

    async setDepartureEnrouteTransition(transitionIdent: string) {
        if (!this.originAirport || !this.originRunway || !this.originDeparture) {
            throw new Error('[FMS/FPM] Cannot set departure enroute transition without origin airport, runway and departure');
        }

        const matchingEnrouteTransition = this.originDeparture.enrouteTransitions.find((transition) => transition.ident === transitionIdent);

        if (!matchingEnrouteTransition) {
            throw new Error(`[FMS/FPM] Can't find enroute trans '${transitionIdent}' for departure '${this.originDeparture.ident}' for ${this.originAirport.ident} ${this.originRunway.ident}`);
        }

        // TODO stringing
        this.enrouteTransitionLegs = matchingEnrouteTransition.legs.map((leg) => FlightPlanLeg.fromProcedureLeg(leg));
    }

    truncate(fromIndex: number) {
        // TODO runway leg

        let removed;

        if (fromIndex < this.runwayTransitionLegs.length) {
            const indexInSubsegment = fromIndex;

            removed = [
                ...this.runwayTransitionLegs.splice(indexInSubsegment),
                ...this.commonLegs,
                ...this.enrouteTransitionLegs,
            ];

            this.commonLegs.length = 0;
            this.enrouteTransitionLegs.length = 0;
        } else if (fromIndex < (this.runwayTransitionLegs.length + this.commonLegs.length)) {
            const indexInSubsegment = fromIndex - this.runwayTransitionLegs.length;

            removed = [
                ...this.commonLegs.splice(indexInSubsegment),
                ...this.enrouteTransitionLegs,
            ];

            this.enrouteTransitionLegs.length = 0;
        } else if (fromIndex < (this.runwayTransitionLegs.length + this.commonLegs.length + this.enrouteTransitionLegs.length)) {
            const indexInSubsegment = fromIndex - (this.runwayTransitionLegs.length + this.commonLegs.length);

            removed = this.enrouteTransitionLegs.splice(indexInSubsegment);
        } else {
            throw new Error('[FMS/FPM] Cannot truncate segment as fromIndex is too large.');
        }

        this.flightPlan.enroute.insertLegs(...removed);
    }
}
