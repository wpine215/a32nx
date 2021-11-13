export enum VerticalCheckpointReason {
    Liftoff,
    ThrustReductionAltitude,
    AccelerationAltitude,
    TopOfClimb,
    AtmosphericConditions,
    PresentPosition,
}

export interface VerticalCheckpoint {
    reason: VerticalCheckpointReason,
    distanceFromStart: number,
    altitude: number,
    predictedN1: number,
    remainingFuelOnBoard: number
}

export interface ClimbProfileBuilderResult {
    checkpoints: VerticalCheckpoint[],
    distanceToTopOfClimbFromEnd: number
}
