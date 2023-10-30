import {CanvasProperties, Curve, Dimension, GraphSketcherState, LineType, Point} from "./GraphSketcher";
import _isEqual from 'lodash/isEqual';

// undefined|null checker and type guard all-in-wonder.
// Why is this not in Typescript?
export function isDefined<T>(stuff: T): stuff is NonNullable<T> {
    return stuff !== undefined && stuff !== null;
}

const SAMPLE_INTERVAL = 10;
const numOfPts = 200;

// methods used in manipulating the graphs
export function getDist(pt1: Point, pt2: Point) {
    return Math.sqrt(Math.pow(pt1[0] - pt2[0], 2) + Math.pow(pt1[1] - pt2[1], 2));
}


function mod(n: number, m: number) {
    return ((n % m) + m) % m;
}

export function getAngle(pt1: Point, pt2: Point) {
    return Math.atan2(pt2[1] - pt1[1], pt2[0] - pt1[0]);
}

/*
Converts all curves from absolute pixel coordinates to abstract Cartesian coordinates to decouple them from
view changes (e.g. loading attempt on other devices, resizing of window etc.)
 */
export function encodeData(trunc: boolean, canvasProperties: CanvasProperties, curves: Curve[]): GraphSketcherState | undefined {
    if (canvasProperties.widthPx > 5000 || canvasProperties.widthPx <= 0 || canvasProperties.heightPx > 5000 || canvasProperties.heightPx <= 0) {
        console.error("Invalid canvasProperties:", canvasProperties);
        return;
    }

    // sort segments according to their left most points.
    function compare(curve1: Curve, curve2: Curve) {
        function findMinX(pts: Point[]) {
            if (pts.length === 0) return 0;
            let min = canvasProperties.widthPx;
            for (let i = 0; i < pts.length; i++) {
                min = Math.min(min, pts[i][0]);
            }
            return min;
        }

        const min1 = findMinX(curve1.pts);
        const min2 = findMinX(curve2.pts);
        if (min1 < min2) return -1;
        else if (min1 == min2) return 0;
        else return 1;
    }

    function normalisePoint(point: Point, truncate: boolean): Point {
        let x = normalise(point[0], Dimension.X);
        let y = normalise(point[1], Dimension.Y);
        if (truncate) {
            x = Math.round(x * 10000) / 10000;
            y = Math.round(y * 10000) / 10000;
        }
        return createPoint(x, y);
    }

    function normalise(value: number, dimension: Dimension): number {
        if (dimension == Dimension.X) {
            return (value - canvasProperties.centerPx[0]) / canvasProperties.axisLengthPx;
        }
        else if (dimension == Dimension.Y) {
            return (canvasProperties.centerPx[1] - value) / canvasProperties.axisLengthPx;
        }
        return 0;
    }

    const clonedCurves = _clone(curves);
    clonedCurves.sort(compare);

    for (const curve of clonedCurves) {
        curve.pts = curve.pts.map((point: Point) => normalisePoint(point, trunc));

        curve.minX = normalise(curve.minX, Dimension.X);
        curve.maxX = normalise(curve.maxX, Dimension.X);
        curve.minY = normalise(curve.minY, Dimension.Y);
        curve.maxY = normalise(curve.maxY, Dimension.Y);

        curve.interX = curve.interX.map((point: Point) => normalisePoint(point, trunc));
        curve.interY = curve.interY.map((point: Point) => normalisePoint(point, trunc));
        curve.maxima = curve.maxima.map((point: Point) => normalisePoint(point, trunc));
        curve.minima = curve.minima.map((point: Point) => normalisePoint(point, trunc));
    }

    return { curves: clonedCurves, canvasWidth: canvasProperties.widthPx, canvasHeight: canvasProperties.heightPx };
}

/*
Converts all curves held in GraphSketcherState from abstract Cartesian coordinates back to absolute pixel coordinates.
 */
export function decodeData(data: GraphSketcherState, canvasProperties: CanvasProperties): GraphSketcherState {

    function denormalisePoint(point: Point): Point {
        return createPoint(denormalise(point[0], Dimension.X), denormalise(point[1], Dimension.Y));
    }

    function denormalise(value: number, dimension: Dimension) {
        if (dimension == Dimension.X) {
            return value * canvasProperties.axisLengthPx + canvasProperties.centerPx[0];
        } else if (dimension == Dimension.Y) {
            return canvasProperties.centerPx[1] - value * canvasProperties.axisLengthPx;
        }
        return 0;
    }

    const normalisedCurves = [];

    for (const c of data.curves ?? []) {
        const curve = new Curve();
        curve.pts = c.pts.map((point: Point) => denormalisePoint(point));
        
        curve.minX = denormalise(c.minX, Dimension.X);
        curve.maxX = denormalise(c.maxX, Dimension.X);
        // denormalising the Y coordinate multiplies by -1, so max becomes min and vice versa
        curve.minY = denormalise(c.maxY, Dimension.Y);
        curve.maxY = denormalise(c.minY, Dimension.Y);
        
        curve.interX = c.interX.map((point: Point) => denormalisePoint(point));
        curve.interY = c.interY.map((point: Point) => denormalisePoint(point));
        curve.maxima = c.maxima.map((point: Point) => denormalisePoint(point));
        curve.minima = c.minima.map((point: Point) => denormalisePoint(point));

        curve.colorIdx = c.colorIdx;
        curve.isClosed = c.isClosed;

        normalisedCurves.push(curve);
    }

    return { curves: normalisedCurves, canvasWidth: canvasProperties.widthPx, canvasHeight: canvasProperties.heightPx };
}

// TODO 'e' is probably a mouse event of some sort
export function detect(e: MouseEvent, x: number, y: number) {
    const mousePosition = getMousePt(e);
    return (getDist(mousePosition, createPoint(x, y)) < 5);
}

export function getMousePt(e: MouseEvent | Touch) {
    const x = e.clientX + (window.Touch && e instanceof Touch ? 5 : 0);
    const y = e.clientY + (window.Touch && e instanceof Touch ? 5 : 0);
    return createPoint(x, y);
}

export function createPoint(x: number, y: number) {
    const obj = [x, y];
    return obj;
}

export function setCurveProperties(curve: Curve, pts: Point[], selectedLineType: LineType, canvasProperties: CanvasProperties, colorIdx: number) {
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

    curve.interX = findInterceptX(canvasProperties, pts);
    curve.interY = findInterceptY(canvasProperties, pts);
    if (selectedLineType === LineType.BEZIER) {
        curve.maxima = findTurnPts(pts, 'maxima');
        curve.minima = findTurnPts(pts, 'minima');
    } else {
        curve.maxima = [];
        curve.minima = [];
    }
    curve.colorIdx = colorIdx;
}

export function linearLineStyle(pts: Point[]) {
    pts.sort(function(a, b){return a[0] - b[0];});
    const increment = 1/numOfPts;
    const linearPoints = [];
    const x_diff = pts[1][0]-pts[0][0];
    const y_diff = pts[1][1]-pts[0][1];
    for (let currentPoint = 0; currentPoint < numOfPts; currentPoint += 1) {
        const x_co = pts[0][0] + (currentPoint*increment*x_diff);
        const y_co = pts[0][1] + (currentPoint*increment*y_diff);
        linearPoints.push(createPoint(x_co,y_co));
    }
    return linearPoints;
}

export function bezierLineStyle(pts: Point[]) {

    // See https://github.com/josdejong/mathjs/blob/v5.8.0/src/function/probability/product.js
    // Product of all integers between i and n
    const product = function(i: number, n: number): number {
        if (n < i) {
            return 1;
        }
        if (n === i) {
            return n;
        }
        const half = (n + i) >> 1; // divide (n + i) by 2 and truncate to integer
        return product(i, half) * product(half + 1, n);
    };

    // See https://github.com/josdejong/mathjs/blob/v5.8.0/src/function/probability/combinations.js
    // Compute the number of ways of picking k unordered outcomes from n possibilities
    const combinations = function(n: number, k: number): number {
        if (n < 0 || k < 0) {
            throw new TypeError('Positive integer value expected in function combinations');
        }
        if (k > n) {
            throw new TypeError('k must be less than or equal to n');
        }
        const nMinusk = n - k;
        if (k < nMinusk) {
            const prodrange = product(nMinusk + 1, n);
            return prodrange / product(1, k);
        }
        const prodrange = product(k + 1, n);
        return prodrange / product(1, nMinusk);
    };

    const drawnNumberOfPoints = pts.length - 1;
    const comb = [];
    for (let currentIndex = 0; currentIndex <= drawnNumberOfPoints; currentIndex += 1) {
        comb.push(combinations(drawnNumberOfPoints, currentIndex));
    }

    const step = 1 / numOfPts;
    const bezier = [];
    let u;

    let tmp1;
    let tmp2;
    let tmp3;

    for (let i = 0; i < numOfPts; i += 1) {
        u = i * step;
        let sx = 0;
        let sy = 0;
        for (let currentIndex = 0; currentIndex <= drawnNumberOfPoints; currentIndex += 1) {
            tmp1 = Math.pow(u, currentIndex);
            tmp2 = Math.pow(1 - u, drawnNumberOfPoints - currentIndex);
            tmp3 = comb[currentIndex] * tmp1 * tmp2;
            sx += tmp3 * pts[currentIndex][0];
            sy += tmp3 * pts[currentIndex][1];
        }
        bezier.push(createPoint(sx, sy));
    }
    bezier.push(pts[pts.length - 1]);
    return bezier;
}

export function sample(pts: Point[]) {
    const sampled = [];
    sampled.push(pts[0]);
    let i = 0;
    let j = 0;
    while (i < pts.length) {
        
        while (j < pts.length && getDist(pts[i], pts[j]) < SAMPLE_INTERVAL) {
            j += 1;
        }

        if (j < pts.length) {
            sampled.push(pts[j]);
        }

        i = j;
    }
    sampled.push(pts[pts.length - 1]);
    return sampled;
}

export function overItem(curves: Curve[], e: MouseEvent | Touch, MOUSE_DETECT_RADIUS: number, found: string) {
    const mousePosition = getMousePt(e);
    const loop = function(knots: Point[]) {
        for (let j = 0; j < knots.length; j++) {
            const knot = knots[j];
            if (getDist(mousePosition, knot) < MOUSE_DETECT_RADIUS) {
                found = "overKnot";
            } 
        }
    };

    for (let j = 0; j < curves.length; j++) { // detects if mouse is over curve
        for (let k = 0; k < curves[j].pts.length; k++) {
            if (getDist(mousePosition, curves[j].pts[k]) < MOUSE_DETECT_RADIUS) {
                found = "overCurve";
            }
        }
    }

    for (let i = 0; i < curves.length; i++) { // is the mouse over a symbol docked to any of these knots?
        const interX = curves[i]['interX'];
        loop(interX);
    
        const interY = curves[i]['interY'];
        loop(interY);

        const maxima = curves[i]['maxima'];
        loop(maxima);
    
        const minima = curves[i]['minima'];
        loop(minima);
    } 
    return found;
}

export function findOutermostPts(pts: Point[]): Point[] {
    let minX = pts[0];
    let maxX = pts[0];
    let minY = pts[0];
    let maxY = pts[0];

    for (let i = 1; i < pts.length; i++) {
        if (pts[i][0] < minX[0]) minX = pts[i];
        if (pts[i][0] > maxX[0]) maxX = pts[i];
        if (pts[i][1] < minY[1]) minY = pts[i];
        if (pts[i][1] > maxY[1]) maxY = pts[i];
    }

    return [minX, maxX, minY, maxY];
}

export function findEndPts(pts: Point[]): Point[] { 
    if (pts.length == 0) return [];

    const ends = [];

    ends.push(createPoint(pts[0][0], pts[0][1]));
    ends.push(createPoint(pts[pts.length - 1][0], pts[pts.length - 1][1]));

    return ends;
}

export function findInterceptX(canvasProperties: CanvasProperties, pts: Point[]) {
    if (pts.length == 0) return [];

    const intercepts = [];

    if (pts[0][1] == canvasProperties.centerPx[1]) intercepts.push(pts[0]);
    for (let i = 1; i < pts.length; i++) {
        if (pts[i][1] == canvasProperties.centerPx[1]) {
            intercepts.push(createPoint(pts[i][0], pts[i][1]));
            continue;
        }

        if ((pts[i-1][1] - canvasProperties.centerPx[1]) * (pts[i][1] - canvasProperties.centerPx[1]) < 0 && (pts[i-1][1] - pts[i][1] < Math.abs(200))) {
            const dx = pts[i][0] - pts[i-1][0];
            const dy = pts[i][1] - pts[i-1][1];
            const grad = dy/dx;
            const esti = pts[i-1][0] + (1 / grad) * (canvasProperties.centerPx[1] - pts[i-1][1]);
            intercepts.push(createPoint(esti, canvasProperties.centerPx[1]));
        }
    }

    return intercepts;
}

export function findInterceptY(canvasProperties: CanvasProperties, pts: Point[]) {
    if (pts.length == 0) return [];

    const intercepts = [];

    if (pts[0][0] == canvasProperties.centerPx[0]) intercepts.push(pts[0]);
    for (let i = 1; i < pts.length; i++) {
        if (pts[i][0] == canvasProperties.centerPx[0]) {
            intercepts.push(createPoint(pts[i][0], pts[i][1]));
            continue;
        }

        if ((pts[i-1][0] - canvasProperties.centerPx[0]) * (pts[i][0] - canvasProperties.centerPx[0]) < 0 && (pts[i-1][0] - pts[i][0] < Math.abs(200))) {
            const dx = pts[i][0] - pts[i-1][0];
            const dy = pts[i][1] - pts[i-1][1];
            const grad = dy/dx;
            const esti = pts[i-1][1] + grad * (canvasProperties.centerPx[0] - pts[i-1][0]);
            intercepts.push(createPoint(canvasProperties.centerPx[0], esti));
        }
    }

    return intercepts;
}

export function findTurnPts(pts: Point[], mode: string, isClosed: boolean = false) {
    if (pts.length == 0) {
        return [];
    }

    let turnPts = [];
    const potentialPts = [];
    let statPts: Point[] = [];
    const pot_max = [];
    const pot_min = [];
    const CUTOFF = 10;

    if (isClosed) {
        for (let i = 0; i < pts.length-1; i++) {
            if ((pts[i][1] < pts[mod(i-1, pts.length)][1] && pts[i][1] < pts[mod(i+1, pts.length)][1]) || (pts[i][1] > pts[mod(i-1, pts.length)][1] && pts[i][1] > pts[mod(i+1, pts.length)][1]) || (pts[i][1] == pts[mod(i-1, pts.length)][1])) {
                potentialPts.push(createPoint(pts[i][0], pts[i][1]));
            }
        }
    } else {
        for (let i = CUTOFF; i < pts.length-1-CUTOFF; i++) {
            if ((pts[i][1] < pts[i-1][1] && pts[i][1] < pts[i+1][1]) || (pts[i][1] > pts[i-1][1] && pts[i][1] > pts[i+1][1]) || (pts[i][1] == pts[i-1][1])) {
                potentialPts.push(createPoint(pts[i][0], pts[i][1]));
            }
        }
    }

    statPts = potentialPts;

    let position = null;

    for (let i = 0; i < statPts.length; i++) { 
        for (let j = 0; j < pts.length; j++) {
            if (statPts[i][0] == pts[j][0]) {
                position = j;
            }
        }
        if (!isDefined(position)) continue;
        if (statPts[i][1] < pts[mod(position-5, pts.length)][1] && statPts[i][1] < pts[mod(position+5, pts.length)][1]) {
            // if the point we have found is within 5 units of the previous point, only include one of them
            // if (pts.findIndex((v: Point) => _isEqual(statPts[i], v)) === 0) {
            pot_max.push(statPts[i]);
        } else if (statPts[i][1] > pts[mod(position-5, pts.length)][1] && statPts[i][1] > pts[mod(position+5, pts.length)][1]) {
            pot_min.push(statPts[i]);
        }
    }

    mode == 'maxima' ? turnPts = pot_max : turnPts = pot_min;  
    turnPts.sort(sortByPointOrder.bind(undefined, pts));
    
    return turnPts;
}


// given a curve, translate the curve
export function translateCurve(curve: Curve, dx: number, dy: number, canvasProperties: CanvasProperties) {
    const pts = curve.pts;

    curve.minX += dx;
    curve.maxX += dx;
    curve.minY += dy;
    curve.maxY += dy;

    for (let i = 0; i < pts.length; i++) {
        pts[i][0] += dx;
        pts[i][1] += dy;
    }

    function moveTurnPts(knots: Point[]) {
        for (let i = 0; i < knots.length; i++) {
            const knot = knots[i];

            knot[0] += dx;
            knot[1] += dy;
        }
    }

    const maxima = curve.maxima;
    moveTurnPts(maxima);

    const minima = curve.minima;
    moveTurnPts(minima);


    const moveInter = function(inter: Point[], newInter: Point[]) {
        for (let i = 0; i < inter.length; i++) {
            // if (inter[i].symbol != undefined) {
            //     let symbol = inter[i].symbol;

            //     let found = false,
            //         min = 50,
            //         knot;
            //     for (let j = 0; j < newInter.length; j++) {
            //         if (getDist(inter[i], newInter[j]) < min) {
            //             min = getDist(inter[i], newInter[j]);
            //             knot = newInter[j];
            //             found = true;
            //         }
            //     }

            //     if (found) {
            //         symbol.x = knot[0];
            //         symbol.y = knot.y;
            //         knot.symbol = symbol;
            //     } 
            // }
        }
        return newInter;
    };

    const interX = curve.interX,
        newInterX = findInterceptX(canvasProperties, pts);
    curve.interX = moveInter(interX, newInterX);

    const interY = curve.interY,
        newInterY = findInterceptY(canvasProperties, pts);
    curve.interY = moveInter(interY, newInterY);

    return;
}


export const sortByPointOrder = (pts: Point[], a: Point, b: Point) => pts.findIndex((v: Point) => _isEqual(a, v)) - pts.findIndex((v: Point) => _isEqual(b, v));

export function rotateCurve(curve: Curve, angle: number, center: Point) {
    const pts = curve.pts;
    
    function rotatePoint(point: Point, angle: number, center: Point) {
        const x = point[0] - center[0];
        const y = point[1] - center[1];
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        point[0] = x * cos - y * sin + center[0];
        point[1] = x * sin + y * cos + center[1];
    }

    pts.map(pt => rotatePoint(pt, angle, center));
}


export function stretchTurningPoint(importantPoints: Point[], e: MouseEvent | Touch, selectedCurve: Curve, isMaxima: boolean, selectedPointIndex: number|undefined, prevMousePt: Point, canvasProperties: CanvasProperties) {
    if (!isDefined(selectedPointIndex)) return;

    const mousePosition = getMousePt(e);
    // let turningPoints = isMaxima ? selectedCurve.maxima : selectedCurve.minima;
    const movablePoints = selectedCurve.minima.concat(selectedCurve.maxima, findEndPts(selectedCurve.pts));
    movablePoints.sort(sortByPointOrder.bind(undefined, selectedCurve.pts));
    
    let prevImportant : Point | undefined;
    let nextImportant : Point | undefined;
    let currImportant = movablePoints[selectedPointIndex];
    for (let i = 0; i < importantPoints.length; i++) {
        if (!isDefined(importantPoints[i]) || !isDefined(currImportant)) {
            break;
        }
        if (_isEqual(importantPoints[i], currImportant)) {
            if (selectedCurve.isClosed) {
                prevImportant = (importantPoints.length <= 1) ? undefined : importantPoints[mod(i - 1, importantPoints.length)]; 
                nextImportant = (importantPoints.length <= 1) ? undefined : importantPoints[mod(i + 1, importantPoints.length)];
            } else {
                prevImportant = importantPoints[i - 1]; 
                nextImportant = importantPoints[i + 1];
            }
            break;
        }
    }

    let withinXBoundary = false;
    let withinYBoundary = false;

    const XBUFFER = 30;
    const YBUFFER = 15;
    // when dragging, we shouldn't be able to move the turning point past the next/prev turning point in either axis
    if (prevImportant && nextImportant) {
        const leftImportant = (prevImportant[0] < nextImportant[0]) ? prevImportant : nextImportant;
        const rightImportant = (prevImportant[0] < nextImportant[0]) ? nextImportant : prevImportant;
        withinXBoundary = (rightImportant[0] - mousePosition[0]) > XBUFFER && (mousePosition[0] - leftImportant[0]) > XBUFFER;
        withinYBoundary = (isMaxima && ((rightImportant[1] - mousePosition[1]) > YBUFFER && (leftImportant[1] - mousePosition[1]) > YBUFFER)) || (!isMaxima && ((mousePosition[1] - rightImportant[1]) > YBUFFER && (mousePosition[1] - leftImportant[1]) > YBUFFER));
    } else {
        const definedImportant = prevImportant ?? nextImportant;
        if (!isDefined(definedImportant)) return;
        if (definedImportant[0] - currImportant[0] > 0) {
            withinXBoundary = (definedImportant[0] - mousePosition[0]) > XBUFFER;
        } else {
            withinXBoundary = (mousePosition[0] - definedImportant[0]) > XBUFFER;
        }
        if (definedImportant[1] - currImportant[1] > 0) {
            withinYBoundary = (definedImportant[1] - mousePosition[1]) > YBUFFER;
        } else {
            withinYBoundary = (mousePosition[1] - definedImportant[1]) > YBUFFER;
        }
    }

    if (isDefined(currImportant) && (withinXBoundary || withinYBoundary)) {
        // to this point we get the clicked knot and the turning/end points either side, now we will split the curve into the two
        // origional max/min sides and the 2 new curves to be stretched, then combine them all after.
        const leftStaticPoints = new Array<Point>();
        const leftStretchedCurve = new Curve;
        const rightStretchedCurve = new Curve;
        const rightStaticPoints = new Array<Point>();

        if (!withinXBoundary) {
            mousePosition[0] = currImportant[0];
        } else if (!withinYBoundary) {
            mousePosition[1] = currImportant[1];
        }

        let currentSectionState = (prevImportant) ? 0 : 1;

        // this must be run before the switch if there is no earlier important point,
        // and must be run after the switch if there is no later important point.
        // cases with both work with either position.
        const updateSectionState = (pt : Point) => {
            if (_isEqual(pt, prevImportant) || _isEqual(pt, currImportant) || _isEqual(pt, nextImportant)) {
                currentSectionState = (currentSectionState + 1) % 4;
            }
        };

        selectedCurve.pts.forEach(pt => {
            if (!isDefined(prevImportant)) {
                updateSectionState(pt);
            }

            switch (currentSectionState) {
                case 0:
                    leftStaticPoints.push(pt);
                    break;
                case 1:
                    leftStretchedCurve.pts.push(pt);
                    break;
                case 2:
                    rightStretchedCurve.pts.push(pt);
                    break;
                case 3:
                    rightStaticPoints.push(pt);
                    break;
            }

            if (isDefined(prevImportant)) {
                updateSectionState(pt);
            }
        });
        selectedCurve.pts = [];

        // we have now split the curve into leftStaticPoints and rightStaticPoints, plus leftStretchedCurve and rightStretchedCurve
        if (isDefined(prevImportant)) {
            const lorx = currImportant[0] - prevImportant[0];
            const lory = currImportant[1] - prevImportant[1];
            const lnrx = mousePosition[0] - prevImportant[0];
            const lnry = mousePosition[1] - prevImportant[1];
            stretchCurve(leftStretchedCurve, lorx, lory, lnrx, lnry, prevImportant[0], prevImportant[1]);    
        }
        if (isDefined(nextImportant)) {
            const rorx = nextImportant[0] - currImportant[0];
            const rory = currImportant[1] - nextImportant[1];
            const rnrx = nextImportant[0] - mousePosition[0];
            const rnry = mousePosition[1] - nextImportant[1];
            stretchCurve(rightStretchedCurve, rorx, rory, rnrx, rnry, nextImportant[0], nextImportant[1]);
        }

        currImportant = mousePosition;

        selectedCurve.pts.push(...leftStaticPoints);
        selectedCurve.pts.push(...leftStretchedCurve.pts);
        selectedCurve.pts.push(...rightStretchedCurve.pts);
        selectedCurve.pts.push(...rightStaticPoints);

        setCurveProperties(selectedCurve, selectedCurve.pts, LineType.BEZIER, canvasProperties, selectedCurve.colorIdx);
    }
    return selectedCurve;
}

export function stretchCurve(c: Curve, orx: number, ory: number, nrx: number, nry: number, baseX: number, baseY: number) {

    function stretch(pt: Point) {
        const nx = (pt[0] - baseX) / orx;
        const ny = (pt[1] - baseY) / ory;
        pt[0] = nx * nrx + baseX;
        pt[1] = ny * nry + baseY;
    }
    // stretch each point
    c.pts.forEach(stretch);
}

function _clone<T>(obj: T) {
    if (isDefined(obj)) {
        const json = JSON.stringify(obj);
        return JSON.parse(json);
    }
}