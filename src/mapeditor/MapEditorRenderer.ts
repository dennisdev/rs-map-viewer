import { Schema } from "leva/dist/declarations/src/types";

import { Renderer } from "../components/renderer/Renderer";
import { MapManager, MapSquare } from "../renderer/MapManager";
import { clamp } from "../util/MathUtil";
import { MapEditor } from "./MapEditor";

export abstract class MapEditorRenderer<T extends MapSquare = MapSquare> extends Renderer {
    mapManager: MapManager<T>;

    constructor(public mapEditor: MapEditor) {
        super();
        this.mapManager = new MapManager(
            mapEditor.workerPool.size * 2,
            this.queueLoadMap.bind(this),
        );
    }

    override async init() {
        this.mapEditor.inputManager.init(this.canvas);
    }

    override cleanUp(): void {
        this.mapEditor.inputManager.cleanUp();
    }

    initCache(): void {
        this.mapManager.init(this.mapEditor.mapFileIndex);
        this.mapManager.update(
            this.mapEditor.camera,
            this.stats.frameCount,
            this.mapEditor.renderDistance,
            this.mapEditor.unloadDistance,
        );
    }

    getControls(): Schema {
        return {};
    }

    queueLoadMap(mapX: number, mapY: number): void {}

    handleInput(deltaTime: number) {
        this.handleKeyInput(deltaTime);
        this.handleMouseInput();
        this.handleJoystickInput(deltaTime);
    }

    handleKeyInput(deltaTime: number) {
        const deltaTimeSec = deltaTime / 1000;

        const inputManager = this.mapEditor.inputManager;
        const camera = this.mapEditor.camera;

        let cameraSpeedMult = 1.0;
        if (inputManager.isShiftDown()) {
            cameraSpeedMult = 10.0;
        }

        const deltaPitch = 64 * 5 * deltaTimeSec;
        const deltaYaw = 64 * 5 * deltaTimeSec;

        // camera direction controls
        if (inputManager.isKeyDown("ArrowUp")) {
            camera.updatePitch(camera.pitch, deltaPitch);
        }
        if (inputManager.isKeyDown("ArrowDown")) {
            camera.updatePitch(camera.pitch, -deltaPitch);
        }
        if (inputManager.isKeyDown("ArrowRight")) {
            camera.updateYaw(camera.yaw, deltaYaw);
        }
        if (inputManager.isKeyDown("ArrowLeft")) {
            camera.updateYaw(camera.yaw, -deltaYaw);
        }

        // camera position controls
        let deltaX = 0;
        let deltaY = 0;
        let deltaZ = 0;

        const deltaPos = 16 * cameraSpeedMult * deltaTimeSec;
        const deltaHeight = 8 * cameraSpeedMult * deltaTimeSec;

        if (inputManager.isKeyDown("KeyW")) {
            // Forward
            deltaZ -= deltaPos;
        }
        if (inputManager.isKeyDown("KeyA")) {
            // Left
            deltaX += deltaPos;
        }
        if (inputManager.isKeyDown("KeyS")) {
            // Back
            deltaZ += deltaPos;
        }
        if (inputManager.isKeyDown("KeyD")) {
            // Right
            deltaX -= deltaPos;
        }
        if (inputManager.isKeyDown("KeyE") || inputManager.isKeyDown("KeyR")) {
            // Move up
            deltaY -= deltaHeight;
        }
        if (
            inputManager.isKeyDown("KeyQ") ||
            inputManager.isKeyDown("KeyC") ||
            inputManager.isKeyDown("KeyF")
        ) {
            // Move down
            deltaY += deltaHeight;
        }

        if (deltaX !== 0 || deltaZ !== 0) {
            camera.move(deltaX, 0, deltaZ);
        }
        if (deltaY !== 0) {
            camera.move(0, deltaY, 0);
        }
    }

    handleMouseInput() {
        const inputManager = this.mapEditor.inputManager;
        const camera = this.mapEditor.camera;

        // mouse/touch controls
        const deltaMouseX = inputManager.getDeltaMouseX();
        const deltaMouseY = inputManager.getDeltaMouseY();

        if (deltaMouseX !== 0 || deltaMouseY !== 0) {
            if (inputManager.isTouch) {
                camera.move(0, clamp(-deltaMouseY, -100, 100) * 0.004, 0);
            } else {
                camera.updatePitch(camera.pitch, deltaMouseY * 0.9);
                camera.updateYaw(camera.yaw, deltaMouseX * -0.9);
            }
        }
    }

    handleJoystickInput(deltaTime: number) {
        const deltaTimeSec = deltaTime / 1000;

        const inputManager = this.mapEditor.inputManager;
        const camera = this.mapEditor.camera;

        const deltaPitch = 64 * 5 * deltaTimeSec;
        const deltaYaw = 64 * 5 * deltaTimeSec;

        // joystick controls
        const positionJoystickEvent = inputManager.positionJoystickEvent;
        const cameraJoystickEvent = inputManager.cameraJoystickEvent;

        if (positionJoystickEvent) {
            const moveX = positionJoystickEvent.x ?? 0;
            const moveY = positionJoystickEvent.y ?? 0;

            camera.move(moveX * 32 * -deltaTimeSec, 0, moveY * 32 * -deltaTimeSec);
        }

        if (cameraJoystickEvent) {
            const moveX = cameraJoystickEvent.x ?? 0;
            const moveY = cameraJoystickEvent.y ?? 0;
            camera.updatePitch(camera.pitch, deltaPitch * 1.5 * moveY);
            camera.updateYaw(camera.yaw, deltaYaw * 1.5 * moveX);
        }
    }

    override onFrameEnd(): void {
        super.onFrameEnd();

        if (window.wallpaperFpsLimit !== undefined) {
            this.fpsLimit = window.wallpaperFpsLimit;
        }

        if (this.mapEditor.camera.updated) {
            this.mapEditor.updateSearchParams();
        }

        this.mapEditor.inputManager.onFrameEnd();
        this.mapEditor.camera.onFrameEnd();
    }
}
