// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { Location } from 'msfs-navdata';
import { Coordinates } from '@fmgc/flightplanning/data/geo';

export function fixCoordinates(location: Location): Coordinates {
    return {
        lat: location.lat,
        long: location.lon,
    };
}
