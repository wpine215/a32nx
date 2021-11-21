export enum VerticalCheckpointReason {
    Liftoff = "Liftoff",
    ThrustReductionAltitude = "ThrustReductionAltitude",
    AccelerationAltitude = "AccelerationAltitude",
    TopOfClimb = "TopOfClimb",
    AtmosphericConditions = "AtmosphericConditions",
    PresentPosition = "PresentPosition",
    LevelOffForConstraint = "LevelOffForConstraint",
    WaypointWithConstraint = "WaypointWithConstraint",
    ContinueClimb = "ContinueClimb",
}

export interface VerticalCheckpoint {
    reason: VerticalCheckpointReason,
    distanceFromStart: number,
    altitude: number,
    predictedN1: number,
    remainingFuelOnBoard: number
    speed: number
}

export interface ClimbProfileBuilderResult {
    checkpoints: VerticalCheckpoint[],
    distanceToTopOfClimbFromEnd: number
}
