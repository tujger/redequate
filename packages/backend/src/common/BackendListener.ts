import type BackendBase from "./BackendBase";
import type {DatabasePath} from "../../../database/src/common/DatabaseTypes";

export interface BackendListenerValueEvent {
    value: unknown;
    params: Record<string, string>;
}

export interface BackendListenerUpdateEvent extends BackendListenerValueEvent {
    previous: unknown;
}

export default abstract class BackendListener {
    protected constructor(readonly path: DatabasePath, protected readonly backend: BackendBase) {}

    declare onCreate?: (event: BackendListenerValueEvent) => unknown;
    declare onUpdate?: (event: BackendListenerUpdateEvent) => unknown;
    declare onDelete?: (event: BackendListenerValueEvent) => unknown;
}
