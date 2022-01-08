// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Database, ExternalBackend, Waypoint } from 'msfs-navdata';
import { EnrouteElement } from '@fmgc/flightplanning/new/segments/EnrouteSegment';

export function mapAirwayEnrouteElementToWaypoints(element: EnrouteElement): Waypoint[] {
    const finalLegs: Waypoint[] = [];

    for (const leg of element.airwayData.fixes) {
        if (leg.icaoCode === element.viaIcaoCode) {
            break;
        }

        finalLegs.push(leg);
    }

    return finalLegs;
}

export async function airwayEnrouteElement(airwayIdent: string, databaseID: string, via: string): Promise<EnrouteElement> {
    const db = new Database(new ExternalBackend('http://localhost:5000'));

    const airways = await db.getAirways([airwayIdent]);

    const matchingAirway = airways.find((airway) => airway.databaseId === databaseID);

    return {
        airwayData: matchingAirway,
        airwayIdent: matchingAirway.ident,
        viaIcaoCode: via,
    };
}
