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

describe('an enroute segment', () => {
    it('should insert waypoint sequentially', async () => {
        const segment = FlightPlan.empty().enroute;

        const w1 = await loadSingleWaypoint('NOSUS', 'WCYCYULNOSUS');
        const w2 = await loadSingleWaypoint('NAPEE', 'WCY    NAPEE');
        const w3 = await loadSingleWaypoint('PBERG', 'WK6    PBERG');

        segment.insertWaypoint(w1);
        segment.insertWaypoint(w2);
        segment.insertWaypoint(w3);

        expect(segment.allLegs[0].ident).toEqual('NOSUS');
        expect(segment.allLegs[1].ident).toEqual('NAPEE');
        expect(segment.allLegs[2].ident).toEqual('PBERG');
    });

    it('should insert airway', async () => {
        const segment = FlightPlan.empty().enroute;

        const airwayLegs = await loadAirway('Q935', 'EK5    Q935', 'WK6    PONCT');

        expect(airwayLegs).toHaveLength(13);

        const endLeg = airwayLegs[airwayLegs.length - 1];

        expect(endLeg.ident).toEqual('PONCT');

        segment.insertLegs(...airwayLegs);

        expect(segment.allLegs).toHaveLength(13);
    });
});
