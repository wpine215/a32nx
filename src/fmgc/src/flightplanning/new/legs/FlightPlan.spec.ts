// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import fetch from 'node-fetch';

import { FlightPlan } from '@fmgc/flightplanning/new/FlightPlan';
import { loadSingleWaypoint } from '@fmgc/flightplanning/new/segments/enroute/WaypointLoading';
import { loadAirway } from '@fmgc/flightplanning/new/segments/enroute/AirwayLoading';

if (!globalThis.fetch) {
    globalThis.fetch = fetch;
}

describe('a flight plan', () => {
    it('should collapse waypoints within one segment', async () => {
        const flightPlan = FlightPlan.empty();
        const segment = flightPlan.enroute;

        const w1 = await loadSingleWaypoint('NOSUS', 'WCYCYULNOSUS');
        const w2 = await loadSingleWaypoint('NAPEE', 'WCY    NAPEE');
        const w3 = await loadSingleWaypoint('PBERG', 'WK6    PBERG');
        const w4 = await loadSingleWaypoint('HOVOB', 'WK6    HOVOB');

        segment.insertWaypoint(w1);
        segment.insertWaypoint(w2);
        segment.insertWaypoint(w3);
        segment.insertWaypoint(w4);

        expect(flightPlan.allLegs[0].ident).toEqual('NOSUS');
        expect(flightPlan.allLegs[1].ident).toEqual('NAPEE');
        expect(flightPlan.allLegs[2].ident).toEqual('PBERG');
        expect(flightPlan.allLegs[3].ident).toEqual('HOVOB');

        flightPlan.insertWaypointAfter(0, w4);

        expect(flightPlan.allLegs).toHaveLength(2);
        expect(flightPlan.allLegs[1].ident).toEqual('HOVOB');
    });

    it('should collapse waypoints across segments', async () => {
        const flightPlan = FlightPlan.empty();
        const departure = flightPlan.departure;

        await departure.setOriginIcao('NZQN');
        await departure.setOriginRunway('RW05');
        await departure.setDepartureProcedure('ANPO3A');

        await departure.setDepartureEnrouteTransition('SAVLA');

        const enroute = flightPlan.enroute;

        const airwayLegs = await loadAirway('Y569', 'ENZ    Y569', 'ENZ   PEDPO');

        enroute.insertLegs(...airwayLegs);

        console.log(flightPlan.allLegs.map((it) => it.ident).join('\n'));

        expect(flightPlan.allLegs).toHaveLength(16);
    });
});
