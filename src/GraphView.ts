import p5 from 'p5';
import * as graphUtils from './GraphUtils';
import {CanvasProperties, Curve, Dimension, Point} from './GraphSketcher';

// self explanatory drawing methods
export default class GraphView {

    public p: p5;

    private canvasProperties: CanvasProperties;
    private backgroundGraphic: p5.Graphics;

    private DOT_LINE_COLOR = [123];
    private DEFAULT_KNOT_COLOR = [77,77,77];

    private CELLS = 20;
    private DOT_LINE_STEP = 5;
    private PADDING: number;

    public CURVE_COLORS = [[93,165,218], [250,164,58], [96,189,104], [241,124,176], [241,88,84], [178,118,178]];
    public CURVE_STRKWEIGHT = 2;
    public KNOT_DETECT_COLOR = [0];

    constructor(p: p5, canvasProperties: CanvasProperties) {
        this.p = p;
        this.PADDING = 0.025 * canvasProperties.axisLengthPx;
        this.canvasProperties = canvasProperties;
        this.backgroundGraphic = this.p.createGraphics(canvasProperties.widthPx, canvasProperties.heightPx);
        this.refreshBackground();
    }

    drawCurves(curves: Curve[], color = -1, hiddenKnots?: number[]) {
        for (let i = 0; i < curves.length; i++) {
            this.drawCurve(curves[i], color, hiddenKnots ? !hiddenKnots.includes(i) : true);
        }
    }

    drawCurve(curve: Curve, color: number, drawKnots: boolean) {
        const chosenColor = color < 0 ? this.CURVE_COLORS[curve.colorIdx] : this.CURVE_COLORS[color];

        this.p.push();
        this.p.stroke(chosenColor);
        this.p.strokeWeight(this.CURVE_STRKWEIGHT);

        // want to connect closest points x,y wise, not just x wise
        const pts = curve.pts;
        for (let i = 1; i < pts.length; i++) {
            if (pts[i].x - pts[i-1].x < 100 && pts[i].y - pts[i-1].y < 100) {// 100 chosen as close enough to reliably be the same curve
                this.p.line(pts[i-1].x, pts[i-1].y, pts[i].x, pts[i].y);
            }
        }

        this.p.pop();

        if (drawKnots) {   
            // draw x intercepts, y intercepts, turning points, and end points
            this.drawKnots(curve.interX);
            this.drawKnots(curve.interY);
            this.drawKnots(curve.maxima);
            this.drawKnots(curve.minima);
            if (!curve.isClosed) this.drawKnots(graphUtils.findEndPts(curve.pts));
        }
    }

    drawKnots(knots: Point[], color?: number[]) {
        for (let i = 0; i < knots.length; i++) {
            this.drawKnot(knots[i], color);
        }
    }

    drawKnot(knot: Point, color?: number[]) {
        // Don't draw knots that are outside the plot area
        if (knot.x < this.canvasProperties.plotStartPx.x || knot.x > this.canvasProperties.plotEndPx.x ||
            knot.y < this.canvasProperties.plotStartPx.y || knot.y > this.canvasProperties.plotEndPx.y
        ) {
            return;
        }
        if (!color) {
            color = this.DEFAULT_KNOT_COLOR;
        }
        this.p.push();
        this.p.noFill();
        this.p.stroke(color);
        this.p.strokeWeight(1.5);
        this.p.line(knot.x - 3, knot.y - 3, knot.x + 3, knot.y + 3);
        this.p.line(knot.x + 3, knot.y - 3, knot.x - 3, knot.y + 3);
        this.p.pop();
    }

    drawDetectedKnot(knot: Point) {
        this.p.push();
        this.p.noFill();
        this.p.stroke(this.KNOT_DETECT_COLOR);
        this.p.strokeWeight(2);
        this.p.line(knot.x - 5, knot.y - 5, knot.x + 5, knot.y + 5);
        this.p.line(knot.x + 5, knot.y - 5, knot.x - 5, knot.y + 5);
        this.p.pop();
    }

    drawVerticalDotLine(x: number, begin: number, end: number) {
        if (x < 0 || x > this.canvasProperties.widthPx) {
            return;
        }

        if (begin > end) {
            const tmp = begin;
            begin = end;
            end = tmp;
        }

        this.p.push();
        this.p.stroke(this.DOT_LINE_COLOR);
        this.p.strokeWeight(this.CURVE_STRKWEIGHT);

        const step = this.DOT_LINE_STEP;
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

    drawHorizontalDotLine(y: number, begin: number, end: number) {
        if (y < 0 || y > this.canvasProperties.heightPx) {
            return;
        }

        if (begin > end) {
            const tmp = begin;
            begin = end;
            end = tmp;
        }

        this.p.push();
        this.p.stroke(this.DOT_LINE_COLOR);
        this.p.strokeWeight(this.CURVE_STRKWEIGHT);

        const step = this.DOT_LINE_STEP;
        let toDraw = true;
        let x = begin;
        while (x + step < end) {
            if (toDraw) {
                this.p.line(x, y, x+step, y);
            }
            x += step;
            toDraw = !toDraw;
        }
        if (toDraw) {
            this.p.line(x, y, end, y);
        }

        this.p.pop();
    }

    makeDiamond(x: number, y: number, w: number) {
        this.p.push();
        this.p.translate(x, y);
        this.p.rotate(this.p.QUARTER_PI);
        this.p.square(0, 0, w);
        this.p.pop();
    }

    drawStretchBox(idx: number | null | undefined, curves: Curve[]) {

        if ((!idx || (idx && !curves[idx])) && idx !== 0) return;

        const curve = curves[idx];

        const minX = curve.minX;
        const maxX = curve.maxX;
        const minY = curve.minY;
        const maxY = curve.maxY;

        this.p.push();
        this.p.stroke(this.DOT_LINE_COLOR);
        this.p.strokeWeight(0.5);
        // draw box
        this.p.line(minX, minY, maxX, minY);
        this.p.line(maxX, minY, maxX, maxY);
        this.p.line(maxX, maxY, minX, maxY);
        this.p.line(minX, maxY, minX, minY);

        this.p.fill(255);
        // stretch: corner squares
        this.p.rect(minX - 4, minY - 4, 8, 8);
        this.p.rect(maxX - 4, minY - 4, 8, 8);
        this.p.rect(minX - 4, maxY - 4, 8, 8);
        this.p.rect(maxX - 4, maxY - 4, 8, 8);
        // stretch: side triangles
        this.p.triangle((minX + maxX)/2 - 5, minY - 2, (minX + maxX)/2 + 5, minY - 2, (minX + maxX)/2, minY - 7);
        this.p.triangle((minX + maxX)/2 - 5, maxY + 2, (minX + maxX)/2 + 5, maxY + 2, (minX + maxX)/2, maxY + 7);
        this.p.triangle(minX - 2, (minY + maxY) / 2 - 5, minX - 2, (minY + maxY) / 2 + 5, minX - 7, (minY + maxY) / 2);
        this.p.triangle(maxX + 2, (minY + maxY) / 2 - 5, maxX + 2, (minY + maxY) / 2 + 5, maxX + 7, (minY + maxY) / 2);
        // rotate: corner diamonds
        this.makeDiamond(minX - 16, minY - 16, 4);
        this.makeDiamond(maxX + 16, minY - 16, 4);
        this.makeDiamond(minX - 16, maxY + 16, 4);
        this.makeDiamond(maxX + 16, maxY + 16, 4);

        this.p.pop();
    }

    drawArrowhead(at: Point, axis: Dimension) {
        if (axis == Dimension.Y) {
            this.backgroundGraphic.vertex(at.x - 5, at.y + 10);
            this.backgroundGraphic.vertex(at.x, at.y);
            this.backgroundGraphic.vertex(at.x + 5, at.y + 10);
        } else if (axis == Dimension.X) {
            this.backgroundGraphic.vertex(at.x - 10, at.y - 5);
            this.backgroundGraphic.vertex(at.x, at.y);
            this.backgroundGraphic.vertex(at.x - 10, at.y + 5);
        }
    }

    drawHorizontalAxis(curveStrokeWeight: number) {
        const xAxisStart: Point = new Point(this.canvasProperties.centerPx.x - this.canvasProperties.axisLengthPx/2 + this.PADDING, this.canvasProperties.centerPx.y);
        const xAxisEnd: Point = new Point(this.canvasProperties.centerPx.x + this.canvasProperties.axisLengthPx/2 - this.PADDING, this.canvasProperties.centerPx.y);

        this.backgroundGraphic.push();

        this.backgroundGraphic.strokeWeight(curveStrokeWeight);
        this.backgroundGraphic.strokeJoin(this.p.ROUND);
        this.backgroundGraphic.stroke(0);
        this.backgroundGraphic.noFill();

        this.backgroundGraphic.beginShape();
        this.backgroundGraphic.vertex(xAxisStart.x, xAxisStart.y);
        this.backgroundGraphic.vertex(xAxisEnd.x, xAxisEnd.y);
        this.drawArrowhead(xAxisEnd, Dimension.X);
        this.backgroundGraphic.endShape();

        this.backgroundGraphic.pop();
    }

    drawVerticalAxis(curveStrokeWeight: number) {
        const yAxisStart: Point = new Point(this.canvasProperties.centerPx.x, this.canvasProperties.centerPx.y - this.canvasProperties.axisLengthPx / 2 + this.PADDING);
        const yAxisEnd: Point = new Point(this.canvasProperties.centerPx.x, this.canvasProperties.centerPx.y + this.canvasProperties.axisLengthPx / 2 - this.PADDING);

        this.backgroundGraphic.push();

        this.backgroundGraphic.strokeWeight(curveStrokeWeight);
        this.backgroundGraphic.strokeJoin(this.backgroundGraphic.ROUND);
        this.backgroundGraphic.stroke(0);
        this.backgroundGraphic.noFill();

        this.backgroundGraphic.beginShape();
        this.drawArrowhead(yAxisStart, Dimension.Y);
        this.backgroundGraphic.vertex(yAxisStart.x, yAxisStart.y);
        this.backgroundGraphic.vertex(yAxisEnd.x, yAxisEnd.y);
        this.backgroundGraphic.endShape();

        this.backgroundGraphic.pop();
    }

    drawGrid(curveStrokeWeight: number) {
        this.backgroundGraphic.push();

        this.backgroundGraphic.noFill();
        this.backgroundGraphic.strokeWeight(curveStrokeWeight);
        this.backgroundGraphic.strokeJoin(this.p.ROUND);
        this.backgroundGraphic.stroke(240);

        this.backgroundGraphic.push();

        // draw grid lines
        // use top-left of drawable area as origin
        this.backgroundGraphic.translate(this.canvasProperties.plotStartPx.x, this.canvasProperties.plotStartPx.y);

        const cellSize = this.canvasProperties.axisLengthPx / this.CELLS;
        for (let cellNo = 1; cellNo < this.CELLS; cellNo++) {
            // horizontal
            this.backgroundGraphic.line(0, cellSize * cellNo, this.canvasProperties.axisLengthPx, cellSize * cellNo);
            // vertical
            this.backgroundGraphic.line(cellSize * cellNo, 0, cellSize * cellNo, this.canvasProperties.axisLengthPx);
        }

        this.backgroundGraphic.pop();
        this.backgroundGraphic.pop();
    }

    drawLabel() {
        this.backgroundGraphic.push();

        this.backgroundGraphic.textSize(16);
        this.backgroundGraphic.stroke(0);
        this.backgroundGraphic.strokeWeight(0.5);
        this.backgroundGraphic.fill(0);

        this.backgroundGraphic.text("O", this.canvasProperties.centerPx.x - 15, this.canvasProperties.centerPx.y + 15);
        this.backgroundGraphic.text("x", this.canvasProperties.centerPx.x + this.canvasProperties.axisLengthPx/2 - this.PADDING, this.canvasProperties.centerPx.y + 15);
        this.backgroundGraphic.text("y", this.canvasProperties.centerPx.x + 5, this.canvasProperties.centerPx.y - this.canvasProperties.axisLengthPx / 2 + this.PADDING);

        this.backgroundGraphic.pop();
    }

    refreshBackground() {
        this.backgroundGraphic.clear(0, 0, 0, 0);
        this.backgroundGraphic.background(255);

        this.drawGrid(this.CURVE_STRKWEIGHT);
        this.drawHorizontalAxis(this.CURVE_STRKWEIGHT);
        this.drawVerticalAxis(this.CURVE_STRKWEIGHT);
        this.drawLabel();
    }

    drawBoundaries(canvasProperties: CanvasProperties) {
        this.p.push();
        this.p.noStroke();
        this.p.fill(255, 180);
        this.p.rect(0, 0, canvasProperties.plotStartPx.x, canvasProperties.heightPx);
        this.p.rect(canvasProperties.plotEndPx.x, 0, canvasProperties.plotStartPx.x, canvasProperties.heightPx);
        this.p.pop();
    }

    drawOutOfBoundsWarning(point: Point, canvasProperties: CanvasProperties) {
        const x = this.p.constrain(point.x, canvasProperties.plotStartPx.x + 20, canvasProperties.plotEndPx.x - 20);
        const y = this.p.constrain(point.y, canvasProperties.plotStartPx.y + 20, canvasProperties.plotEndPx.y - 20);
        // Draw a red cross centered at (x, y) to indicate that a curve will be deleted if it is moved there
        this.p.push();
        this.p.stroke(255, 0, 0);
        this.p.strokeWeight(2);
        this.p.line(x - 10, y - 10, x + 10, y + 10);
        this.p.line(x - 10, y + 10, x + 10, y - 10);
        this.p.pop();
    }

    drawBackground(canvasProperties: CanvasProperties) {
        this.canvasProperties = canvasProperties;
        // Check if the background needs to be redrawn
        if (this.backgroundGraphic.width != this.canvasProperties.widthPx || this.backgroundGraphic.height != this.canvasProperties.heightPx) {
            this.backgroundGraphic = this.p.createGraphics(this.canvasProperties.widthPx, this.canvasProperties.heightPx);
            this.refreshBackground();
        }
        this.p.image(this.backgroundGraphic, 0, 0);
    }

    drawCorner(stretchMode: string, c: Curve) {
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

    debugDrawCoordinates(point: Point) {
        const plotSpaceCoordPx: Point = new Point(point.x - this.canvasProperties.plotStartPx.x, point.y - this.canvasProperties.plotStartPx.y);

        this.p.push();
        this.p.text(`Screen space: (${point.x}, ${point.y})\nPlot space (${plotSpaceCoordPx.x},${plotSpaceCoordPx.y})`,
            point.x, point.y);
        this.p.pop();
    }
}
