import { vec2 } from "gl-matrix";
import { IJoystickUpdateEvent } from "react-joystick-component/build/lib/Joystick";

export function getMousePos(
    container: HTMLElement,
    event: MouseEvent | Touch
): vec2 {
    const rect = container.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
}

export function getAxisDeadzone(axis: number, zone: number): number {
    if (Math.abs(axis) < zone) {
        return 0;
    } else if (axis < 0) {
        return axis + zone;
    } else {
        return axis - zone;
    }
}

export class InputManager {
    element!: HTMLElement;

    keys: Map<string, boolean> = new Map();

    mouseX: number = -1;
    mouseY: number = -1;

    lastMouseX: number = -1;
    lastMouseY: number = -1;

    dragX: number = -1;
    dragY: number = -1;

    deltaMouseX: number = 0;
    deltaMouseY: number = 0;

    isTouch: boolean = false;

    pickX: number = -1;
    pickY: number = -1;

    positionJoystickEvent?: IJoystickUpdateEvent;
    cameraJoystickEvent?: IJoystickUpdateEvent;

    gamepadIndex?: number;

    constructor() {
        window.addEventListener("gamepadconnected", this.onGamepadConnected);
        window.addEventListener(
            "gamepaddisconnected",
            this.onGamepadDisconnected
        );
    }

    init(element: HTMLElement) {
        this.element = element;

        element.addEventListener("dblclick", this.onDoubleClick);

        element.addEventListener("keydown", this.onKeyDown);
        element.addEventListener("keyup", this.onKeyUp);

        element.addEventListener("mousedown", this.onMouseDown);
        element.addEventListener("mousemove", this.onMouseMove);
        element.addEventListener("mouseup", this.onMouseUp);
        element.addEventListener("mouseleave", this.onMouseLeave);

        element.addEventListener("touchstart", this.onTouchStart);
        element.addEventListener("touchmove", this.onTouchMove);
        element.addEventListener("touchend", this.onTouchEnd);

        element.addEventListener("contextmenu", this.onContextMenu);

        element.addEventListener("focusout", this.onFocusOut);
    }

    isShiftDown(): boolean {
        return this.isKeyDown("ShiftLeft") || this.isKeyDown("ShiftRight");
    }

    isKeyDown(key: string): boolean {
        return this.keys.has(key);
    }

    isDragging(): boolean {
        return this.dragX !== -1 && this.dragY !== -1;
    }

    isPointerLock(): boolean {
        return document.pointerLockElement === this.element;
    }

    isFocused(): boolean {
        return this.mouseX !== -1 && this.mouseY !== -1;
    }

    hasMovedMouse(): boolean {
        return (
            this.lastMouseX !== this.mouseX || this.lastMouseY !== this.mouseY
        );
    }

    getDeltaMouseX(): number {
        if (this.deltaMouseX !== 0) {
            return this.deltaMouseX;
        }
        if (this.isDragging()) {
            return this.dragX - this.mouseX;
        }
        return 0;
    }

    getDeltaMouseY(): number {
        if (this.deltaMouseY !== 0) {
            return this.deltaMouseY;
        }
        if (this.isDragging()) {
            return this.dragY - this.mouseY;
        }
        return 0;
    }

    getGamepad(): Gamepad | null {
        let gamepad: Gamepad | null = null;
        if (this.gamepadIndex !== undefined) {
            const gamepads = navigator.getGamepads();
            if (gamepads) {
                gamepad = gamepads[this.gamepadIndex];
            }
        }
        return gamepad;
    }

    private onGamepadConnected = (event: GamepadEvent) => {
        this.gamepadIndex = event.gamepad.index;
    };

    private onGamepadDisconnected = (event: GamepadEvent) => {
        this.gamepadIndex = undefined;
    };

    private onDoubleClick = (event: MouseEvent) => {
        if (!document.pointerLockElement) {
            this.element.requestPointerLock();
        }
    };

    private onKeyDown = (event: KeyboardEvent) => {
        event.preventDefault();
        this.keys.set(event.code, true);
    };

    private onKeyUp = (event: KeyboardEvent) => {
        event.preventDefault();
        this.keys.delete(event.code);
    };

    private onMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) {
            return;
        }
        const [x, y] = getMousePos(this.element, event);
        this.dragX = x;
        this.dragY = y;
        this.mouseX = x;
        this.mouseY = y;
    };

    private onMouseMove = (event: MouseEvent) => {
        const [x, y] = getMousePos(this.element, event);
        this.mouseX = x;
        this.mouseY = y;

        if (this.isPointerLock()) {
            this.deltaMouseX -= event.movementX;
            this.deltaMouseY -= event.movementY;
        }
        this.isTouch = false;
    };

    private onMouseUp = (event: MouseEvent) => {
        this.dragX = -1;
        this.dragY = -1;
    };

    private onMouseLeave = (event: MouseEvent) => {
        this.resetMouse();
    };

    private onTouchStart = (event: TouchEvent) => {
        const [x, y] = getMousePos(this.element, event.touches[0]);
        this.dragX = x;
        this.dragY = y;
        this.mouseX = x;
        this.mouseY = y;
        this.isTouch = true;
    };

    private onTouchMove = (event: TouchEvent) => {
        const [x, y] = getMousePos(this.element, event.touches[0]);
        this.mouseX = x;
        this.mouseY = y;
    };

    private onTouchEnd = (event: TouchEvent) => {
        this.dragX = -1;
        this.dragY = -1;
    };

    private onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
        const [x, y] = getMousePos(this.element, event);
        this.pickX = x;
        this.pickY = y;
        console.log("clicked2,", this.pickX, this.pickY);
    };

    onPositionJoystickMove = (event: IJoystickUpdateEvent) => {
        this.positionJoystickEvent = event;
    };

    onPositionJoystickStop = (event: IJoystickUpdateEvent) => {
        this.positionJoystickEvent = undefined;
    };

    onCameraJoystickMove = (event: IJoystickUpdateEvent) => {
        this.cameraJoystickEvent = event;
    };

    onCameraJoystickStop = (event: IJoystickUpdateEvent) => {
        this.cameraJoystickEvent = undefined;
    };

    private onFocusOut = () => {
        this.keys.clear();
        this.resetMouse();
    };

    resetMouse() {
        this.mouseX = -1;
        this.mouseY = -1;
        this.dragX = -1;
        this.dragY = -1;
    }

    onFrameEnd() {
        if (this.isDragging() && !this.isTouch) {
            this.dragX = this.mouseX;
            this.dragY = this.mouseY;
        }
        this.deltaMouseX = 0;
        this.deltaMouseY = 0;
        this.pickX = -1;
        this.pickY = -1;
        this.lastMouseX = this.mouseX;
        this.lastMouseY = this.mouseY;
    }
}
