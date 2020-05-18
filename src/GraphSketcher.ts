import p5 from 'p5';
import GraphView from './GraphView';
import * as GraphUtils from './GraphUtils';

// TODO: Make this an actual point
export type Point = number[];
export class Curve {
    pts: Point[] = [];
    minX: number = 0;
    maxX: number = 0;
    minY: number = 0;
    maxY: number = 0;
    endPt: Point = [0,0];
    interX: Point[] = [];
    interY: Point[] = [];
    maxima: Point[] = [];
    minima: Point[] = [];
    colorIdx: number = -1;
};

enum Action {
    // TODO: Check that this needs to be a string enum
    NO_ACTION = "NO_ACTION",
    STRETCH_CURVE = "STRETCH_CURVE",
    STRETCH_POINT = "STRETCH_POINT",
    MOVE_CURVE = "MOVE_CURVE",
    DRAW_CURVE = "DRAW_CURVE",
    MOVE_SYMBOL = "MOVE_SYMBOL"
};

export class GraphSketcher {
    private p: p5;
    private canvasProperties: { width: number, height: number };
    private graphView: GraphView;

    private checkPoint: any;
    private checkPointsUndo: any[] = [];
    private checkPointsRedo: any[] = [];

    private MOVE_SYMBOL_COLOR = [151];
    private CURVE_LIMIT = 3;
    private MOUSE_DETECT_RADIUS = 10;
    private DEFAULT_KNOT_COLOR = [77,77,77];

    // action recorder
    private action: Action = Action.NO_ACTION;
    private isMouseDragged?: boolean = false ;
    private releasePt: Point = [0,0];

    // for drawing curve
    private drawnPts: Point[] = [];
    private drawnColorIdx: number = -1;
    
    private prevMousePt: Point = [0,0];

    // fving and stretching curve
    private movedCurveIdx?: number;
    private stretchMode?: string;
    private isMaxima?: boolean;

    // fving symbols
    private movedSymbol?: null; // TODO: WTF is this?
    private bindedKnot?: { [x: string]: any; };
    private symbolType?: string;

    private curves: Curve[] = [];
    private clickedKnot: any;
    private clickedKnotId?: number;
    private clickedCurve?: number;
    private clickedCurveIdx?: number;

    private scope: any = {};
    private canvas?: p5.Renderer;
    private elements: HTMLElement[] = [];
    private colorSelect?: HTMLSelectElement;

    constructor(p: p5, width: number, height: number) {
        this.p = p;

        this.p.touchStarted = this.touchStarted;
        this.p.mousePressed = this.mousePressed;
        this.p.touchMoved = this.touchMoved;
        this.p.mouseMoved = this.mouseMoved;
        this.p.mouseDragged = this.mouseDragged;
        this.p.touchEnded = this.touchEnded;
        this.p.mouseReleased = this.mouseReleased;

        this.p.windowResized = this.windowResized;

        this.p.setup = this.setup;

        this.canvasProperties = { width, height };
        this.graphView = new GraphView(p, width, height);
    }

    // run in the beginning by p5 library
    setup = () => {
        this.canvas = this.p.createCanvas(this.canvasProperties.width, this.canvasProperties.height);
        this.elements.push(document.getElementById("graph-sketcher-ui-redo") as HTMLElement);
        this.elements.push(document.getElementById("graph-sketcher-ui-undo") as HTMLElement);
        this.elements.push(document.getElementById("graph-sketcher-ui-poly") as HTMLElement);
        this.elements.push(document.getElementById("graph-sketcher-ui-straight") as HTMLElement);
        this.elements.push(document.getElementById("graph-sketcher-ui-trash-button") as HTMLElement);
        this.elements.push(document.getElementById("graph-sketcher-ui-submit") as HTMLElement);
        this.colorSelect = document.getElementById("graph-sketcher-ui-color-select") as HTMLSelectElement;
        this.elements.push(this.colorSelect);

        this.p.noLoop();
        this.p.cursor(this.p.ARROW);
        this.reDraw();
    }


    isOverButton = (pt: Point, button: HTMLElement) => {
        const rect = button.getBoundingClientRect();

        if (rect) {
            let left = rect.left;
            let top = rect.top;
            let width = rect.width;
            let height = rect.height;
            return (pt[0] > left && pt[0] < left + width && pt[1] > top && pt[1] < top + height);
        }
        return false;
    }

    // Mouse is inactive if over buttons - stops curves being drawn where they can't be seen
    isActive = (pt: Point) => {

        if (!(pt[0] > 0 && pt[0] < this.canvasProperties.width && pt[1] > 0 && pt[1] < this.canvasProperties.height)) {
            return false;
        }

        for (let i = 0; i < this.elements.length; i++) {
            if (this.isOverButton(pt, this.elements[i])) {
                return false;
            }
        }

        return true;
    }

    // Check if movement to new position is over an actionable object, so can render appropriately
    mouseMoved = (e: MouseEvent) => {
        let mousePosition: Point = GraphUtils.getMousePt(e);

        function detect(x: number, y: number) {
            return (Math.abs(mousePosition[0] - x) < 5 && Math.abs(mousePosition[1] - y) < 5);
        }

        // this function does not react if the mouse is over buttons or outside the canvas.
        if (!this.isActive(mousePosition)) {
            return;
        }

        let found = "notFound";

        if (found == "notFound") {
            found = GraphUtils.overItem(this.curves, e, this.MOUSE_DETECT_RADIUS, found);
            if (found == "overKnot") {
                this.p.cursor(this.p.HAND);
                return;
            } else if ((found == "overAttachedSymbol") || (found == "overFreeSymbol") || (found == "overCurve")) {
                this.p.cursor(this.p.MOVE);
                return;
            } else if (found == "notFound") {
                this.p.cursor(this.p.CROSS);
                this.reDraw();
            }
        }

        // stretch box
        if (this.clickedCurveIdx != null) {
            let c = this.curves[this.clickedCurveIdx];
            if (mousePosition[0] >= c.minX && mousePosition[0] <= c.maxX && mousePosition[1] >= c.minY && mousePosition[1] <= c.maxY) {
                // found = true;
                this.p.cursor(this.p.MOVE);
            } else if (detect(c.minX, c.minY) || detect(c.maxX, c.minY) || detect(c.minX, c.maxY) || detect(c.maxX, c.maxY)) {
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

                this.p.pop;

                // found = true;
                this.p.cursor(this.p.MOVE);
            } else if (detect((c.minX + c.maxX) / 2, c.minY - 3) || detect((c.minX + c.maxX) / 2, c.maxY + 3)
                || detect(c.minX - 3, (c.minY + c.maxY) / 2) || detect(c.maxX + 3, (c.minY + c.maxY) / 2)) {

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

                // found = true;
                this.p.cursor(this.p.MOVE);
            }
        }
    }

    // Determines type of action when clicking on something within the canvas
    mousePressed = (e: MouseEvent) => {

        this.isMouseDragged = false;
        // this.action = undefined;

        this.movedSymbol = undefined;
        this.bindedKnot = undefined;
        this.symbolType = undefined;

        this.drawnPts = [];
        // this.drawnColorIdx = undefined;

        this.movedCurveIdx = undefined;
        // this.prevMousePt = undefined;

        // this.releasePt = undefined;


        let mousePosition = GraphUtils.getMousePt(e);
        this.releasePt = mousePosition;

        // this function does not react if the mouse is over buttons or outside the canvas.
        if (!this.isActive(mousePosition)) {
            return;
        }

        function detect(x: number, y: number) {
            return (Math.abs(mousePosition[0] - x) < 5 && Math.abs(mousePosition[1] - y) < 5);
        }
        // record down mousePosition status, may be used later for undo.
        this.checkPoint = {};
        this.checkPoint.curvesJSON = JSON.stringify(this.curves);

        // let found = false;

        // check if stretching curve
        if (this.clickedCurveIdx != null) {
            let c = this.curves[this.clickedCurveIdx];

            if (detect(c.minX, c.minY) || detect(c.maxX, c.minY) || detect(c.minX, c.maxY) || detect(c.maxX, c.maxY)
                || detect((c.minX + c.maxX)/2, c.minY - 3) || detect((c.minX + c.maxX)/2, c.maxY + 3)
                || detect(c.minX - 3, (c.minY + c.maxY)/2) || detect(c.maxX + 3, (c.minY + c.maxY)/2)) {

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


                this.action = Action.STRETCH_CURVE;
                this.clickedKnot = null;
                this.prevMousePt = mousePosition;
                return;
            }
        }

        if (this.curves != []) {
            for (let i = 0; i < this.curves.length; i++) {
                let maxima = this.curves[i].maxima;
                let minima = this.curves[i].minima;
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
            let tc: Curve|null = null;
            for (let i = 0; i < this.curves.length; i++) {
                for (let j = 0; j < this.curves[i].pts.length; j++) {
                    if (GraphUtils.getDist(mousePosition, this.curves[i].pts[j]) < this.MOUSE_DETECT_RADIUS) {
                        this.clickedCurveIdx = i;
                        tc = this.curves[this.clickedCurveIdx];
                        break;
                    }
                }
            }
            if (tc) {
                if (mousePosition[0] >= tc.minX && mousePosition[0] <= tc.maxX && mousePosition[1] >= tc.minY && mousePosition[1] <= tc.maxY) {
                    this.movedCurveIdx = this.clickedCurveIdx;
                    this.action = Action.MOVE_CURVE;
                    this.clickedKnot = null;
                    this.prevMousePt = mousePosition;
                    return;
                }
            }
        }

        if (this.curves.length < this.CURVE_LIMIT){
            this.action = Action.DRAW_CURVE;
        }


        if (this.clickedCurveIdx != null || this.clickedKnot != null) {
            this.clickedCurveIdx = undefined;
            this.clickedKnot = null;
            this.reDraw();
        }

        // get drawnColor
        switch (this.colorSelect?.value) {
            case "Blue": {
                this.drawnColorIdx = 0;
                break;
            }
            case "Orange": {
                this.drawnColorIdx = 1;
                break;
            }
            case "Green": {
                this.drawnColorIdx = 2;
                break;
            }
            default:
                this.drawnColorIdx = 0;
                break;
        }
        return;
    }

    // Keep actions for curve manipulation together
    mouseDragged = (e: MouseEvent) => {
        this.isMouseDragged = true;
        let mousePosition = GraphUtils.getMousePt(e);
        this.releasePt = mousePosition;

        if (this.action == Action.STRETCH_POINT && this.clickedCurve) {
            let selectedCurve = this.curves[this.clickedCurve];
            // we need to know the (important) ordered end and turning points
            let importantPoints: any[] = [];
            if (selectedCurve.pts[0][0] > selectedCurve.pts[selectedCurve.pts.length - 1][0]) {
                selectedCurve.pts.reverse();
            }
            selectedCurve.endPt = GraphUtils.findEndPts(selectedCurve.pts);
            selectedCurve.maxima = GraphUtils.findTurnPts(selectedCurve.pts, 'maxima');
            selectedCurve.minima = GraphUtils.findTurnPts(selectedCurve.pts, 'minima');
            importantPoints.push.apply(importantPoints, selectedCurve.endPt);
            importantPoints.push.apply(importantPoints, selectedCurve.maxima);
            importantPoints.push.apply(importantPoints, selectedCurve.minima);
            importantPoints.sort(function(a, b){return a[0] - b[0]});

            // maxima and minima are treated in slightly different ways
            if (this.isMaxima !== null) {
                this.curves[this.clickedCurve] = GraphUtils.stretchTurningPoint(importantPoints, e, selectedCurve, this.isMaxima, this.clickedKnotId, this.prevMousePt, this.canvasProperties);
            }

            this.reDraw();
            this.prevMousePt = mousePosition;

        } else if (this.action == Action.MOVE_CURVE && this.movedCurveIdx) {
            this.p.cursor(this.p.MOVE);

            // scope.trashActive = isOverButton(mousePosition, element.find(".trash-button"));

            let dx = mousePosition[0] - this.prevMousePt[0];
            let dy = mousePosition[1] - this.prevMousePt[1];
            this.prevMousePt = mousePosition;
            GraphUtils.translateCurve(this.curves[this.movedCurveIdx], dx, dy, this.canvasProperties);
            this.reDraw();

        } else if (this.action == Action.STRETCH_CURVE && this.clickedCurveIdx) {
            this.p.cursor(this.p.MOVE);

            let dx = mousePosition[0] - this.prevMousePt[0];
            let dy = mousePosition[1] - this.prevMousePt[1];
            this.prevMousePt = mousePosition;

            let currentCurve = this.curves[this.clickedCurveIdx];

            // calculate old x,y range
            let orx = currentCurve.maxX - currentCurve.minX;
            let ory = currentCurve.maxY - currentCurve.minY;

            this.graphView.drawCorner(this.stretchMode, currentCurve);

            // update the position of stretched vertex
            switch (this.stretchMode) {
                case "bottomLeft": {
                    if (orx < 30 && dx > 0  || ory < 30 && dy > 0) {
                        return;
                    }
                    currentCurve.minX += dx;
                    currentCurve.minY += dy;
                    break;
                }
                case "bottomRight": {
                    if (orx < 30 && dx < 0 || ory < 30 && dy > 0) {
                        return;
                    }
                    currentCurve.maxX += dx;
                    currentCurve.minY += dy;
                    break;
                }
                case "topRight": {
                    if (orx < 30 && dx < 0 || ory < 30 && dy < 0) {
                        return;
                    }
                    currentCurve.maxX += dx;
                    currentCurve.maxY += dy;
                    break;
                }
                case "topLeft": {
                    if (orx < 30 && dy > 0 || ory < 30 && dy < 0) {
                        return;
                    }
                    currentCurve.minX += dx;
                    currentCurve.maxY += dy;
                    break;
                }
                case "bottomMiddle": {
                    if ( ory < 30 && dy > 0) {
                        return;
                    }
                    currentCurve.minY += dy;
                    break;
                }
                case "topMiddle": {
                    if (ory < 30 && dy < 0) {
                        return;
                    }
                    currentCurve.maxY += dy;
                    break;
                }
                case "leftMiddle": {
                    if (orx < 30 && dx > 0) {
                        return;
                    }
                    currentCurve.minX += dx;
                    break;
                }
                case "rightMiddle": {
                    if (orx < 30 && dx < 0) {
                        return;
                    }
                    currentCurve.maxX += dx;
                    break;
                }
            }

            // calculate the new range
            let nrx = currentCurve.maxX - currentCurve.minX;
            let nry = currentCurve.maxY - currentCurve.minY;

            // stretch the curve
            switch (this.stretchMode) {
                case "bottomLeft": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, nry, currentCurve.maxX, currentCurve.maxY, this.canvasProperties);
                    break;
                }
                case "bottomRight": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, nry, currentCurve.minX, currentCurve.maxY, this.canvasProperties);
                    break;
                }
                case "topRight": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, nry, currentCurve.minX, currentCurve.minY, this.canvasProperties);
                    break;
                }
                case "topLeft": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, nry, currentCurve.maxX, currentCurve.minY, this.canvasProperties);
                    break;
                }
                case "bottomMiddle": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, orx, nry, (currentCurve.minX + currentCurve.maxX)/2, currentCurve.maxY, this.canvasProperties);
                    break;
                }
                case "topMiddle": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, orx, nry, (currentCurve.minX + currentCurve.maxX)/2, currentCurve.minY, this.canvasProperties);
                    break;
                }
                case "leftMiddle": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, ory, currentCurve.maxX, (currentCurve.minY + currentCurve.maxY)/2, this.canvasProperties);
                    break;
                }
                case "rightMiddle": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, ory, currentCurve.minX, (currentCurve.minY + currentCurve.maxY)/2, this.canvasProperties);
                    break;
                }
            }
            this.reDraw();
            this.graphView.drawCorner(this.stretchMode, currentCurve);

        } else if (this.action == Action.DRAW_CURVE && this.drawnColorIdx >= 0) {
            this.p.cursor(this.p.CROSS);
            if (this.curves.length < this.CURVE_LIMIT) {
                this.p.push();
                this.p.stroke(this.graphView.CURVE_COLORS[this.drawnColorIdx]);
                this.p.strokeWeight(this.graphView.CURVE_STRKWEIGHT);
                if (this.drawnPts.length > 0) {
                    let precedingPoint = this.drawnPts[this.drawnPts.length - 1];
                    this.p.line(precedingPoint[0], precedingPoint[1], mousePosition[0], mousePosition[1]);
                }
                this.p.pop();
                this.drawnPts.push(mousePosition);
            }
        }
    }

    // Need to know where to update points to - gives final position
    mouseReleased = (_e: MouseEvent) => {
        let mousePosition = this.releasePt;

        // if it is just a click, handle click in the following if block
        if (!this.isMouseDragged) {

            // clean up the mess of MOVE_SYMBOL and MOVE_CURVE
            if (this.action  == Action.MOVE_SYMBOL) {
                if (this.bindedKnot == null) {
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
            for (let i = 0; i < this.curves.length; i++) {
                let pts = this.curves[i].pts;
                for (let j = 0; j < pts.length; j++) {
                    if (GraphUtils.getDist(pts[j], mousePosition) < this.MOUSE_DETECT_RADIUS) {
                        this.clickedCurveIdx = i;
                        this.reDraw();
                        return;
                    }
                }
            }


            if (this.clickedKnot != null || this.clickedCurveIdx != null) {
                this.clickedKnot = null;
                this.clickedCurveIdx = undefined;
                this.reDraw();
            }

            return;
        }

        if (this.action == Action.MOVE_CURVE) {

            this.checkPointsUndo.push(this.checkPoint);
            this.checkPointsRedo = [];

            // for deletion
            // if (scope.trashActive) {
            //     let curve = (this.curves.splice(this.movedCurveIdx, 1))[0];

            //     this.clickedCurveIdx = null;
            // }

            // scope.trashActive = false;
            // scope.$apply();
            this.reDraw();

        } else if (this.action == Action.STRETCH_CURVE) {
            this.checkPointsUndo.push(this.checkPoint);
            this.checkPointsRedo = [];

            // let c = this.curves[this.clickedCurveIdx];

        } else if (this.action == Action.STRETCH_POINT) {
            this.checkPointsUndo.push(this.checkPoint);
            this.checkPointsRedo = [];

            // let c = this.curves[this.clickedCurveIdx];

        } else if (this.action == Action.DRAW_CURVE) {

            if (this.curves.length < this.CURVE_LIMIT){

                let curve = new Curve();

                if (GraphUtils.sample(this.drawnPts).length < 3) {
                    return;
                }

                this.checkPointsUndo.push(this.checkPoint);
                this.checkPointsRedo = [];
                // scope.$apply();

                // adjustment of start and end to attach to the axis automatically.
                if (Math.abs(this.drawnPts[0][1] - this.canvasProperties.height/2) < 3) {
                    this.drawnPts[0][1] = this.canvasProperties.height/2;
                }
                if (Math.abs(this.drawnPts[0][0] - this.canvasProperties.width/2) < 3) {
                    this.drawnPts[0][0] = this.canvasProperties.width/2;
                }
                if (Math.abs(this.drawnPts[this.drawnPts.length - 1][1] - this.canvasProperties.height/2) < 3) {
                    this.drawnPts[this.drawnPts.length - 1][1] = this.canvasProperties.height/2;
                }
                if (Math.abs(this.drawnPts[this.drawnPts.length - 1][0] - this.canvasProperties.width/2) < 3) {
                    this.drawnPts[this.drawnPts.length - 1][0] = this.canvasProperties.width/2;
                }

                let pts = [];
                if (this.scope.selectedLineType == "bezier") {
                    pts = GraphUtils.bezierLineStyle(GraphUtils.sample(this.drawnPts));
                } else if (this.scope.selectedLineType == "linear") {
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
                curve.interX = GraphUtils.findInterceptX(this.canvasProperties.height, pts);
                curve.interY = GraphUtils.findInterceptY(this.canvasProperties.width, pts);
                if (this.scope.selectedLineType == "bezier") {
                    curve.maxima = GraphUtils.findTurnPts(pts, 'maxima');
                    curve.minima = GraphUtils.findTurnPts(pts, 'minima');
                } else {
                    curve.maxima = [];
                    curve.minima = [];
                }
                curve.colorIdx = this.drawnColorIdx;

                this.curves.push(curve);
                this.reDraw();
            }

            return;
        }
    }

    // Would like to be used on touch screen devices, this simply facilitates it
    touchStarted = (e: TouchEvent) => {
        this.p.mousePressed(e.touches[0]);
    }

    touchMoved = (e: TouchEvent) => {
        this.p.mouseDragged(e.touches[0]);
    }

    touchEnded = (e: TouchEvent) => {
        this.p.mouseReleased(e);
    }

    windowResized = () => {
        let data = GraphUtils.encodeData(false, this.canvasProperties, this.curves);
        this.canvasProperties.width = window.innerWidth;
        this.canvasProperties.height = window.innerHeight;
        this.p.resizeCanvas(window.innerWidth, window.innerHeight);
        GraphUtils.decodeData(data, this.canvasProperties.width, this.canvasProperties.height);
        this.reDraw();
    }

    // TODO: Delete key here
    // window.onkeydown = function(event) {
    //     if (event.keyCode == 46) { // delete key
    //         this.p.checkPointsUndo.push(p.checkPoint);
    //         this.p.checkPointsRedo = [];
    //         if (this.clickedCurveIdx != null) {
    //             let curve = (this.curves.splice(this.clickedCurveIdx, 1))[0];

    //             this.clickedCurveIdx = null;
    //             reDraw();
    //         }
    //     }
    // }

    // equivalent to 'locally' refreshing the canvas
    reDraw = () => {
        if (this.curves.length < 4) {
            this.graphView.drawBackground(this.canvasProperties.width, this.canvasProperties.height);
            this.graphView.drawCurves(this.curves);
            this.graphView.drawStretchBox(this.clickedCurveIdx, this.curves);
            // this.scope.state = GraphUtils.encodeData(true, this.canvasProperties, this.curves);
        }
    };
}

export function makeGraphSketcher(element: HTMLElement | undefined, width: number, height: number) {
    let sketch: GraphSketcher|null = null;
    let p = new p5(instance => {
        sketch = new GraphSketcher(instance, width, height);
        return sketch;
    }, element);
    return { sketch, p };
}

export * from './GraphView';