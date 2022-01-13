// Copyright (c) 2021 FlyByWire Simulations
// Copyright (c) 2021 Synaptic Simulations
//
// SPDX-License-Identifier: GPL-3.0

import { LegType, ProcedureLeg } from 'msfs-navdata';

export function procedureLegIdent(procedureLeg: ProcedureLeg): string {
    switch (procedureLeg.type) {
    case LegType.AF:
    case LegType.CF:
    case LegType.IF:
    case LegType.DF:
    case LegType.RF:
    case LegType.TF:
        return procedureLeg.waypoint.ident;
    case LegType.CA:
        break;
    case LegType.CD:
        break;
    case LegType.CI:
        break;
    case LegType.CR:
        break;
    case LegType.FA:
        break;
    case LegType.FC:
        break;
    case LegType.FD:
        break;
    case LegType.FM:
        break;
    case LegType.HA:
        break;
    case LegType.HF:
        break;
    case LegType.HM:
        break;
    case LegType.PI:
        break;
    case LegType.VA:
        break;
    case LegType.VD:
        break;
    case LegType.VI:
        break;
    case LegType.VM:
        break;
    case LegType.VR:
        break;
    default:
        break;
    }

    return `(UNKN ${LegType[procedureLeg.type]})`;
}

export const pposPointIDent = 'PPOS';

export const turningPointIdent = 'T-P';

export const inboundPointIdent = 'IN-BND';

export const outboundPointIdent = 'OUT-BND';
