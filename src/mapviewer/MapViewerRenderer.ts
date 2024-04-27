import { Schema } from "leva/dist/declarations/src/types";

import { Renderer } from "../components/renderer/Renderer";
import { clamp } from "../util/MathUtil";
import { MapManager, MapSquare } from "../renderer/MapManager";
import { MapViewer } from "./MapViewer";
import { RendererType } from "../renderer/Renderers";
import { OsrsMenuEntry } from "../components/rs/menu/OsrsMenu";
import { InteractType } from "../renderer/InteractType";
import { INTERACTION_RADIUS } from "../renderer/Interactions";
import { MenuTargetType } from "../rs/MenuEntry";
import { isTouchDevice } from "../util/DeviceUtil";
import { InputManager } from "../util/InputManager";

export abstract class MapViewerRenderer<T extends MapSquare = MapSquare> extends Renderer {
    abstract type: RendererType;

    mapManager: MapManager<T>;
    inputManager: InputManager;

    constructor(public mapViewer: MapViewer) {
        super();
        this.mapManager = new MapManager(
            mapViewer.workerPool.size * 2,
            this.queueLoadMap.bind(this),
        );
        this.inputManager = mapViewer.inputManager;
    }

    override async init() {
        this.mapViewer.inputManager.init(this.canvas);
    }

    override cleanUp(): void {
        this.mapViewer.inputManager.cleanUp();
    }

    initCache(): void {
        this.mapManager.init(this.mapViewer.cacheLoaders.mapFileIndex);
        this.mapManager.update(
            this.mapViewer.camera,
            this.stats.frameCount,
            this.mapViewer.renderDistance,
            this.mapViewer.unloadDistance,
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

        const inputManager = this.mapViewer.inputManager;
        const camera = this.mapViewer.camera;

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

        if (inputManager.isKeyDown("KeyP")) {
            camera.pos[0] = 2780;
            camera.pos[2] = 9537;
        }

        if (inputManager.isKeyDownEvent("F1")) {
            this.mapViewer.hudVisible = !this.mapViewer.hudVisible;
        }
    }

    handleMouseInput() {
        const inputManager = this.mapViewer.inputManager;
        const camera = this.mapViewer.camera;

        if (inputManager.isPointerLock()) {
            this.mapViewer.closeMenu();
        }

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

        const inputManager = this.mapViewer.inputManager;
        const camera = this.mapViewer.camera;

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

        if (this.mapViewer.camera.updated) {
            this.mapViewer.updateSearchParams();
        }

        this.mapViewer.inputManager.onFrameEnd();
        this.mapViewer.camera.onFrameEnd();
    }

    checkInteractions(interactReady: boolean, interactBuffer: Float32Array,
        closestInteractIndices: Map<number, number[]>): void {
        const frameCount = this.stats.frameCount;

        const isMouseDown = this.inputManager.dragX !== -1 || this.inputManager.dragY !== -1;
        const picked = this.inputManager.pickX !== -1 && this.inputManager.pickY !== -1;

        if (!interactReady && !picked)
            return;

        const menuCooldown = isTouchDevice ? 50 : 10;

        if (
            this.inputManager.mouseX === -1 ||
            this.inputManager.mouseY === -1 ||
            frameCount - this.mapViewer.menuOpenedFrame < menuCooldown
        ) {
            return;
        }

        // Don't auto close menu on touch devices
        if (this.mapViewer.menuOpen && !picked && !isMouseDown && isTouchDevice) {
            return;
        }

        if (!picked && !this.mapViewer.tooltips) {
            this.mapViewer.closeMenu();
            return;
        }

        const menuEntries: OsrsMenuEntry[] = [];
        const examineEntries: OsrsMenuEntry[] = [];

        const locIds = new Set<number>();
        const objIds = new Set<number>();
        const npcIds = new Set<number>();

        for (let i = 0; i < INTERACTION_RADIUS + 1; i++) {
            const indices = closestInteractIndices.get(i);
            if (!indices) {
                continue;
            }
            for (const index of indices) {
                const interactId = interactBuffer[index];
                const interactType = interactBuffer[index + 2];
                if (interactType === InteractType.LOC) {
                    const locType = this.mapViewer.cacheLoaders.locTypeLoader.load(interactId);
                    if (locType.name === "null" && !this.mapViewer.debugId) {
                        continue;
                    }
                    if (locIds.has(interactId)) {
                        continue;
                    }
                    locIds.add(interactId);

                    for (const option of locType.actions) {
                        if (!option) {
                            continue;
                        }
                        menuEntries.push({
                            option,
                            targetId: locType.id,
                            targetType: MenuTargetType.LOC,
                            targetName: locType.name,
                            targetLevel: -1,
                            onClick: this.mapViewer.closeMenu,
                        });
                    }

                    examineEntries.push({
                        option: "Examine",
                        targetId: locType.id,
                        targetType: MenuTargetType.LOC,
                        targetName: locType.name,
                        targetLevel: -1,
                        onClick: this.mapViewer.onExamine,
                    });
                } else if (interactType === InteractType.OBJ) {
                    const objType = this.mapViewer.cacheLoaders.objTypeLoader.load(interactId);
                    if (objType.name === "null" && !this.mapViewer.debugId) {
                        continue;
                    }
                    if (objIds.has(interactId)) {
                        continue;
                    }
                    objIds.add(interactId);

                    for (const option of objType.groundActions) {
                        if (!option) {
                            continue;
                        }
                        menuEntries.push({
                            option,
                            targetId: objType.id,
                            targetType: MenuTargetType.OBJ,
                            targetName: objType.name,
                            targetLevel: -1,
                            onClick: this.mapViewer.closeMenu,
                        });
                    }

                    examineEntries.push({
                        option: "Examine",
                        targetId: objType.id,
                        targetType: MenuTargetType.OBJ,
                        targetName: objType.name,
                        targetLevel: -1,
                        onClick: this.mapViewer.onExamine,
                    });
                } else if (interactType === InteractType.NPC) {
                    let npcType = this.mapViewer.cacheLoaders.npcTypeLoader.load(interactId);
                    if (npcType.transforms) {
                        const transformed = npcType.transform(
                            this.mapViewer.cacheLoaders.varManager,
                            this.mapViewer.cacheLoaders.npcTypeLoader,
                        );
                        if (!transformed) {
                            continue;
                        }
                        npcType = transformed;
                    }
                    if (npcType.name === "null" && !this.mapViewer.debugId) {
                        continue;
                    }
                    if (npcIds.has(interactId)) {
                        continue;
                    }
                    npcIds.add(interactId);

                    for (const option of npcType.actions) {
                        if (!option) {
                            continue;
                        }
                        menuEntries.push({
                            option,
                            targetId: npcType.id,
                            targetType: MenuTargetType.NPC,
                            targetName: npcType.name,
                            targetLevel: npcType.combatLevel,
                            onClick: this.mapViewer.closeMenu,
                        });
                    }

                    examineEntries.push({
                        option: "Examine",
                        targetId: npcType.id,
                        targetType: MenuTargetType.NPC,
                        targetName: npcType.name,
                        targetLevel: npcType.combatLevel,
                        onClick: this.mapViewer.onExamine,
                    });
                }
            }
        }

        menuEntries.push({
            option: "Walk here",
            targetId: -1,
            targetType: MenuTargetType.NONE,
            targetName: "",
            targetLevel: -1,
            onClick: this.mapViewer.closeMenu,
        });
        menuEntries.push(...examineEntries);
        menuEntries.push({
            option: "Cancel",
            targetId: -1,
            targetType: MenuTargetType.NONE,
            targetName: "",
            targetLevel: -1,
            onClick: this.mapViewer.closeMenu,
        });

        this.mapViewer.menuOpen = picked;
        if (picked) {
            this.mapViewer.menuOpenedFrame = frameCount;
        }
        this.mapViewer.menuX = this.inputManager.mouseX;
        this.mapViewer.menuY = this.inputManager.mouseY;
        this.mapViewer.menuEntries = menuEntries;
    }
}
