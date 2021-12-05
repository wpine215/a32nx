import { Feet, Knots, NauticalMiles } from "../../../../../../typings";
import { GeometryProfile } from "../GeometryProfile";

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
    distanceFromStart: NauticalMiles,
    altitude: Feet,
    predictedN1: number,
    remainingFuelOnBoard: number,
    speed: Knots,
}

export interface ClimbProfileBuilderResult {
    checkpoints: VerticalCheckpoint[],
    geometryProfile: GeometryProfile,
    distanceToTopOfClimbFromEnd: NauticalMiles
    distanceToRestrictionLevelOffFromEnd?: NauticalMiles
    distanceToContinueClimbFromEnd?: NauticalMiles
}
