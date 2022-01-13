// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import fetch from 'node-fetch';

import { loadAirway } from '@fmgc/flightplanning/new/segments/enroute/AirwayLoading';

if (!globalThis.fetch) {
    globalThis.fetch = fetch;
}

describe('airway loading', () => {
    it('can load airway UN859 via SANBA', async () => {
        const airwayLegs = await loadAirway('UN859', 'ELF    UN859', 'SANBA');

        for (const leg of airwayLegs) {
            expect(leg.airwayIdent).toEqual('UN859');
        }

        expect(airwayLegs).toHaveLength(17);
        expect(airwayLegs[airwayLegs.length - 1].ident).toEqual('SANBA');
    });
});
