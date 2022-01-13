// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Database, ExternalBackend, Waypoint } from 'msfs-navdata';
import { FlightPlanLeg } from '@fmgc/flightplanning/new/legs/FlightPlanLeg';

export async function loadAirway(airwayIdent: string, databaseId: string, viaDatabaseId: string): Promise<FlightPlanLeg[]> {
    const db = new Database(new ExternalBackend('http://localhost:5000'));

    const airways = await db.getAirways([airwayIdent]);

    const matchingAirway = airways.find((airway) => airway.databaseId === databaseId);

    if (!matchingAirway) {
        throw new Error(`[FMS/FPM] Can't find airway with database ID '${databaseId}'`);
    }

    const finalLegs: Waypoint[] = [];

    for (const leg of matchingAirway.fixes) {
        finalLegs.push(leg);

        if (leg.databaseId === viaDatabaseId) {
            break;
        }
    }

    return finalLegs.map((waypoint) => FlightPlanLeg.fromEnrouteWaypoint(waypoint, airwayIdent));
}
