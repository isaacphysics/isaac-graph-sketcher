import * as graphUtils from './GraphUtils';

// These should probably be class properties but the support is experimental and not enabled in Babel by default.

// self explanatory drawing methods
export default class GraphView {

    canvasHeight = window.innerHeight;
    canvasWidth = window.innerWidth;

    DOT_LINE_COLOR = [123];
    DEFAULT_KNOT_COLOR = [77,77,77];

    GRID_WIDTH = 60;
    DOT_LINE_STEP = 5;
    PADDING;

    CURVE_COLORS = [[93,165,218], [250,164,58], [96,189,104], [241,124,176], [241,88,84], [178,118,178]];
    CURVE_STRKWEIGHT = 2;
    KNOT_DETECT_COLOR = [0];

    constructor(p, width, height) {
        this.p = p;
        this.canvasWidth = width;
        this.canvasHeight = height;
        this.PADDING = 0.025 * this.canvasWidth;
    }        

    drawCurves(curves, color) {
        for (let i = 0; i < curves.length; i++) {
            this.drawCurve(curves[i], color);
        }
    }

    drawCurve(curve, color) {
        if (color == undefined) {
            color = this.CURVE_COLORS[curve.colorIdx];
        }

        this.p.push();
        this.p.stroke(color);
        this.p.strokeWeight(this.CURVE_STRKWEIGHT);

        // want to connect closest points x,y wise, not just x wise
        let pts = curve.pts;
        for (let i = 1; i < pts.length; i++) {
            if (pts[i][0] - pts[i-1][0] < 100 && pts[i][1] - pts[i-1][1] < 100) {// 100 chosen as close enough to reliably be the same curve
                this.p.line(pts[i-1][0], pts[i-1][1], pts[i][0], pts[i][1]);
            }
        }

        this.p.pop();

        curve.endPt = graphUtils.findEndPts(curve.pts);
        // draw x intercepts, y intercepts and turning points
        this.drawKnots(curve['interX']);
        this.drawKnots(curve['interY']);
        this.drawKnots(curve['maxima']);
        this.drawKnots(curve['minima']);
    }

    drawKnots(knots, color) {
        for (let i = 0; i < knots.length; i++) {
            this.drawKnot(knots[i], color);
        }
    }

    drawKnot(knot, color) {
        if (color == undefined) {
            color = this.DEFAULT_KNOT_COLOR;
        }
        if (knot.symbol != undefined) {
            this.drawSymbol(knot.symbol);
        } else {
            this.p.push();
            this.p.noFill();
            this.p.stroke(color);
            this.p.strokeWeight(1.5);
            this.p.line(knot[0] - 3, knot[1] - 3, knot[0] + 3, knot[1] + 3);
            this.p.line(knot[0] + 3, knot[1] - 3, knot[0] - 3, knot[1] + 3);
            this.p.pop();
        }
    }

    drawDetectedKnot(knot) {
        if (typeof knot !==  "undefined") {
            this.p.push();
            this.p.noFill();
            this.p.stroke(this.KNOT_DETECT_COLOR);
            this.p.strokeWeight(2);
            this.p.line(knot[0] - 5, knot[1] - 5, knot[0] + 5, knot[1] + 5);
            this.p.line(knot[0] + 5, knot[1] - 5, knot[0] - 5, knot[1] + 5);
            this.p.pop();
        }
    }

    drawVerticalDotLine(x, begin, end) {
        if (x < 0 || x > this.canvasWidth) {
            return;
        }

        if (begin > end) {
            let tmp = begin;
            begin = end;
            end = tmp;
        }

        this.p.push();
        this.p.stroke(this.DOT_LINE_COLOR);
        this.p.strokeWeight(this.CURVE_STRKWEIGHT);

        let step = this.DOT_LINE_STEP;
        let toDraw = true;
        let y = begin;
        while (y + step < end) {
            if (toDraw) {
                this.p.line(x, y, x, y+step);
            }
            y += step;
            toDraw = !toDraw;
        }
        if (toDraw) {
            this.p.line(x, y, x, end);
        }

        this.p.pop();
    }

    drawHorizontalDotLine(y, begin, end) {
        if (y < 0 || y > this.canvasHeight) {
            return;
        }

        if (begin > end) {
            let tmp = begin;
            begin = end;
            end = tmp;
        }

        this.p.push();
        this.p.stroke(this.DOT_LINE_COLOR);
        this.p.strokeWeight(this.CURVE_STRKWEIGHT);

        let step = this.DOT_LINE_STEP;
        let toDraw = true;
        let x = begin;
        while (x + step < end) {
            if (toDraw) {
                p.line(x, y, x+step, y);
            }
            x += step;
            toDraw = !toDraw;
        }
        if (toDraw) {
            this.p.line(x, y, end, y);
        }

        this.p.pop();
    }

    drawStretchBox(idx, curves) {
        if (idx == undefined) {
            return;
        }

        if (curves[idx] == undefined) {
            return;
        }

        let curve = curves[idx];

        let minX = curve.minX;
        let maxX = curve.maxX;
        let minY = curve.minY;
        let maxY = curve.maxY;

        this.p.push();
        this.p.stroke(this.DOT_LINE_COLOR);
        this.p.strokeWeight(0.5);
        this.p.line(minX, minY, maxX, minY);
        this.p.line(maxX, minY, maxX, maxY);
        this.p.line(maxX, maxY, minX, maxY);
        this.p.line(minX, maxY, minX, minY);

        this.p.fill(255);
        this.p.rect(minX - 4, minY - 4, 8, 8);
        this.p.rect(maxX - 4, minY - 4, 8, 8);
        this.p.rect(minX - 4, maxY - 4, 8, 8);
        this.p.rect(maxX - 4, maxY - 4, 8, 8);
        this.p.triangle((minX + maxX)/2 - 5, minY - 2, (minX + maxX)/2 + 5, minY - 2, (minX + maxX)/2, minY - 7);
        this.p.triangle((minX + maxX)/2 - 5, maxY + 2, (minX + maxX)/2 + 5, maxY + 2, (minX + maxX)/2, maxY + 7);
        this.p.triangle(minX - 2, (minY + maxY) / 2 - 5, minX - 2, (minY + maxY) / 2 + 5, minX - 7, (minY + maxY) / 2);
        this.p.triangle(maxX + 2, (minY + maxY) / 2 - 5, maxX + 2, (minY + maxY) / 2 + 5, maxX + 7, (minY + maxY) / 2); 
        this.p.pop();
    }

    drawHorizontalAxis(curveStrokeWeight, passed_width, passed_height) {
        if (passed_width && passed_height) {
            this.canvasHeight = passed_height;
            this.canvasWidth = passed_width;
        }
        this.p.push();

        this.p.strokeWeight(curveStrokeWeight);
        this.p.strokeJoin(this.p.ROUND);
        this.p.stroke(0);
        this.p.noFill();

        let leftMargin = this.PADDING;
        let rightMargin = this.canvasWidth - this.PADDING;

        this.p.beginShape();
        this.p.vertex(leftMargin, this.canvasHeight/2);
        this.p.vertex(rightMargin, this.canvasHeight / 2);
        this.p.vertex(rightMargin - 10, this.canvasHeight / 2 - 5);
        this.p.vertex(rightMargin, this.canvasHeight / 2);
        this.p.vertex(rightMargin - 10, this.canvasHeight / 2 + 5);
        this.p.endShape();

        this.p.pop();
    }

    drawVerticalAxis(curveStrokeWeight, passed_width, passed_height) {
        if (passed_width && passed_height) {
            this.canvasHeight = passed_height;
            this.canvasWidth = passed_width;
        }
        this.p.push();

        this.p.strokeWeight(curveStrokeWeight);
        this.p.strokeJoin(this.p.ROUND);
        this.p.stroke(0);
        this.p.noFill();

        let upMargin = this.PADDING;
        let bottomMargin = this.canvasHeight - this.PADDING;

        this.p.beginShape();
        this.p.vertex(this.canvasWidth/2, bottomMargin);
        this.p.vertex(this.canvasWidth/2, upMargin);
        this.p.vertex(this.canvasWidth/2 - 5, upMargin + 10);
        this.p.vertex(this.canvasWidth/2, upMargin);
        this.p.vertex(this.canvasWidth/2 + 5, upMargin + 10);
        this.p.endShape();

        this.p.pop();
    }

    drawGrid(curveStrokeWeight, passed_width, passed_height) {
        if (passed_width && passed_height) {
            this.canvasHeight = passed_height;
            this.canvasWidth = passed_width;
        }
        this.p.push();

        this.p.noFill();
        this.p.strokeWeight(curveStrokeWeight);
        this.p.strokeJoin(this.p.ROUND);
        this.p.stroke(240);

        this.p.push();
        this.p.translate(0, this.canvasHeight / 2);
        let num = this.canvasHeight / (this.GRID_WIDTH * 2);
        for (let i = 0; i < num; i++) {
            this.p.line(0, -i*this.GRID_WIDTH, this.canvasWidth, -i*this.GRID_WIDTH);
            this.p.line(0, i*this.GRID_WIDTH, this.canvasWidth, i*this.GRID_WIDTH);
        }
        this.p.pop();

        this.p.push();
        this.p.translate(this.canvasWidth / 2, 0);
        num = this.canvasWidth / (this.GRID_WIDTH * 2);
        for (let i = 0; i < num; i++) {
            this.p.line(-i*this.GRID_WIDTH, 0, -i*this.GRID_WIDTH, this.canvasHeight);
            this.p.line(i*this.GRID_WIDTH, 0, i*this.GRID_WIDTH, this.canvasHeight);
        }
        this.p.pop();

        this.p.pop();
    }

    drawLabel() {
        this.p.push();

        this.p.textSize(16);
        this.p.stroke(0);
        this.p.strokeWeight(0.5);
        this.p.fill(0);

        this.p.text("O", this.canvasWidth/2 - 15, this.canvasHeight/2 + 15);
        this.p.text("x", this.canvasWidth - this.PADDING, this.canvasHeight/2 + 15);
        this.p.text("y", this.canvasWidth/2 + 5, this.PADDING);

        this.p.pop();
    }

    drawBackground(passed_width, passed_height) {
        this.p.clear();
        this.p.background(255);

        this.drawGrid(this.CURVE_STRKWEIGHT, passed_width, passed_height);
        this.drawHorizontalAxis(this.CURVE_STRKWEIGHT, passed_width, passed_height);
        this.drawVerticalAxis(this.CURVE_STRKWEIGHT, passed_width, passed_height);
        this.drawLabel();
    }

    drawCorner(stretchMode, c) {
        this.p.push();
        this.p.fill(this.KNOT_DETECT_COLOR);
        switch (stretchMode) {
            case "bottomLeft": {
                this.p.rect(c.minX - 4, c.minY - 4, 8, 8);
                break;
            }
            case "bottomRight": {
                this.p.rect(c.maxX - 4, c.minY - 4, 8, 8);
                break;
            }
            case "topRight": {
                this.p.rect(c.maxX - 4, c.maxY - 4, 8, 8);
                break;
            }
            case "topLeft": {
                this.p.rect(c.minX - 4, c.maxY - 4, 8, 8);
                break;
            }
            case "bottomMiddle": {
                this.p.triangle((c.minX + c.maxX)/2 - 5, c.minY - 2, (c.minX + c.maxX)/2 + 5, c.minY - 2, (c.minX + c.maxX)/2, c.minY - 7);
                break;
            }
            case "topMiddle": {
                this.p.triangle((c.minX + c.maxX)/2 - 5, c.maxY + 2, (c.minX + c.maxX)/2 + 5, c.maxY + 2, (c.minX + c.maxX)/2, c.maxY + 7);
                break;
            }
            case "leftMiddle": {
                this.p.triangle(c.minX - 2, (c.minY + c.maxY) / 2 - 5, c.minX - 2, (c.minY + c.maxY) / 2 + 5, c.minX - 7, (c.minY + c.maxY) / 2);
                break;
            }
            case "rightMiddle": {
                this.p.triangle(c.maxX + 2, (c.minY + c.maxY) / 2 - 5, c.maxX + 2, (c.minY + c.maxY) / 2 + 5, c.maxX + 7, (c.minY + c.maxY) / 2);
                break;
            }
        }
        this.p.pop();
    }
};