// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Airport, Database, Departure, ExternalBackend, ProcedureLeg, Runway } from 'msfs-navdata';
import { ProcedureTransition } from 'msfs-navdata/dist/shared/types/Common';
import { FlightPlan, FlightPlanSegment } from '@fmgc/flightplanning/new/FlightPlan';

export class DepartureSegment implements FlightPlanSegment {
    originAirport: Airport

    originRunway: Runway

    originRunwayTransition: ProcedureTransition

    originDeparture: Departure

    originEnrouteTransition: ProcedureTransition

    runwayTransitionLegs: ProcedureLeg[] = []

    commonLegs: ProcedureLeg[] = []

    enrouteTransitionLegs: ProcedureLeg[] = []

    constructor(
        private flightPlan: FlightPlan,
    ) {
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
        this.runwayTransitionLegs = runwayTransition?.legs ?? [];
        this.commonLegs = matchingProcedure.commonLegs;
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
        this.enrouteTransitionLegs = matchingEnrouteTransition.legs;
    }
}
