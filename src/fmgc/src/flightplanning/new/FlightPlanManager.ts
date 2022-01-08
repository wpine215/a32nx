// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { FlightPlan } from '@fmgc/flightplanning/new/FlightPlan';
import { FlightPlanDefinition } from '@fmgc/flightplanning/new/FlightPlanDefinition';

export enum FlightPlanIndex {
    Active,
    Temporary,
    FirstSecondary,
}

export class FlightPlanManager {
    private plans: FlightPlan[] = []

    get(index: number) {
        this.assertFlightPlanExists(index);

        return this.plans[index];
    }

    create(index: number, definition?: FlightPlanDefinition) {
        this.assertFlightPlanDoesntExist(index);

        const flightPlan = definition ? FlightPlan.fromDefinition(definition) : FlightPlan.empty();

        this.plans[index] = flightPlan;
    }

    delete(index: number) {
        this.assertFlightPlanExists(index);
    }

    swap(a: number, b: number) {
        this.assertFlightPlanExists(a);
        this.assertFlightPlanExists(b);
    }

    private assertFlightPlanDoesntExist(index: number) {
        if (this.plans[index]) {
            throw new Error(`[FMS/FlightPlanManager] Tried to create existent flight plan at index #${index}`);
        }
    }

    private assertFlightPlanExists(index: number) {
        if (!this.plans[index]) {
            throw new Error(`[FMS/FlightPlanManager] Tried to access non-existent flight plan at index #${index}`);
        }
    }
}
