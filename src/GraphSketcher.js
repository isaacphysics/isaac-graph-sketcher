import p5 from 'p5';
import GraphView from './GraphView';
import * as GraphUtils from './GraphUtils';

const s = (p, _width, _height) => {

    // canvas coefficients
    let canvasProperties = {width: _width, height: _height};

    const MOVE_SYMBOL_COLOR = [151];
    const CURVE_LIMIT = 3;
    const MOUSE_DETECT_RADIUS = 10;
    const DEFAULT_KNOT_COLOR = [77,77,77];

    // action recorder
    let action = undefined;
    let isMouseDragged;
    let releasePt;
    let key = undefined;

    // for drawing curve
    let drawnPts = [];
    let drawnColorIdx;
    let lineStart;
    let lineEnd;

    let prevMousePt;

    // for moving and stretching curve
    let movedCurveIdx;
    let stretchMode;
    let isMaxima = undefined;


    // for moving symbols
    let movedSymbol;
    let bindedKnot;
    let symbolType;


    // for redo and undo
    p.checkPoint;
    p.checkPointsUndo = [];
    p.checkPointsRedo = [];

    // For visualisation using GraphView.js methods
    let graphView = new GraphView(p, _width, _height);

    let curves = [];
    let clickedKnot = null;
    let clickedKnotId;
    let clickedCurve;
    let clickedCurveIdx;

    let scope = {};
    let canvas;

    function isOverButton(pt, button) {
        if (button.position() == undefined) {
            return false;
        }

        let left = button.position().left;
        let top = button.position().top;
        let width = button.width();
        let height = button.height();
        return (pt[0] > left && pt[0] < left + width && pt[1] > top && pt[1] < top + height);
    }

    // Mouse is inactive if over buttons - stops curves being drawn where they can't be seen
    function isActive(pt) {

        if (!(pt[0] > 0 && pt[0] < canvasProperties.width && pt[1] > 0 && pt[1] < canvasProperties.height)) {
            return false;
        }

        let elements = [];
        elements.push(document.getElementById("graph-sketcher-ui-redo"));
        elements.push(document.getElementById("graph-sketcher-ui-undo"));
        elements.push(document.getElementById("graph-sketcher-ui-poly"));
        elements.push(document.getElementById("graph-sketcher-ui-straight"));
        elements.push(document.getElementById("graph-sketcher-ui-trash-button"));
        elements.push(document.getElementById("graph-sketcher-ui-submit"));
        elements.push(document.getElementById("graph-sketcher-ui-color-select"));

        for (let i = 0; i < elements.length; i++) {
            if (isOverButton(pt, elements[i])) {
                return false;
            }
        }

        return true;
    }

    // run in the beginning by p5 library
    p.setup = function() {
        canvas = p.createCanvas(canvasProperties.width, canvasProperties.height);
        p.noLoop();
        p.cursor(p.ARROW);
        reDraw();
    }

    // Check if movement to new position is over an actionable object, so can render appropriately
    p.mouseMoved = function(e) {
        let mousePosition = GraphUtils.getMousePt(e);

        function detect(x, y) {
            return (Math.abs(mousePosition[0] - x) < 5 && Math.abs(mousePosition[1] - y) < 5);
        }

        // this function does not react if the mouse is over buttons or outside the canvas.
        if (!isActive(mousePosition)) {
            return;
        }

        let found = "notFound";

        if (found == "notFound") {
            found = GraphUtils.overItem(curves, e, MOUSE_DETECT_RADIUS, found);
            if (found == "overKnot") {
                p.cursor(p.HAND);
                return;
            } else if ((found == "overAttachedSymbol") || (found == "overFreeSymbol") || (found == "overCurve")) {
                p.cursor(p.MOVE);
                return;
            } else if (found == "notFound") {
                p.cursor(p.CROSS);
                reDraw();
            }
        }

        // stretch box
        if (clickedCurveIdx != undefined) {
            let c = curves[clickedCurveIdx];
            if (mousePosition[0] >= c.minX && mousePosition[0] <= c.maxX && mousePosition[1] >= c.minY && mousePosition[1] <= c.maxY) {
                found = true;
                p.cursor(p.MOVE);
            } else if (detect(c.minX, c.minY) || detect(c.maxX, c.minY) || detect(c.minX, c.maxY) || detect(c.maxX, c.maxY)) {
                p.push();
                p.fill(graphView.KNOT_DETECT_COLOR);
                if (detect(c.minX, c.minY)) {
                    p.rect(c.minX - 4, c.minY - 4, 8, 8);
                } else if (detect(c.maxX, c.minY)) {
                    p.rect(c.maxX - 4, c.minY - 4, 8, 8);
                } else if (detect(c.minX, c.maxY)) {
                    p.rect(c.minX - 4, c.maxY - 4, 8, 8);
                } else {
                    p.rect(c.maxX - 4, c.maxY - 4, 8, 8);
                }

                p.pop;

                found = true;
                p.cursor(p.MOVE);
            } else if (detect((c.minX + c.maxX) / 2, c.minY - 3) || detect((c.minX + c.maxX) / 2, c.maxY + 3)
                || detect(c.minX - 3, (c.minY + c.maxY) / 2) || detect(c.maxX + 3, (c.minY + c.maxY) / 2)) {

                p.push();
                p.fill(graphView.KNOT_DETECT_COLOR);
                if (detect((c.minX + c.maxX) / 2, c.minY - 3)) {
                    p.triangle((c.minX + c.maxX) / 2 - 5, c.minY - 2, (c.minX + c.maxX) / 2 + 5, c.minY - 2, (c.minX + c.maxX) / 2, c.minY - 7);
                } else if (detect((c.minX + c.maxX) / 2, c.maxY + 3)) {
                    p.triangle((c.minX + c.maxX) / 2 - 5, c.maxY + 2, (c.minX + c.maxX) / 2 + 5, c.maxY + 2, (c.minX + c.maxX) / 2, c.maxY + 7);
                } else if (detect(c.minX - 3, (c.minY + c.maxY) / 2)) {
                    p.triangle(c.minX - 2, (c.minY + c.maxY) / 2 - 5, c.minX - 2, (c.minY + c.maxY) / 2 + 5, c.minX - 7, (c.minY + c.maxY) / 2);
                } else {
                    p.triangle(c.maxX + 2, (c.minY + c.maxY) / 2 - 5, c.maxX + 2, (c.minY + c.maxY) / 2 + 5, c.maxX + 7, (c.minY + c.maxY) / 2);
                }
                p.pop();

                found = true;
                p.cursor(p.MOVE);
            }
        }
    }

    // Determines type of action when clicking on something within the canvas
    p.mousePressed = function(e) {

        isMouseDragged = false;
        action = undefined;

        movedSymbol = undefined;
        bindedKnot = undefined;
        symbolType = undefined;

        drawnPts = [];
        drawnColorIdx = undefined;

        movedCurveIdx = undefined;
        prevMousePt = undefined;

        releasePt = undefined;


        let mousePosition = GraphUtils.getMousePt(e);
        releasePt = mousePosition;

        // this function does not react if the mouse is over buttons or outside the canvas.
        if (!isActive(mousePosition)) {
            return;
        }

        function detect(x, y) {
            return (Math.abs(mousePosition[0] - x) < 5 && Math.abs(mousePosition[1] - y) < 5);
        }
        // record down mousePosition status, may be used later for undo.
        p.checkPoint = {};
        p.checkPoint.curvesJSON = JSON.stringify(curves);

        let found = false;

        // check if stretching curve
        if (clickedCurveIdx != undefined) {
            let c = curves[clickedCurveIdx];

            if (detect(c.minX, c.minY) || detect(c.maxX, c.minY) || detect(c.minX, c.maxY) || detect(c.maxX, c.maxY)
                || detect((c.minX + c.maxX)/2, c.minY - 3) || detect((c.minX + c.maxX)/2, c.maxY + 3)
                || detect(c.minX - 3, (c.minY + c.maxY)/2) || detect(c.maxX + 3, (c.minY + c.maxY)/2)) {

                if (detect(c.minX, c.minY)) {
                    stretchMode = "bottomLeft";
                } else if (detect(c.maxX, c.minY)) {
                    stretchMode = "bottomRight";
                } else if (detect(c.maxX, c.maxY)) {
                    stretchMode = "topRight";
                } else if (detect(c.minX, c.maxY)) {
                    stretchMode = "topLeft";
                } else if (detect((c.minX + c.maxX)/2, c.minY - 3)) {
                    stretchMode = "bottomMiddle";
                } else if (detect((c.minX + c.maxX)/2, c.maxY + 3)) {
                    stretchMode = "topMiddle";
                } else if (detect(c.minX - 3, (c.minY + c.maxY)/2)) {
                    stretchMode = "leftMiddle";
                } else {
                    stretchMode = "rightMiddle";
                }


                action = "STRETCH_CURVE";
                clickedKnot = null;
                prevMousePt = mousePosition;
                return;
            }
        }

        if (curves != []) {
            for (let i = 0; i < curves.length; i++) {
                let maxima = curves[i].maxima;
                let minima = curves[i].minima;
                for (let j = 0; j < maxima.length; j++) {
                    let knot = maxima[j];
                    if (GraphUtils.getDist(mousePosition, knot) < MOUSE_DETECT_RADIUS + 10){
                        clickedCurve = i;
                        action = "STRETCH_POINT";
                        clickedKnotId = j;
                        prevMousePt = mousePosition;
                        isMaxima = true;
                        return;
                    }
                }
                for (let j = 0; j < minima.length; j++) {
                    let knot = minima[j];
                    if (GraphUtils.getDist(mousePosition, knot) < MOUSE_DETECT_RADIUS + 10){
                        clickedCurve = i;
                        action = "STRETCH_POINT";
                        clickedKnotId = j;
                        prevMousePt = mousePosition;
                        isMaxima = false;
                        return;
                    }
                }
            }
            let tc = [];
            for (let i = 0; i < curves.length; i++) {
                for (let j = 0; j < curves[i].pts.length; j++) {
                    if (GraphUtils.getDist(mousePosition, curves[i].pts[j]) < MOUSE_DETECT_RADIUS) {
                        clickedCurveIdx = i;
                        tc = curves[clickedCurveIdx];
                        break;
                    }
                }
            }
            if (tc != undefined) {
                if (mousePosition[0] >= tc.minX && mousePosition[0] <= tc.maxX && mousePosition[1] >= tc.minY && mousePosition[1] <= tc.maxY) {
                    movedCurveIdx = clickedCurveIdx;
                    action = "MOVE_CURVE";
                    clickedKnot = null;
                    prevMousePt = mousePosition;
                    return;
                }
            }
        }

        if (curves.length < CURVE_LIMIT){
            action = "DRAW_CURVE";
        }


        if (clickedCurveIdx != undefined || clickedKnot != null) {
            clickedCurveIdx = undefined;
            clickedKnot = null;
            reDraw();
        }

        // get drawnColor
        switch (colorSelect.value) {
            case "Blue": {
                drawnColorIdx = 0;
                break;
            }
            case "Orange": {
                drawnColorIdx = 1;
                break;
            }
            case "Green": {
                drawnColorIdx = 2;
                break;
            }
        }
        return;
    }

    // Keep actions for curve manipulation together
    p.mouseDragged = function(e) {
        isMouseDragged = true;
        let mousePosition = GraphUtils.getMousePt(e);
        releasePt = mousePosition;

        if (action == "STRETCH_POINT") {
            let selectedCurve = curves[clickedCurve];
            // we need to know the (important) ordered end and turning points
            let importantPoints = [];
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
            if (isMaxima !== undefined) {
                curves[clickedCurve] = GraphUtils.stretchTurningPoint(importantPoints, e, selectedCurve, isMaxima, clickedKnotId, prevMousePt, canvasProperties);
            }

            reDraw();
            prevMousePt = mousePosition;

        } else if (action == "MOVE_CURVE") {
            p.cursor(p.MOVE);

            // scope.trashActive = isOverButton(mousePosition, element.find(".trash-button"));

            let dx = mousePosition[0] - prevMousePt[0];
            let dy = mousePosition[1] - prevMousePt[1];
            prevMousePt = mousePosition;
            GraphUtils.translateCurve(curves[movedCurveIdx], dx, dy, canvasProperties);
            reDraw();

        } else if (action == "STRETCH_CURVE") {
            p.cursor(p.MOVE);

            let dx = mousePosition[0] - prevMousePt[0];
            let dy = mousePosition[1] - prevMousePt[1];
            prevMousePt = mousePosition;

            let currentCurve = curves[clickedCurveIdx];

            // calculate old x,y range
            let orx = currentCurve.maxX - currentCurve.minX;
            let ory = currentCurve.maxY - currentCurve.minY;

            graphView.drawCorner(stretchMode, currentCurve);

            // update the position of stretched vertex
            switch (stretchMode) {
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
            switch (stretchMode) {
                case "bottomLeft": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, nry, currentCurve.maxX, currentCurve.maxY, canvasProperties);
                    break;
                }
                case "bottomRight": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, nry, currentCurve.minX, currentCurve.maxY, canvasProperties);
                    break;
                }
                case "topRight": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, nry, currentCurve.minX, currentCurve.minY, canvasProperties);
                    break;
                }
                case "topLeft": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, nry, currentCurve.maxX, currentCurve.minY, canvasProperties);
                    break;
                }
                case "bottomMiddle": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, orx, nry, (currentCurve.minX + currentCurve.maxX)/2, currentCurve.maxY, canvasProperties);
                    break;
                }
                case "topMiddle": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, orx, nry, (currentCurve.minX + currentCurve.maxX)/2, currentCurve.minY, canvasProperties);
                    break;
                }
                case "leftMiddle": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, ory, currentCurve.maxX, (currentCurve.minY + currentCurve.maxY)/2, canvasProperties);
                    break;
                }
                case "rightMiddle": {
                    GraphUtils.stretchCurve(currentCurve, orx, ory, nrx, ory, currentCurve.minX, (currentCurve.minY + currentCurve.maxY)/2, canvasProperties);
                    break;
                }
            }
            reDraw();
            graphView.drawCorner(stretchMode, currentCurve);

        } else if (action == "DRAW_CURVE") {
            p.cursor(p.CROSS);
            if (curves.length < CURVE_LIMIT) {
                p.push();
                p.stroke(graphView.CURVE_COLORS[drawnColorIdx]);
                p.strokeWeight(graphView.CURVE_STRKWEIGHT);
                if (drawnPts.length > 0) {
                    let precedingPoint = drawnPts[drawnPts.length - 1];
                    p.line(precedingPoint[0], precedingPoint[1], mousePosition[0], mousePosition[1]);
                }
                p.pop();
                drawnPts.push(mousePosition);
            }
        }
    }

    // Need to know where to update points to - gives final position
    p.mouseReleased = function(_e) {
        let mousePosition = releasePt;

        // if it is just a click, handle click in the following if block
        if (!isMouseDragged) {

            // clean up the mess of MOVE_SYMBOL and MOVE_CURVE
            if (action  == "MOVE_SYMBOL") {
                if (bindedKnot == undefined) {
                    freeSymbols.push(movedSymbol);
                } else {
                    bindedKnot[symbolType] = movedSymbol;
                }
                reDraw();

            } else if (action == "MOVE_CURVE" || action == "STRETCH_CURVE" || action == "STRETCH_POINT") {
                reDraw();
            }

            // click do not respond in inactive area (eg buttons)
            if (!isActive(mousePosition)) {
                return;
            }


            // check if show stretch box
            for (let i = 0; i < curves.length; i++) {
                let pts = curves[i].pts;
                for (let j = 0; j < pts.length; j++) {
                    if (GraphUtils.getDist(pts[j], mousePosition) < MOUSE_DETECT_RADIUS) {
                        clickedCurveIdx = i;
                        reDraw();
                        return;
                    }
                }
            }


            if (clickedKnot != null || clickedCurveIdx != undefined) {
                clickedKnot = null;
                clickedCurveIdx = undefined;
                reDraw();
            }

            return;
        }

        if (action == "MOVE_CURVE") {

            p.checkPointsUndo.push(p.checkPoint);
            p.checkPointsRedo = [];

            // for deletion
            // if (scope.trashActive) {
            //     let curve = (curves.splice(movedCurveIdx, 1))[0];

            //     clickedCurveIdx = undefined;
            // }

            // scope.trashActive = false;
            // scope.$apply();
            reDraw();

        } else if (action == "STRETCH_CURVE") {
            p.checkPointsUndo.push(p.checkPoint);
            p.checkPointsRedo = [];

            // let c = curves[clickedCurveIdx];

        } else if (action == "STRETCH_POINT") {
            p.checkPointsUndo.push(p.checkPoint);
            p.checkPointsRedo = [];

            // let c = curves[clickedCurveIdx];

        } else if (action == "DRAW_CURVE") {

            if (curves.length < CURVE_LIMIT){

                let curve;

                if (GraphUtils.sample(drawnPts).length < 3) {
                    return;
                }

                p.checkPointsUndo.push(p.checkPoint);
                p.checkPointsRedo = [];
                // scope.$apply();

                // adjustment of start and end to attach to the axis automatically.
                if (Math.abs(drawnPts[0][1] - canvasProperties.height/2) < 3) {
                    drawnPts[0][1] = canvasProperties.height/2;
                }
                if (Math.abs(drawnPts[0][0] - canvasProperties.width/2) < 3) {
                    drawnPts[0][0] = canvasProperties.width/2;
                }
                if (Math.abs(drawnPts[drawnPts.length - 1][1] - canvasProperties.height/2) < 3) {
                    drawnPts[drawnPts.length - 1][1] = canvasProperties.height/2;
                }
                if (Math.abs(drawnPts[drawnPts.length - 1][0] - canvasProperties.width/2) < 3) {
                    drawnPts[drawnPts.length - 1][0] = canvasProperties.width/2;
                }

                let pts = [];
                if (scope.selectedLineType == "bezier") {
                    pts = GraphUtils.bezierLineStyle(GraphUtils.sample(drawnPts));
                } else if (scope.selectedLineType == "linear") {
                    pts = GraphUtils.linearLineStyle([drawnPts[0],drawnPts[drawnPts.length-1]])
                }
                curve = {};
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
                curve.interX = GraphUtils.findInterceptX(canvasProperties.height, pts);
                curve.interY = GraphUtils.findInterceptY(canvasProperties.width, pts);
                if (scope.selectedLineType == "bezier") {
                    curve.maxima = GraphUtils.findTurnPts(pts, 'maxima');
                    curve.minima = GraphUtils.findTurnPts(pts, 'minima');
                } else {
                    curve.maxima = [];
                    curve.minima = [];
                }
                curve.colorIdx = drawnColorIdx;

                curves.push(curve);
                reDraw();
            }

            return;
        }
    }

    // Would like to be used on touch screen devices, this simply facilitates it
    p.touchStarted = function(e) {
        p.mousePressed(e.touches[0]);
    }

    p.touchMoved = function(e) {
        p.mouseDragged(e.touches[0]);
    }

    p.touchEnded = function(e) {
        p.mouseReleased(e);
    }

    p.windowResized = function() {
        let data = GraphUtils.encodeData(false, canvasProperties, curves);
        canvasProperties.width = window.innerWidth;
        canvasProperties.height = window.innerHeight;
        p.resizeCanvas(window.innerWidth, window.innerHeight);
        GraphUtils.decodeData(data, canvasProperties.width, canvasProperties.height);
        reDraw();
    }

    window.onkeydown = function(event) {
        if (event.keyCode == 46) { // delete key
            p.checkPointsUndo.push(p.checkPoint);
            p.checkPointsRedo = [];
            if (clickedCurveIdx != undefined) {
                let curve = (curves.splice(clickedCurveIdx, 1))[0];

                clickedCurveIdx = undefined;
                reDraw();
            }
        }
    }

    // equivalent to 'locally' refreshing the canvas
    const reDraw = function() {
        if (curves.length < 4) {
            graphView.drawBackground(canvasProperties.width, canvasProperties.height);
            graphView.drawCurves(curves);
            graphView.drawStretchBox(clickedCurveIdx, curves);
            scope.state = GraphUtils.encodeData(true, canvasProperties, curves);
        }
    };
}

export function makeGraphSketcher(element, width, height) {
    let sketch;
    let p = new p5(instance => {
        sketch = new s(instance, width, height);
        return sketch;
    }, element);
    return { sketch, p };
}

export * from './GraphView';