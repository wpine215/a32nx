// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { FlightPlanLeg } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';
import { Waypoint } from 'msfs-navdata';

export abstract class FlightPlanSegment {
    /**
     * All the leg contained in this segment
     */
    abstract get allLegs(): FlightPlanLeg[]

    /**
     * Removes all legs including and after `fromIndex` from the segment and merges them into the enroute segment
     *
     * @param fromIndex
     */
    abstract truncate(fromIndex: number): void

    /**
     * Removes all legs between from (inclusive) and to (exclusive)
     *
     * @param from start of the range
     * @param to   end of the range
     */
    abstract removeRange(from: number, to: number): void

    /**
     * Returns the index of a leg in the segment that terminates at the specified waypoint, or -1 if none is found
     *
     * @param waypoint the waypoint to look for
     */
    findIndexOfWaypoint(waypoint: Waypoint): number {
        for (let i = 0; i < this.allLegs.length; i++) {
            const leg = this.allLegs[i];

            if (leg.terminatesWithWaypoint(waypoint)) {
                return i;
            }
        }

        return -1;
    }
}
