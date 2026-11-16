import {describe, it, expect, vi, beforeEach} from "vitest";
import {connectAuthEmulator} from "firebase/auth";
import {connectDatabaseEmulator} from "firebase/database";
import {connectFunctionsEmulator} from "firebase/functions";
import {connectStorageEmulator} from "firebase/storage";
import connectFirebaseEmulators from "../controllers/connectFirebaseEmulators";

vi.mock("firebase/auth", () => ({getAuth: vi.fn(() => "auth"), connectAuthEmulator: vi.fn()}));
vi.mock("firebase/database", () => ({getDatabase: vi.fn(() => "database"), connectDatabaseEmulator: vi.fn()}));
vi.mock("firebase/functions", () => ({getFunctions: vi.fn(() => "functions"), connectFunctionsEmulator: vi.fn()}));
vi.mock("firebase/storage", () => ({getStorage: vi.fn(() => "storage"), connectStorageEmulator: vi.fn()}));

const emulators = {database: {port: 9010}, functions: {port: 5011}, storage: {port: 9209}};
beforeEach(() => vi.clearAllMocks());

describe("shared browser emulator connection", () => {
    it.each(["localhost", "127.0.0.1", "[::1]"])("uses direct service ports for %s and proxies Auth", hostname => {
        const location = {hostname, port: "3002", origin: `https://${hostname}:3002`};
        connectFirebaseEmulators({app: {}}, emulators, location);
        expect(connectAuthEmulator).toHaveBeenCalledWith("auth", location.origin);
        expect(connectDatabaseEmulator).toHaveBeenCalledWith("database", hostname, 9010);
        expect(connectFunctionsEmulator).toHaveBeenCalledWith("functions", hostname, 5011);
        expect(connectStorageEmulator).toHaveBeenCalledWith("storage", hostname, 9209);
    });
    it.each([["3002", 3002], ["", 443]])("uses frontend HTTPS/WSS proxies in LAN on port %s", (port, expected) => {
        connectFirebaseEmulators({app: {}}, emulators, {hostname: "example.lan", port, origin: "https://example.lan"});
        expect(connectDatabaseEmulator).toHaveBeenCalledWith("database", "example.lan", expected);
        expect(connectFunctionsEmulator).toHaveBeenCalledWith("functions", "example.lan", expected);
        expect(connectStorageEmulator).toHaveBeenCalledWith("storage", "example.lan", expected);
    });
    it("rejects invalid configuration before changing SDK instances", () => {
        expect(() => connectFirebaseEmulators({app: {}}, {}, {hostname: "localhost", origin: "http://localhost"})).toThrow("database emulator port");
        expect(connectAuthEmulator).not.toHaveBeenCalled();
    });
});
