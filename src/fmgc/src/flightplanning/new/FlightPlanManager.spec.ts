// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { FlightPlanManager } from './FlightPlanManager';

describe('FlightPlanManager', () => {
    const fpm = new FlightPlanManager();

    it('can create a flight plan', () => {
        fpm.create(0);

        expect(fpm.get(0)).not.toBeNull();
    });
});
