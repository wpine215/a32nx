// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import fetch from 'node-fetch';

import {
    airwayEnrouteElement,
    mapAirwayEnrouteElementToWaypoints,
} from '@fmgc/flightplanning/new/segments/enroute/AirwayLoading';

if (!globalThis.fetch) {
    globalThis.fetch = fetch;
}

describe('airway loading', () => {
    it('can load airway UN859 via SANBA', async () => {
        const element = await airwayEnrouteElement('UN859', 'ELF    UN859', 'SANBA');

        expect(element.airwayData.databaseId).toEqual('ELF    UN859');
        expect(element.airwayData.fixes).toHaveLength(17);
        expect(element.airwayIdent).toEqual('UN859');
        expect(element.viaIcaoCode).toEqual('SANBA');
    });

    it('can map that airway to waypoints until the via', async () => {
        const element = await airwayEnrouteElement('UN859', 'ELF    UN859', 'SANBA');
        const waypoints = mapAirwayEnrouteElementToWaypoints(element);

        expect(waypoints).toHaveLength(17);
        expect(waypoints[waypoints.length - 1]).toEqual(expect.objectContaining({ ident: 'SANBA' }));
    });
});
