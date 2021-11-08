//  Copyright (c) 2021 FlyByWire Simulations
//  SPDX-License-Identifier: GPL-3.0

import { TheoreticalDescentPathCharacteristics } from '@fmgc/guidance/vnav/descent/TheoreticalDescentPath';
import { DecelPathBuilder, DecelPathCharacteristics } from '@fmgc/guidance/vnav/descent/DecelPathBuilder';
import { DescentBuilder } from '@fmgc/guidance/vnav/descent/DescentBuilder';
import { VnavConfig } from '@fmgc/guidance/vnav/VnavConfig';
import { Geometry } from '../Geometry';
import { GuidanceComponent } from '../GuidanceComponent';
import { ClimbPathBuilder } from './climb/ClimbPathBuilder';
import { ClimbProfileBuilderResult } from './climb/ClimbProfileBuilderResult';
import { Fmgc } from '../GuidanceController';

export class VnavDriver implements GuidanceComponent {
    climbPathBuilder: ClimbPathBuilder;
    currentClimbProfile: ClimbProfileBuilderResult;

    currentDescentProfile: TheoreticalDescentPathCharacteristics

    currentApproachProfile: DecelPathCharacteristics;

    constructor(fmgc: Fmgc) {
        this.climbPathBuilder = new ClimbPathBuilder(fmgc);
    }

    acceptNewMultipleLegGeometry(geometry: Geometry) {
        // Just put this here to avoid two billion updates per second in update()
        this.climbPathBuilder.update();

        this.computeVerticalProfile(geometry);
    }

    init(): void {
        console.log('[FMGC/Guidance] VnavDriver initialized!');
    }

    update(_deltaTime: number): void {
        // TODO stuff here ?
    }

    private computeVerticalProfile(geometry: Geometry) {
        if (geometry.legs.size > 0) {
            if (VnavConfig.VNAV_CALCULATE_CLIMB_PROFILE) {
                this.currentClimbProfile = this.climbPathBuilder.computeClimbPath(geometry);
                console.log(this.currentClimbProfile);
            }
            this.currentApproachProfile = DecelPathBuilder.computeDecelPath(geometry);
            this.currentDescentProfile = DescentBuilder.computeDescentPath(geometry, this.currentApproachProfile);
        } else if (DEBUG) {
            console.warn('[FMS/VNAV] Did not compute vertical profile. Reason: no legs in flight plan.');
        }
    }
}
