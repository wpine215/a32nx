// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import fetch from 'node-fetch';

import { FlightPlan } from '@fmgc/flightplanning/new/FlightPlan';

if (!globalThis.fetch) {
    globalThis.fetch = fetch;
}

describe('a departure segment', () => {
    it('cannot have its origin airport set to AMOG', async () => {
        const segment = FlightPlan.empty().departure;

        await expect(segment.setOriginIcao('AMOG')).rejects.toThrow();
    });

    describe('without an origin airport', () => {
        it('cannot have its origin runway set', async () => {
            const segment = FlightPlan.empty().departure;

            await expect(segment.setOriginRunway('RW02')).rejects.toThrow();
        });

        it('cannot have its departure procedure set', async () => {
            const segment = FlightPlan.empty().departure;

            await expect(segment.setDepartureProcedure('ANPO3A')).rejects.toThrow();
        });

        it('cannot have its enroute transition set', async () => {
            const segment = FlightPlan.empty().departure;

            await expect(segment.setDepartureEnrouteTransition('SAVLA')).rejects.toThrow();
        });
    });

    describe('at NZQN', () => {
        it('can have its origin airport set to NZQN', async () => {
            const segment = FlightPlan.empty().departure;

            await segment.setOriginIcao('NZQN');

            expect(segment.originAirport).not.toBeNull();
        });

        it('can have its origin runway set to RW05', async () => {
            const segment = FlightPlan.empty().departure;

            await segment.setOriginIcao('NZQN');

            await expect(segment.setOriginRunway('RW05')).resolves.not.toThrow();
        });

        it('can have its departure procedure set to ANPO3A', async () => {
            const segment = FlightPlan.empty().departure;

            await segment.setOriginIcao('NZQN');
            await segment.setOriginRunway('RW05');

            await expect(segment.setDepartureProcedure('ANPO3A')).resolves.not.toThrow();

            expect(segment.runwayTransitionLegs).toHaveLength(8);
            expect(segment.commonLegs).toHaveLength(0);
        });

        it('can have its departure procedure set to ANPO3A even for RW23', async () => {
            const segment = FlightPlan.empty().departure;

            await segment.setOriginIcao('NZQN');
            await segment.setOriginRunway('RW23');

            await expect(segment.setDepartureProcedure('ANPO3A')).resolves.not.toThrow();

            expect(segment.runwayTransitionLegs).toHaveLength(0);
            expect(segment.commonLegs).toHaveLength(0);
        });

        it('can have its enroute transition set to SAVLA', async () => {
            const segment = FlightPlan.empty().departure;

            await segment.setOriginIcao('NZQN');
            await segment.setOriginRunway('RW05');
            await segment.setDepartureProcedure('ANPO3A');

            await expect(segment.setDepartureEnrouteTransition('SAVLA')).resolves.not.toThrow();

            expect(segment.runwayTransitionLegs).toHaveLength(8);
            expect(segment.commonLegs).toHaveLength(0);
            expect(segment.enrouteTransitionLegs).toHaveLength(4);
        });
    });
});
