import p5 from 'p5';
import GraphView from './GraphView';
import { isDefined } from './GraphUtils';
import * as GraphUtils from './GraphUtils';
import _cloneDeep from 'lodash/cloneDeep';
import _isEqual from 'lodash/isEqual';

export type Point = number[];
export class Curve {
    pts: Point[] = [];
    minX: number = 0;
    maxX: number = 0;
    minY: number = 0;
    maxY: number = 0;
    endPt?: Point[]; // This is likely a typo, should probably be endPts, but that would require changes to the checker.
    interX: Point[] = [];
    interY: Point[] = [];
    maxima: Point[] = [];
    minima: Point[] = [];
    colorIdx: number = -1;
}

export interface CanvasProperties {
    widthPx: number,
    heightPx: number,
    axisLengthPx: number,
    centerPx: Point,
    plotStartPx: Point,
    plotEndPx: Point
}

export enum Dimension {
    X,
    Y
}

enum Action {
    NO_ACTION,
    STRETCH_CURVE,
    STRETCH_POINT,
    MOVE_CURVE,
    DRAW_CURVE,
    MOVE_SYMBOL
};

export enum LineType { BEZIER, LINEAR };

export interface GraphSketcherState { canvasWidth: number; canvasHeight: number; curves?: Curve[] };

export class GraphSketcher {
    private p: p5;
    private canvasProperties: CanvasProperties;
    private graphView: GraphView;

    private previewMode: boolean = false;
    private allowMultiValuedFunctions: boolean = false;
    private showDebugInfo: boolean = false;

    private checkPoint: any;
    public  checkPointsUndo: any[] = [];
    public  checkPointsRedo: any[] = [];

    private CURVE_LIMIT = 3;
    private MOUSE_DETECT_RADIUS = 20;
    private REQUIRED_CURVE_ON_SCREEN_RATIO = 0.50; // 50% of a curves points must be on screen or it will be deleted

    // action recorder
    private action: Action = Action.NO_ACTION;
    private isMouseDragged: boolean = false;
    private releasePt: Point = [0,0];

    // for drawing curve
    private drawnPts: Point[] = [];
    private drawnColorIdx: number = -1;

    private prevMousePt: Point = [0,0];

    // for moving and stretching curve
    private movedCurveIdx?: number;
    private stretchMode?: string;
    private isMaxima?: boolean;
    private outOfBoundsCurvePoint?: Point;

    // for moving symbols
    private movedSymbol?: null; // TODO: WTF is this?
    private bindedKnot?: { [x: string]: any; };
    private symbolType?: string;

    private _oldState: GraphSketcherState;
    private _state: GraphSketcherState;
    get state(): GraphSketcherState {
        return this._state;
    }
    // This is only used externally at the moment - if it gets used internally then prepare for infinite loops
    // (basically, if you want to change the curves, then please update this._state instead of this.state)
    set state(newState: GraphSketcherState) {
        if (isDefined(newState) && isDefined(newState.curves)) {
            this._state = GraphUtils.decodeData(newState, this.canvasProperties);
            this._oldState = _cloneDeep(this._state);
        } else if (isDefined(newState)) {
            this._state.curves = [];
        }
        if (this.setupDone) {
            // Somehow this check is necessary as this might be executed before
            // setup() is called and thus this.p might not be initialized.
            this.reDraw();
        }
    }
    private clickedKnot?: number;
    private clickedKnotId?: number;
    private clickedCurve?: number;
    private clickedCurveIdx?: number;

    public canvas?: p5.Renderer;
    private elements: HTMLElement[] = [];
    private colorSelect?: HTMLSelectElement;
    private trashButton?: HTMLButtonElement;
    private resetButton?: HTMLButtonElement;

    // The following public members can be modified from the outside
    public drawingColorName: string = "Blue";
    public selectedLineType = LineType.BEZIER;
    public updateGraphSketcherState?: (state: GraphSketcherState) => void;

    public setupDone = false;

    constructor(p: p5, width: number, height: number, options: { previewMode: boolean, initialCurves?: Curve[], allowMultiValuedFunctions?: boolean}) {
        this.p = p;

        // todo: we could use the state pattern for these methods, as behaviour largely depends on the current Action
        this.p.touchStarted = this.touchStarted;
        this.p.mousePressed = this.mousePressed;
        this.p.touchMoved = this.touchMoved;
        this.p.mouseMoved = this.mouseMoved;
        this.p.mouseDragged = this.mouseDragged;
        this.p.touchEnded = this.touchEnded;
        this.p.mouseReleased = this.mouseReleased;
        this.p.keyReleased = this.keyReleased;

        this.p.windowResized = this.windowResized;

        this.p.setup = this.setup;

        this.canvasProperties = GraphSketcher.getCanvasPropertiesForResolution(width, height);
        this.graphView = new GraphView(p, this.canvasProperties);
        this.previewMode = options.previewMode;
        this.allowMultiValuedFunctions = options.allowMultiValuedFunctions ?? false;
        this._state = GraphUtils.decodeData({ curves: options.initialCurves ?? [], canvasWidth: width, canvasHeight: height }, this.canvasProperties);
        this._oldState = _cloneDeep(this._state);
    }

    // run in the beginning by p5 library
    private setup = () => {
        if (!this.previewMode) {
            this.elements.push(document.getElementById("graph-sketcher-ui-redo-button") as HTMLElement);
            this.elements.push(document.getElementById("graph-sketcher-ui-undo-button") as HTMLElement);
            this.elements.push(document.getElementById("graph-sketcher-ui-bezier-button") as HTMLElement);
            this.elements.push(document.getElementById("graph-sketcher-ui-linear-button") as HTMLElement);

            this.trashButton = document.getElementById("graph-sketcher-ui-trash-button") as HTMLButtonElement;
            this.trashButton.addEventListener('click', this.deleteSelectedCurve);
            this.elements.push(this.trashButton);
            this.resetButton = document.getElementById("graph-sketcher-ui-reset-button") as HTMLButtonElement;
            this.resetButton.addEventListener('click', this.deleteAllCurves);
            this.elements.push(this.resetButton);

            this.elements.push(document.getElementById("graph-sketcher-ui-submit-button") as HTMLElement);
            this.elements.push(document.getElementById("graph-sketcher-ui-help-button") as HTMLElement);
            this.colorSelect = document.getElementById("graph-sketcher-ui-color-select") as HTMLSelectElement;

            this.elements.push(this.colorSelect);
        }
        this.p.noLoop();
        this.p.cursor(this.p.ARROW);
        this.canvas = this.p.createCanvas(this.canvasProperties.widthPx, this.canvasProperties.heightPx);
        this.reDraw();
        this.setupDone = true;
    }

    public teardown = () => {
        this.p.touchStarted = () => {};
        this.p.mousePressed = () => {};
        this.p.touchMoved = () => {};
        this.p.mouseMoved = () => {};
        this.p.mouseDragged = () => {};
        this.p.touchEnded = () => {};
        this.p.mouseReleased = () => {};
        this.p.keyReleased = () => {};

        this.p.windowResized = () => {};

        this.p.setup = () => {};

        this.trashButton?.removeEventListener('click', this.deleteSelectedCurve);
        this.resetButton?.removeEventListener('click', this.deleteAllCurves);
    }

    private static getCanvasPropertiesForResolution(width: number, height: number): CanvasProperties {
        return {
            widthPx: width,
            heightPx: height,
            axisLengthPx: Math.min(width, height),
            // The canvas-space center of the display (equivalent to the cartesian plot's origin)
            centerPx: [width / 2, height / 2],
            // The canvas-space start and end of the drawable area (top left and bottom right of cartesian plot)
            plotStartPx: [width / 2 - Math.min(width, height) / 2, height / 2 - Math.min(width, height) / 2],
            plotEndPx: [width / 2 + Math.min(width, height) / 2, height / 2 + Math.min(width, height) / 2]
        }
    }

    private deleteSelectedCurve = () => {
        if (isDefined(this.clickedCurveIdx) && isDefined(this._state.curves)) {
            // Checkpoint
            this.checkPoint = {};
            this.checkPoint.curvesJSON = JSON.stringify(this._state);
            this.checkPoint.clickedCurveIdx = this.clickedCurveIdx;
            this.checkPointsUndo.push(this.checkPoint);
            // Delete curve
            this._state.curves.splice(this.clickedCurveIdx, 1);
            this.clickedCurveIdx = undefined;
            this.reDraw();
        }
    }

    private deleteAllCurves = () => {
        if (isDefined(this._state.curves)) {
            // Checkpoint
            this.checkPoint = {};
            this.checkPoint.curvesJSON = JSON.stringify(this._state);
            this.checkPoint.clickedCurveIdx = this.clickedCurveIdx;
            this.checkPointsUndo.push(this.checkPoint);
            // Delete curves
            this._state.curves = [];
            this.movedCurveIdx = undefined;
            this.clickedCurveIdx = undefined;
            this.reDraw();
        }
    }

    private isPointOverButton = (pt: Point, button: HTMLElement) => {
        const rect = button.getBoundingClientRect();
        if (rect) {
            let left = rect.left;
            let top = rect.top;
            let width = rect.width;
            let height = rect.height;
            return pt[0] > left && pt[0] < left + width && pt[1] > top && pt[1] < top + height;
        }
        return false;
    }

    private isPointInsidePlot = (pt: Point) => {
        return pt[0] > this.canvasProperties.plotStartPx[0]
            && pt[0] < this.canvasProperties.plotEndPx[0]
            && pt[1] > this.canvasProperties.plotStartPx[1]
            && pt[1] < this.canvasProperties.plotEndPx[1]
    }

    private areMostPointsOutsidePlot = (pts: Point[]) => {
        return pts.filter(this.isPointInsidePlot).length < (pts.length * this.REQUIRED_CURVE_ON_SCREEN_RATIO);
    }

    private isCurveOutsidePlot = (curveIdx: number) => {
        if (!isDefined(this._state.curves)) {
            return false;
        }
        // This step might be expensive, but it is necessary to prevent the user from losing curves by
        // accident and making the questions unanswerable.
        const curve = this._state.curves[curveIdx];
        const points = GraphUtils.sample(curve.pts);
        return this.areMostPointsOutsidePlot(points);
    }

    private getAveragePoint = (pts: Point[]): Point => {
        // Calculate the average point
        let avgX = 0;
        let avgY = 0;
        for (let i = 0; i < pts.length; i++) {
            avgX += pts[i][0];
            avgY += pts[i][1];
        }
        avgX /= pts.length;
        avgY /= pts.length;
        return [avgX, avgY];
    }

    // Mouse is inactive if over buttons - stops curves being drawn where they can't be seen
    private isActive = (pt: Point) => {
        for (let i = 0; i < this.elements.length; i++) {
            if (this.isPointOverButton(pt, this.elements[i])) {
                return false;
            }
        }
        return true;
    }

    // undo-ing, record history
    public undo = () => {
        if (this.checkPointsUndo.length === 0 || !isDefined(this.checkPointsUndo)) {
            return;
        }

        let checkPointRedo: { curvesJSON?: string } = {};
        checkPointRedo.curvesJSON = JSON.stringify(this._state);
        this.checkPointsRedo.push(checkPointRedo);

        let checkPointUndo = this.checkPointsUndo.pop();
        this._state = JSON.parse(checkPointUndo.curvesJSON);
        this.clickedKnot = undefined;
        this.clickedCurveIdx = undefined;

        this.reDraw();
    }

    // redo-ing, record history
    public redo = () => {
        if (this.checkPointsRedo.length === 0) {
            return;
        }

        let checkPointUndo: { curvesJSON?: string } = {};
        checkPointUndo.curvesJSON = JSON.stringify(this._state);
        this.checkPointsUndo.push(checkPointUndo);

        let checkPointRedo = this.checkPointsRedo.pop();
        this._state = JSON.parse(checkPointRedo.curvesJSON);

        this.clickedKnot = undefined;
        this.clickedCurveIdx = undefined;

        this.reDraw();
    }

    // Check if undo/redo should be made available, if so the respective option will be shown
    public isUndoable = () => {
        return this.checkPointsUndo.length > 0;
    }

    public isRedoable = () => {
        return this.checkPointsRedo.length > 0;
    }

    // Check if movement to new position is over an actionable object, so can render appropriately
    private mouseMoved = (e: MouseEvent) => {
        if (this.previewMode) return;

        let mousePosition: Point = GraphUtils.getMousePt(e);

        const detect = (x: number, y: number) => {
            return (Math.abs(mousePosition[0] - x) < this.MOUSE_DETECT_RADIUS && Math.abs(mousePosition[1] - y) < this.MOUSE_DETECT_RADIUS);
        }

        // this function does not react if the mouse is over buttons or outside the canvas.
        if (!this.isActive(mousePosition)) {
            return;
        }

        if (isDefined(this._state.curves)) {
            let found = GraphUtils.overItem(this._state.curves, e, this.MOUSE_DETECT_RADIUS, "notFound");
            if (found === "overKnot") {
                this.p.cursor(this.p.HAND);
                return;
            } else if ((found === "overAttachedSymbol") || (found === "overFreeSymbol") || (found === "overCurve")) {
                // TODO: The first two can never happen, as far as I can tell...
                this.p.cursor(this.p.MOVE);
                return;
            } else if (found === "notFound") {
                this.p.cursor(this.p.CROSS);
                //this.reDraw();  // FIXME why was this here in the first place
            }
        }

        // stretch box
        if (isDefined(this.clickedCurveIdx) && isDefined(this._state.curves)) {
            let c = this._state.curves[this.clickedCurveIdx];
            let isDraggable = false;
            if (detect(c.minX, c.minY) || detect(c.maxX, c.minY) || detect(c.minX, c.maxY) || detect(c.maxX, c.maxY)) {
                isDraggable = true;
                this.p.push();
                this.p.fill(this.graphView.KNOT_DETECT_COLOR);
                if (detect(c.minX, c.minY)) {
                    this.p.rect(c.minX - 4, c.minY - 4, 8, 8);
                } else if (detect(c.maxX, c.minY)) {
                    this.p.rect(c.maxX - 4, c.minY - 4, 8, 8);
                } else if (detect(c.minX, c.maxY)) {
                    this.p.rect(c.minX - 4, c.maxY - 4, 8, 8);
                } else {
                    this.p.rect(c.maxX - 4, c.maxY - 4, 8, 8);
                }

                this.p.pop();

                this.p.cursor(this.p.MOVE);
            } else if (detect((c.minX + c.maxX) / 2, c.minY - 3) || detect((c.minX + c.maxX) / 2, c.maxY + 3) ||
                       detect(c.minX - 3, (c.minY + c.maxY) / 2) || detect(c.maxX + 3, (c.minY + c.maxY) / 2)) {
                isDraggable = true;
                this.p.push();
                this.p.fill(this.graphView.KNOT_DETECT_COLOR);
                if (detect((c.minX + c.maxX) / 2, c.minY - 3)) {
                    this.p.triangle((c.minX + c.maxX) / 2 - 5, c.minY - 2, (c.minX + c.maxX) / 2 + 5, c.minY - 2, (c.minX + c.maxX) / 2, c.minY - 7);
                } else if (detect((c.minX + c.maxX) / 2, c.maxY + 3)) {
                    this.p.triangle((c.minX + c.maxX) / 2 - 5, c.maxY + 2, (c.minX + c.maxX) / 2 + 5, c.maxY + 2, (c.minX + c.maxX) / 2, c.maxY + 7);
                } else if (detect(c.minX - 3, (c.minY + c.maxY) / 2)) {
                    this.p.triangle(c.minX - 2, (c.minY + c.maxY) / 2 - 5, c.minX - 2, (c.minY + c.maxY) / 2 + 5, c.minX - 7, (c.minY + c.maxY) / 2);
                } else {
                    this.p.triangle(c.maxX + 2, (c.minY + c.maxY) / 2 - 5, c.maxX + 2, (c.minY + c.maxY) / 2 + 5, c.maxX + 7, (c.minY + c.maxY) / 2);
                }
                this.p.pop();

                this.p.cursor(this.p.MOVE);
            } else if (mousePosition[0] >= c.minX && mousePosition[0] <= c.maxX && mousePosition[1] >= c.minY && mousePosition[1] <= c.maxY) {
                this.graphView.drawStretchBox(this.clickedCurveIdx, this._state.curves);
                this.p.cursor(this.p.MOVE);
            }
            if (!isDraggable) {
                this.graphView.drawStretchBox(this.clickedCurveIdx, this._state.curves);
            }
        }
    }

    // Determines type of action when clicking on something within the canvas
    private mousePressed = (e: MouseEvent | TouchEvent | Touch) => {
        if (this.previewMode) return;

        if (e instanceof MouseEvent) {
            e.preventDefault(); // Stops highlighting text on click and drag
        }

        this.isMouseDragged = false;
        this.action = Action.NO_ACTION;

        this.movedSymbol = undefined;
        this.bindedKnot = undefined;
        this.symbolType = undefined;

        this.drawnPts = [];
        this.drawnColorIdx = -1;

        this.movedCurveIdx = undefined;
        this.prevMousePt = [0,0];
        this.outOfBoundsCurvePoint = undefined;

        let mousePosition = GraphUtils.getMousePt(e);
        this.releasePt = mousePosition;

        // this function does not react if the mouse is over buttons or outside the canvas.
        if (!this.isActive(mousePosition)) {
            return;
        }

        if (this.showDebugInfo) {
            this.graphView.debugDrawCoordinates(mousePosition)
        }

        const detect = (x: number, y: number) => {
            return (Math.abs(mousePosition[0] - x) < this.MOUSE_DETECT_RADIUS && Math.abs(mousePosition[1] - y) < this.MOUSE_DETECT_RADIUS);
        }
        // record down mousePosition status, may be used later for undo.
        this.checkPoint = {};
        this.checkPoint.curvesJSON = JSON.stringify(this._state);

        // check if stretching curve
        if (isDefined(this.clickedCurveIdx) && isDefined(this._state.curves)) {
            let c = this._state.curves[this.clickedCurveIdx];

            if (detect(c.minX, c.minY) || detect(c.maxX, c.minY) || detect(c.minX, c.maxY) || detect(c.maxX, c.maxY) ||
                detect((c.minX + c.maxX)/2, c.minY - 3) || detect((c.minX + c.maxX)/2, c.maxY + 3) ||
                detect(c.minX - 3, (c.minY + c.maxY)/2) || detect(c.maxX + 3, (c.minY + c.maxY)/2)) {

                if (detect(c.minX, c.minY)) {
                    this.stretchMode = "bottomLeft";
                } else if (detect(c.maxX, c.minY)) {
                    this.stretchMode = "bottomRight";
                } else if (detect(c.maxX, c.maxY)) {
                    this.stretchMode = "topRight";
                } else if (detect(c.minX, c.maxY)) {
                    this.stretchMode = "topLeft";
                } else if (detect((c.minX + c.maxX)/2, c.minY - 3)) {
                    this.stretchMode = "bottomMiddle";
                } else if (detect((c.minX + c.maxX)/2, c.maxY + 3)) {
                    this.stretchMode = "topMiddle";
                } else if (detect(c.minX - 3, (c.minY + c.maxY)/2)) {
                    this.stretchMode = "leftMiddle";
                } else {
                    this.stretchMode = "rightMiddle";
                }

                this.graphView.drawCorner(this.stretchMode || "none", c);

                this.action = Action.STRETCH_CURVE;
                this.clickedKnot = undefined;
                this.prevMousePt = mousePosition;
                return;
            }
        }

        if (isDefined(this._state.curves) && this._state.curves.length > 0) {
            for (let i = 0; i < this._state.curves.length; i++) {
                let maxima = this._state.curves[i].maxima;
                let minima = this._state.curves[i].minima;
                for (let j = 0; j < maxima.length; j++) {
                    let knot = maxima[j];
                    if (GraphUtils.getDist(mousePosition, knot) < this.MOUSE_DETECT_RADIUS + 10){
                        this.clickedCurve = i;
                        this.action = Action.STRETCH_POINT;
                        this.clickedKnotId = j;
                        this.prevMousePt = mousePosition;
                        this.isMaxima = true;
                        return;
                    }
                }
                for (let j = 0; j < minima.length; j++) {
                    let knot = minima[j];
                    if (GraphUtils.getDist(mousePosition, knot) < this.MOUSE_DETECT_RADIUS + 10){
                        this.clickedCurve = i;
                        this.action = Action.STRETCH_POINT;
                        this.clickedKnotId = j;
                        this.prevMousePt = mousePosition;
                        this.isMaxima = false;
                        return;
                    }
                }
            }
            for (let i = 0; i < this._state.curves.length; i++) {
                for (let j = 0; j < this._state.curves[i].pts.length; j++) {
                    if (GraphUtils.getDist(mousePosition, this._state.curves[i].pts[j]) < this.MOUSE_DETECT_RADIUS * 2) {
                        this.clickedCurveIdx = i;
                        this.movedCurveIdx = i;
                        this.action = Action.MOVE_CURVE;
                        this.clickedKnot = undefined;
                        this.prevMousePt = mousePosition;
                        return;
                    }
                }
            }
        }

        // Does another check to make sure the mouse is inside the plot, and not just "active"
        if (isDefined(this._state.curves) && this.isPointInsidePlot(mousePosition) && this._state.curves.length < this.CURVE_LIMIT){
            this.action = Action.DRAW_CURVE;
        }

        if (isDefined(this.clickedCurveIdx) || isDefined(this.clickedKnot)) {
            // TODO: Wipe off that stupid look on my face every time I see this
            this.clickedCurveIdx = undefined;
            this.clickedKnot = undefined;
            this.reDraw();
        }

        // get drawnColor
        switch (this.colorSelect?.value) {
            case "Blue":
                this.drawnColorIdx = 0;
                break;
            case "Orange":
                this.drawnColorIdx = 1;
                break;
            case "Green":
                this.drawnColorIdx = 2;
                break;
            default:
                this.drawnColorIdx = 0;
                break;
        }
        return;
    }

    // Keep actions for curve manipulation together
    private mouseDragged = (e: MouseEvent | TouchEvent | Touch) => {
        if (this.previewMode) return;

        if (e instanceof MouseEvent) {
            e.preventDefault(); // Stops highlighting text on click and drag
        }

        this.isMouseDragged = true;
        let mousePosition = GraphUtils.getMousePt(e);
        this.releasePt = mousePosition;

        if (this.action === Action.STRETCH_POINT && isDefined(this.clickedCurve) && isDefined(this._state.curves)) {
            let selectedCurve = this._state.curves[this.clickedCurve];
            // we need to know the (important) ordered end and turning points
            let importantPoints: Point[] = [];
            if (selectedCurve.pts[0][0] > selectedCurve.pts[selectedCurve.pts.length - 1][0]) {
                selectedCurve.pts.reverse();
            }
            selectedCurve.endPt = GraphUtils.findEndPts(selectedCurve.pts);
            selectedCurve.maxima = GraphUtils.findTurnPts(selectedCurve.pts, 'maxima');
            selectedCurve.minima = GraphUtils.findTurnPts(selectedCurve.pts, 'minima');
            importantPoints.push(...selectedCurve.endPt);
            importantPoints.push(...selectedCurve.maxima);
            importantPoints.push(...selectedCurve.minima);
            importantPoints.sort(function(a, b){return a[0] - b[0]});

            // maxima and minima are treated in slightly different ways
            if (isDefined(this.isMaxima)) {
                const curve = GraphUtils.stretchTurningPoint(importantPoints, e, selectedCurve, this.isMaxima, this.clickedKnotId, this.prevMousePt, this.canvasProperties);
                if (isDefined(curve)) {
                    this._state.curves[this.clickedCurve] = curve;
                }
            }

            this.reDraw();
            this.prevMousePt = mousePosition;

        } else if (this.action === Action.MOVE_CURVE && isDefined(this.movedCurveIdx) && isDefined(this._state.curves)) {
            this.p.cursor(this.p.MOVE);

            let dx = mousePosition[0] - this.prevMousePt[0];
            let dy = mousePosition[1] - this.prevMousePt[1];
            this.prevMousePt = mousePosition;
            GraphUtils.translateCurve(this._state.curves[this.movedCurveIdx], dx, dy, this.canvasProperties);
            this.outOfBoundsCurvePoint = this.isCurveOutsidePlot(this.movedCurveIdx) ? this.getAveragePoint(this._state.curves[this.movedCurveIdx].pts) : undefined;
            this.reDraw();

        } else if (this.action === Action.STRETCH_CURVE && isDefined(this.clickedCurveIdx) && isDefined(this._state.curves)) {
            this.p.cursor(this.p.MOVE);

            let dx = mousePosition[0] - this.prevMousePt[0];
            let dy = mousePosition[1] - this.prevMousePt[1];
            this.prevMousePt = mousePosition;

            let currentCurve = this._state.curves[this.clickedCurveIdx];

            // calculate old x,y range
            let orx = currentCurve.maxX - currentCurve.minX;
            let ory = currentCurve.maxY - currentCurve.minY;

            this.graphView.drawCorner(this.stretchMode || "none", currentCurve);

            // update the position of stretched vertex
            switch (this.stretchMode) {
                case "bottomLeft":
                    currentCurve.minX += (orx < 30 && dx > 0) ? 0 : dx + Math.min(0, currentCurve.maxX - (currentCurve.minX + dx) - 30);
                    currentCurve.minY += (ory < 30 && dy > 0) ? 0 : dy + Math.min(0, currentCurve.maxY - (currentCurve.minY + dy) - 30);
                    break;
                case "bottomRight":
                    currentCurve.maxX += (orx < 30 && dx < 0) ? 0 : dx - Math.min(0, (currentCurve.maxX + dx) - currentCurve.minX - 30);
                    currentCurve.minY += (ory < 30 && dy > 0) ? 0 : dy + Math.min(0, currentCurve.maxY - (currentCurve.minY + dy) - 30);
                    break;
                case "topRight":
                    currentCurve.maxX += (orx < 30 && dx < 0) ? 0 : dx - Math.min(0, (currentCurve.maxX + dx) - currentCurve.minX - 30);
                    currentCurve.maxY += (ory < 30 && dy < 0) ? 0 : dy - Math.min(0, (currentCurve.maxY + dy) - currentCurve.minY - 30);
                    break;
                case "topLeft":
                    currentCurve.minX += (orx < 30 && dx > 0) ? 0 : dx + Math.min(0, currentCurve.maxX - (currentCurve.minX + dx) - 30);
                    currentCurve.maxY += (ory < 30 && dy < 0) ? 0 : dy - Math.min(0, (currentCurve.maxY + dy) - currentCurve.minY - 30);
                    break;
                case "bottomMiddle":
                    if ( ory < 30 && dy > 0) {
                        return;
                    }
                    currentCurve.minY += dy + Math.min(0, currentCurve.maxY - (currentCurve.minY + dy) - 30);
                    break;
                case "topMiddle":
                    if (ory < 30 && dy < 0) {
                        return;
                    }
                    currentCurve.maxY += dy - Math.min(0, (currentCurve.maxY + dy) - currentCurve.minY - 30);
                    break;
                case "leftMiddle":
                    if (orx < 30 && dx > 0) {
                        return;
                    }
                    currentCurve.minX += dx + Math.min(0, currentCurve.maxX - (currentCurve.minX + dx) - 30);
                    break;
                case "rightMiddle":
                    if (orx < 30 && dx < 0) {
                        return;
                    }
                    currentCurve.maxX += dx - Math.min(0, (currentCurve.maxX + dx) - currentCurve.minX - 30);
                    break;
            }

            // calculate the new range
            let nrx = currentCurve.maxX - currentCurve.minX;
            let nry = currentCurve.maxY - currentCurve.minY;

            // stretch the curve
            switch (this.stretchMode) {
                case "bottomLeft":
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, nry, currentCurve.maxX, currentCurve.maxY, this.canvasProperties);
                    break;
                case "bottomRight":
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, nry, currentCurve.minX, currentCurve.maxY, this.canvasProperties);
                    break;
                case "topRight":
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, nry, currentCurve.minX, currentCurve.minY, this.canvasProperties);
                    break;
                case "topLeft":
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, nry, currentCurve.maxX, currentCurve.minY, this.canvasProperties);
                    break;
                case "bottomMiddle":
                    GraphUtils.stretchCurve(currentCurve, orx, ory, orx, nry, (currentCurve.minX + currentCurve.maxX)/2, currentCurve.maxY, this.canvasProperties);
                    break;
                case "topMiddle":
                    GraphUtils.stretchCurve(currentCurve, orx, ory, orx, nry, (currentCurve.minX + currentCurve.maxX)/2, currentCurve.minY, this.canvasProperties);
                    break;
                case "leftMiddle":
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, ory, currentCurve.maxX, (currentCurve.minY + currentCurve.maxY)/2, this.canvasProperties);
                    break;
                case "rightMiddle":
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, ory, currentCurve.minX, (currentCurve.minY + currentCurve.maxY)/2, this.canvasProperties);
                    break;
            }
            this.outOfBoundsCurvePoint = this.isCurveOutsidePlot(this.clickedCurveIdx) ? this.getAveragePoint(this._state.curves[this.clickedCurveIdx].pts) : undefined;
            this.reDraw();
            this.graphView.drawCorner(this.stretchMode || "none", currentCurve);

        } else if (this.action === Action.DRAW_CURVE && this.drawnColorIdx >= 0) {
            this.p.cursor(this.p.CROSS);
            if (isDefined(this._state.curves) && this._state.curves.length < this.CURVE_LIMIT) {

                // Constrain mouse x position based on x-direction of line between last two points - this block is
                // the only thing that enforces this, so will be easy to remove if it's not wanted (see `git blame`
                // for the relevant commit)
                let constrainedMouseX: number;
                if (!this.allowMultiValuedFunctions) {
                    if (this.drawnPts.length > 1) {
                        const lastPointOffGrid = this.drawnPts[this.drawnPts.length - 1][0] < this.canvasProperties.plotStartPx[0] || this.drawnPts[this.drawnPts.length - 1][0] > this.canvasProperties.plotEndPx[0];
                        if (lastPointOffGrid || this.drawnPts[this.drawnPts.length - 1][0] === this.drawnPts[this.drawnPts.length - 2][0]) {
                            return;
                        } else if (this.drawnPts[this.drawnPts.length - 1][0] < this.drawnPts[this.drawnPts.length - 2][0]) {
                            constrainedMouseX = this.p.constrain(mousePosition[0], this.canvasProperties.plotStartPx[0], this.drawnPts[this.drawnPts.length - 1][0] - 0.1);
                        } else {
                            constrainedMouseX = this.p.constrain(mousePosition[0], this.drawnPts[this.drawnPts.length - 1][0] + 0.1, this.canvasProperties.plotEndPx[0]);
                        }
                    } else {
                        // Check that there a decent amount of x-movement in the second point so we can be sure of the direction
                        // that the user is trying to draw the curve in
                        // TODO find the right threshold, might need a fair bit of testing
                        if (this.drawnPts.length > 0 && Math.abs(this.drawnPts[0][0] - mousePosition[0]) < 2 / (Math.max(1, Math.abs(this.drawnPts[0][1] - mousePosition[1])) ** 2)) {
                            return;
                        }
                        constrainedMouseX = this.p.constrain(mousePosition[0], this.canvasProperties.plotStartPx[0], this.canvasProperties.plotEndPx[0]);
                    }
                    // By induction, the x-position of the last three points is (strictly) increasing or decreasing (ignoring some weird edge cases)
                } else {
                    constrainedMouseX = this.p.constrain(mousePosition[0], this.canvasProperties.plotStartPx[0], this.canvasProperties.plotEndPx[0]);
                }
                const constrainedMouseY = this.p.constrain(mousePosition[1], this.canvasProperties.plotStartPx[1], this.canvasProperties.plotEndPx[1]);

                this.p.push();
                this.p.stroke(this.graphView.CURVE_COLORS[this.drawnColorIdx]);
                this.p.strokeWeight(this.graphView.CURVE_STRKWEIGHT);
                if (this.selectedLineType === LineType.LINEAR) {
                    this.reDraw();
                    if (this.drawnPts.length > 1) {
                        const initialPoint = this.drawnPts[0];
                        this.p.line(initialPoint[0], initialPoint[1], constrainedMouseX, constrainedMouseY);                        
                        this.drawnPts.pop();
                    }
                    this.p.pop();
                    this.drawnPts.push([constrainedMouseX, constrainedMouseY]);
                } else {
                    if (this.drawnPts.length > 0) {
                        const precedingPoint = this.drawnPts[this.drawnPts.length - 1];
                        this.p.line(precedingPoint[0], precedingPoint[1], constrainedMouseX, constrainedMouseY);
                    }
                    this.p.pop();
                    this.drawnPts.push([constrainedMouseX, constrainedMouseY]);
                }

            }
        }
    }

    // Need to know where to update points to - gives final position
    private mouseReleased = (_e: MouseEvent | TouchEvent | Touch) => {
        if (this.previewMode) return;

        if (_e instanceof MouseEvent) {
            _e.preventDefault(); // Stops highlighting text on click and drag
        }

        let mousePosition = this.releasePt;

        // if it is just a click, handle click in the following if block
        if (!this.isMouseDragged) {
            // clean up the mess of MOVE_SYMBOL and MOVE_CURVE
            if (this.action === Action.MOVE_SYMBOL) {
                // TODO: This does not seem to do anything useful
                if (!this.bindedKnot) {
                    // this.freeSymbols.push(this.movedSymbol);
                } else {
                    this.bindedKnot[this.symbolType || ''] = this.movedSymbol;
                }
                this.reDraw();
            } else if ([Action.MOVE_CURVE, Action.STRETCH_CURVE, Action.STRETCH_POINT].includes(this.action)) {
                this.reDraw();
            }

            // click do not respond in inactive area (eg buttons)
            if (!this.isActive(mousePosition)) {
                return;
            }

            // check if show stretch box
            if (isDefined(this._state.curves)) {
                for (let i = 0; i < this._state.curves.length; i++) {
                    let pts = this._state.curves[i].pts;
                    for (let j = 0; j < pts.length; j++) {
                        if (GraphUtils.getDist(pts[j], mousePosition) < this.MOUSE_DETECT_RADIUS) {
                            this.clickedCurveIdx = i;
                            this.reDraw();
                            return;
                        }
                    }
                }
            }

            if (isDefined(this.clickedKnot) || isDefined(this.clickedCurveIdx)) {
                this.clickedKnot = undefined;
                this.clickedCurveIdx = undefined;
                this.reDraw();
            }

            return;
        }

        if (this.action === Action.MOVE_CURVE) {
            this.checkPointsUndo.push(this.checkPoint);
            this.checkPointsRedo = [];

            // Delete the curve if it is in the trash, or if it is mostly off screen
            if (isDefined(this.movedCurveIdx) && isDefined(this._state.curves) && isDefined(this.outOfBoundsCurvePoint)) {
                this._state.curves.splice(this.movedCurveIdx, 1);
                this.clickedCurveIdx = undefined;
            }
            this.outOfBoundsCurvePoint = undefined;
            this.reDraw();

        } else if (this.action === Action.STRETCH_CURVE || this.action === Action.STRETCH_POINT) {
            this.checkPointsUndo.push(this.checkPoint);
            this.checkPointsRedo = [];
            // Delete the curve if it is has been marked as out of bounds
            if (isDefined(this.clickedCurveIdx) && isDefined(this._state.curves) && this.outOfBoundsCurvePoint) {
                this._state.curves.splice(this.clickedCurveIdx, 1);
                this.clickedCurveIdx = undefined;
                this.outOfBoundsCurvePoint = undefined;
                this.reDraw();
            }
        } else if (this.action === Action.DRAW_CURVE) {

            if (isDefined(this._state.curves) && this._state.curves.length < this.CURVE_LIMIT){

                if (this.drawnPts.length < 3 && this.selectedLineType !== LineType.LINEAR) {
                    // If the curve is too short or mostly outside the plot, don't add it
                    return;
                }
                let curve = new Curve();

                this.checkPointsUndo.push(this.checkPoint);
                this.checkPointsRedo = [];
                // scope.$apply();

                // adjustment of start and end to attach to the axis automatically.
                if (Math.abs(this.drawnPts[0][1] - this.canvasProperties.centerPx[1]) < 3) {
                    this.drawnPts[0][1] = this.canvasProperties.centerPx[1];
                }
                if (Math.abs(this.drawnPts[0][0] - this.canvasProperties.centerPx[0]) < 3) {
                    this.drawnPts[0][0] = this.canvasProperties.centerPx[0];
                }
                if (Math.abs(this.drawnPts[this.drawnPts.length - 1][1] - this.canvasProperties.centerPx[1]) < 3) {
                    this.drawnPts[this.drawnPts.length - 1][1] = this.canvasProperties.centerPx[1];
                }
                if (Math.abs(this.drawnPts[this.drawnPts.length - 1][0] - this.canvasProperties.centerPx[0]) < 3) {
                    this.drawnPts[this.drawnPts.length - 1][0] = this.canvasProperties.centerPx[0];
                }

                let pts: Point[] = [];
                if (this.selectedLineType === LineType.BEZIER) {
                    pts = GraphUtils.bezierLineStyle(GraphUtils.sample(this.drawnPts));
                } else if (this.selectedLineType === LineType.LINEAR) {
                    pts = GraphUtils.linearLineStyle([this.drawnPts[0],this.drawnPts[this.drawnPts.length-1]])
                }

                curve.pts = pts;

                let minX = pts[0][0];
                let maxX = pts[0][0];
                let minY = pts[0][1];
                let maxY = pts[0][1];
                for (let i = 1; i < pts.length; i++) {
                    minX = Math.min(pts[i][0], minX);
                    maxX = Math.max(pts[i][0], maxX);
                    minY = Math.min(pts[i][1], minY);
                    maxY = Math.max(pts[i][1], maxY);
                }
                curve.minX = minX;
                curve.maxX = maxX;
                curve.minY = minY;
                curve.maxY = maxY;

                curve.endPt = GraphUtils.findEndPts(pts);
                curve.interX = GraphUtils.findInterceptX(this.canvasProperties, pts);
                curve.interY = GraphUtils.findInterceptY(this.canvasProperties, pts);
                if (this.selectedLineType === LineType.BEZIER) {
                    curve.maxima = GraphUtils.findTurnPts(pts, 'maxima');
                    curve.minima = GraphUtils.findTurnPts(pts, 'minima');
                } else {
                    curve.maxima = [];
                    curve.minima = [];
                }
                curve.colorIdx = this.drawnColorIdx;

                this._state.curves.push(curve);
                this.reDraw();
            }

            return;
        }
    }

    // Would like to be used on touch screen devices, this simply facilitates it
    private touchStarted = (e: TouchEvent) => {
        if (this.previewMode) return;
        //e.preventDefault(); // Ideally we want this, but it breaks interaction with the rest of the sketcher UI for some reason... commented out for now
        this.p.mousePressed(e.touches[0]);
    }

    private touchMoved = (e: TouchEvent) => {
        if (this.previewMode) return;
        //e.preventDefault();
        this.p.mouseDragged(e.touches[0]);
    }

    private touchEnded = (e: TouchEvent) => {
        if (this.previewMode) return;
        //e.preventDefault();
        this.p.mouseReleased(e);
    }

    public windowResized = () => {
        const data = GraphUtils.encodeData(false, this.canvasProperties, this._state.curves || []);
        if (!this.previewMode) {
            this.canvasProperties = GraphSketcher.getCanvasPropertiesForResolution(window.innerWidth, window.innerHeight)
            this.p.resizeCanvas(window.innerWidth, window.innerHeight, true);
        }
        if (isDefined(data)) {
            this._state = GraphUtils.decodeData(data, this.canvasProperties);
        }
        this.reDraw();
    }

    private keyReleased = () => {
        if (this.p.key === "Delete" || this.p.key === "Backspace") {
            this.checkPointsUndo.push(this.checkPoint);
            this.checkPointsRedo = [];
            if (isDefined(this.clickedCurveIdx) && isDefined(this._state.curves)) {
                this._state.curves.splice(this.clickedCurveIdx, 1);
                this.clickedCurveIdx = undefined;
                this.reDraw();
            }
        }
    }

    // Kind of hacky, and tightly coupled to isaac-react-app, but it seems to be the only way to get the external UI
    // to update nicely with canvas events, without having to pass in a bunch of callbacks or polling
    private updateExternalUI = () => {
        if (isDefined(this.trashButton)) {
            this.trashButton.disabled = !isDefined(this.clickedCurveIdx);
        }
        if (isDefined(this.resetButton)) {
            this.resetButton.disabled = this._state.curves === undefined || this._state.curves.length === 0;
        }
    }

    // equivalent to 'locally' refreshing the canvas
    public reDraw = () => {
        this.updateExternalUI();
        this.graphView.drawBackground(this.canvasProperties);

        // THIS INFORMS THE LISTENER OF A STATE CHANGE (if the state has changed)
        if (isDefined(this._state.curves) && this.updateGraphSketcherState && !_isEqual(this._oldState.curves, this._state.curves)) {
            const newState = GraphUtils.encodeData(true, this.canvasProperties, this._state.curves);
            if (newState) {
                this._oldState = _cloneDeep(this._state);
                this.updateGraphSketcherState(newState);
            }
        }

        if (isDefined(this.clickedCurveIdx) && isDefined(this._state.curves)) {
            this.graphView.drawStretchBox(this.clickedCurveIdx, this._state.curves);
        }
        if (isDefined(this._state.curves) && this._state.curves.length < 4) {
            this.graphView.drawCurves(this._state.curves);
        }
        this.graphView.drawBoundaries(this.canvasProperties);
        if (isDefined(this.outOfBoundsCurvePoint)) {
            // Clip it to the nearest grid boundary
            this.graphView.drawOutOfBoundsWarning(this.outOfBoundsCurvePoint, this.canvasProperties);
        }
    };
}

export function makeGraphSketcher(element: HTMLElement | undefined | null, width: number, height: number, options: { previewMode: boolean, initialCurves?: Curve[], allowMultiValuedFunctions?: boolean } = { previewMode: false, allowMultiValuedFunctions: false }): { sketch?: GraphSketcher, p: p5 } {
    let sketch: GraphSketcher | undefined;
    let p = new p5(instance => {
        sketch = new GraphSketcher(instance, width, height, options);
        return sketch;
    }, element ?? undefined);
    return { sketch, p };
}

export * from './GraphView';
