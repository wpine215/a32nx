// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { LegType, ProcedureLeg, Waypoint } from 'msfs-navdata';
import { FlightPlanLegDefinition } from '@fmgc/flightplanning/new/legs/FlightPlanLegDefinition';
import { procedureLegIdent } from '@fmgc/flightplanning/new/legs/FlightPlanLegNaming';

/**
 * A leg in a flight plan. Not to be confused with a geometry leg or a procedure leg
 */
export class FlightPlanLeg {
    private constructor(
        private readonly definition: FlightPlanLegDefinition,
        public readonly ident: string,
        public readonly airwayIdent?: string,
    ) {
    }

    /**
     * Determines whether this leg is a fix-terminating leg (AF, CF, DF, RF, TF)
     */
    isXf() {
        const legType = this.definition.type;

        return legType === LegType.AF || legType === LegType.CF || legType === LegType.DF || legType === LegType.RF || legType === LegType.TF;
    }

    /**
     * Determines whether the leg terminates with a specified waypoint
     *
     * @param waypoint the specified waypoint
     */
    terminatesWithWaypoint(waypoint: Waypoint) {
        if (!this.isXf()) {
            return false;
        }

        return this.definition.waypoint === waypoint;
    }

    static fromProcedureLeg(procedureLeg: ProcedureLeg): FlightPlanLeg {
        return new FlightPlanLeg(procedureLeg, procedureLegIdent(procedureLeg));
    }

    static fromEnrouteWaypoint(waypoint: Waypoint, airwayIdent?: string): FlightPlanLeg {
        return new FlightPlanLeg({
            type: LegType.TF,
            overfly: false,
            waypoint,
        }, waypoint.ident, airwayIdent);
    }
}
