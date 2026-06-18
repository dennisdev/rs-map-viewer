import { Camera } from "./Camera";

describe("Camera.getDirection", () => {
    it("matches the camera matrix -Z basis (the view's look direction)", () => {
        const cases = [
            { pitch: 0, yaw: 1024 },
            { pitch: -245, yaw: 1862 },
            { pitch: 128, yaw: 0 },
            { pitch: -400, yaw: 2047 },
        ];
        for (const { pitch, yaw } of cases) {
            const cam = new Camera(0, 0, 0, pitch, yaw);
            cam.update(100, 100);
            const dir = Camera.getDirection(pitch, yaw);
            // Forward = -third column of the rotation in cameraMatrix.
            expect(dir[0]).toBeCloseTo(-cam.cameraMatrix[8], 5);
            expect(dir[1]).toBeCloseTo(-cam.cameraMatrix[9], 5);
            expect(dir[2]).toBeCloseTo(-cam.cameraMatrix[10], 5);
        }
    });

    it("returns a unit vector", () => {
        const dir = Camera.getDirection(-200, 1500);
        const len = Math.hypot(dir[0], dir[1], dir[2]);
        expect(len).toBeCloseTo(1, 5);
    });
});
