import {CanvasProperties, Curve, Dimension, GraphSketcher, GraphSketcherState, LineType, Point} from "./GraphSketcher";

export function pointsEqual(p?: Point, q?: Point) {
    if (!isDefined(p) || !isDefined(q)) return false;
    return p.x === q.x && p.y === q.y;
}

// undefined|null checker and type guard all-in-wonder.
// Why is this not in Typescript?
export function isDefined<T>(stuff: T): stuff is NonNullable<T> {
    return stuff !== undefined && stuff !== null;
}

const SAMPLE_INTERVAL = 10;
// const EXTREMA_DETECTION_HEIGHT = 0.05;
const numOfPts = 200;

// methods used in manipulating the graphs
export function getDist(pt1: Point, pt2: Point) {
    return Math.sqrt(Math.pow(pt1.x - pt2.x, 2) + Math.pow(pt1.y - pt2.y, 2));
}


function mod(n: number, m: number) {
    return ((n % m) + m) % m;
}

export function getAngle(pt1: Point, pt2: Point) {
    return Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x);
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
                min = Math.min(min, pts[i].x);
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
        let x = normalise(point.x, Dimension.X);
        let y = normalise(point.y, Dimension.Y);
        if (truncate) {
            x = Math.round(x * 10000) / 10000;
            y = Math.round(y * 10000) / 10000;
        }
        return new Point(x, y);
    }

    function normalise(value: number, dimension: Dimension): number {
        if (dimension == Dimension.X) {
            return (value - canvasProperties.centerPx.x) / canvasProperties.axisLengthPx;
        }
        else if (dimension == Dimension.Y) {
            return (canvasProperties.centerPx.y - value) / canvasProperties.axisLengthPx;
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
        return new Point(denormalise(point.x, Dimension.X), denormalise(point.y, Dimension.Y));
    }

    function denormalise(value: number, dimension: Dimension) {
        if (dimension == Dimension.X) {
            return value * canvasProperties.axisLengthPx + canvasProperties.centerPx.x;
        } else if (dimension == Dimension.Y) {
            // denormalising the Y coordinate multiplies by -1 to account for flipped y axis
            return canvasProperties.centerPx.y - value * canvasProperties.axisLengthPx;
        }
        return 0;
    }

    const normalisedCurves = [];

    for (const c of data.curves ?? []) {
        const curve = new Curve();
        curve.pts = c.pts.map((point: Point) => denormalisePoint(point));
        
        curve.minX = denormalise(c.minX, Dimension.X);
        curve.maxX = denormalise(c.maxX, Dimension.X);
        curve.minY = denormalise(c.minY, Dimension.Y);
        curve.maxY = denormalise(c.maxY, Dimension.Y);
        
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
export function detect(e: MouseEvent | Touch, x: number, y: number) {
    const mousePosition = getMousePt(e);
    return (getDist(mousePosition, new Point(x, y)) < 5);
}

export function getMousePt(e: MouseEvent | Touch) {
    const x = e.clientX + (window.Touch && e instanceof Touch ? 5 : 0);
    const y = e.clientY + (window.Touch && e instanceof Touch ? 5 : 0);
    return new Point(x, y);
}

export function recalculateCurveProperties(curve: Curve, canvasProperties: CanvasProperties) {
    // note: this does not set ALL properties, only those that might reasonably change when the curve is modified
    curve.minX = curve.pts.reduce((min, p) => Math.min(min, p.x), curve.pts[0].x);
    curve.maxX = curve.pts.reduce((max, p) => Math.max(max, p.x), curve.pts[0].x);
    curve.minY = curve.pts.reduce((min, p) => Math.min(min, p.y), curve.pts[0].y);
    curve.maxY = curve.pts.reduce((max, p) => Math.max(max, p.y), curve.pts[0].y);

    curve.interX = findInterceptX(canvasProperties, curve.pts);
    curve.interY = findInterceptY(canvasProperties, curve.pts);
    curve.maxima = findTurnPts(curve.pts, 'maxima', curve.isClosed);
    curve.minima = findTurnPts(curve.pts, 'minima', curve.isClosed);
}

export function linearLineStyle(pts: Point[]) {
    // while we _could_ just use the first and last points, the curve click detection works by the mouse being near a point in the curve,
    // so we do need a lot of points to be able to click anywhere on the curve and it still select it.
    pts.sort(sortByPointOrder.bind(undefined, pts));
    const increment = 1/numOfPts;
    const linearPoints = [];
    const x_diff = pts[1].x-pts[0].x;
    const y_diff = pts[1].y-pts[0].y;
    for (let currentPoint = 0; currentPoint < numOfPts; currentPoint += 1) {
        const x_co = pts[0].x + (currentPoint*increment*x_diff);
        const y_co = pts[0].y + (currentPoint*increment*y_diff);
        linearPoints.push(new Point(x_co,y_co));
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
            sx += tmp3 * pts[currentIndex].x;
            sy += tmp3 * pts[currentIndex].y;
        }
        bezier.push(new Point(sx, sy));
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
        if (pts[i].x < minX.x) minX = pts[i];
        if (pts[i].x > maxX.x) maxX = pts[i];
        if (pts[i].y < minY.y) minY = pts[i];
        if (pts[i].y > maxY.y) maxY = pts[i];
    }

    return [minX, maxX, minY, maxY];
}

export function findEndPts(pts: Point[]): Point[] { 
    if (pts.length == 0) return [];

    const ends = [];

    ends.push(new Point(pts[0].x, pts[0].y));
    ends.push(new Point(pts[pts.length - 1].x, pts[pts.length - 1].y));

    return ends;
}

export function findInterceptX(canvasProperties: CanvasProperties, pts: Point[]) {
    if (pts.length == 0) return [];

    const intercepts = [];

    for (let i = 0; i < pts.length-1; i++) {
        if (pts[i].y === canvasProperties.centerPx.y) {
            const start = i;
            while (i < pts.length && pts[i].y === canvasProperties.centerPx.y) {
                i++;
            }
            // show the intercept at the midpoint of the flat section, but only if there exist at least two other points not on the flat section
            if (start > 0 && i < pts.length - 1) {
                intercepts.push(new Point(pts[Math.round((start + i) / 2)].x, pts[Math.round((start + i) / 2)].y));
            }
            continue;
        }

        if (i > 0 && (pts[i-1].y - canvasProperties.centerPx.y) * (pts[i].y - canvasProperties.centerPx.y) < 0 && (pts[i-1].y - pts[i].y < Math.abs(200))) {
            const dx = pts[i].x - pts[i-1].x;
            const dy = pts[i].y - pts[i-1].y;
            const grad = dy/dx;
            const esti = pts[i-1].x + (1 / grad) * (canvasProperties.centerPx.y - pts[i-1].y);
            intercepts.push(new Point(esti, canvasProperties.centerPx.y));
        }
    }

    return intercepts;
}

export function findInterceptY(canvasProperties: CanvasProperties, pts: Point[]) {
    if (pts.length == 0) return [];

    const intercepts = [];

    for (let i = 0; i < pts.length; i++) {
        if (pts[i].x === canvasProperties.centerPx.x) {
            const start = i;
            while (i < pts.length && pts[i].x === canvasProperties.centerPx.x) {
                i++;
            }
            // show the intercept at the midpoint of the flat section, but only if there exist at least two other points not on the flat section
            if (start > 0 && i < pts.length - 1) {
                intercepts.push(new Point(pts[Math.round((start + i) / 2)].x, pts[Math.round((start + i) / 2)].y));
            }
            continue;
        }

        if (i > 0 && (pts[i-1].x - canvasProperties.centerPx.x) * (pts[i].x - canvasProperties.centerPx.x) < 0 && (pts[i-1].x - pts[i].x < Math.abs(200))) {
            const dx = pts[i].x - pts[i-1].x;
            const dy = pts[i].y - pts[i-1].y;
            const grad = dy/dx;
            const esti = pts[i-1].y + grad * (canvasProperties.centerPx.x - pts[i-1].x);
            intercepts.push(new Point(canvasProperties.centerPx.x, esti));
        }
    }

    return intercepts;
}

export function findTurnPts(pts: Point[], mode: string, isClosed: boolean = false) {

    enum TurningPointStyle {
        MAXIMA,
        MINIMA,
        STATIONARY
    }

    interface TurningPoint {
        point: Point;
        style: TurningPointStyle;
    }

    if (pts.length == 0) {
        return [];
    }
    
    // if the curve is closed (internally), there's a duplicate point at the start and end to visually "close" the curve (even if the user's drawing did not close).
    // this causes problems with the min/max detection, so remove it here.
    if (isClosed) {
        pts = pts.slice(0, -1);
    }

    const stationaryPts: TurningPoint[] = [];
    const CUTOFF = isClosed ? 0 : 10;

    const isMaxima = (i: number) => {
        const startI = i;
        if (!isClosed && (i == 0 || i == pts.length - 1)) return false;
        if (pts[i].y > pts[mod(i-1, pts.length)].y) {
            while (pts[i].y == pts[mod(i+1, pts.length)].y) {
                i += 1;
                if (i == startI || (!isClosed && i == pts.length - 1)) {
                    return false;
                }
            }
            return pts[i].y > pts[mod(i+1, pts.length)].y;
        }
        return false;
    };

    const isMinima = (i: number) => {
        const startI = i;
        if (!isClosed && (i == 0 || i == pts.length - 1)) return false;
        if (pts[i].y < pts[mod(i-1, pts.length)].y) {
            while (pts[i].y == pts[mod(i+1, pts.length)].y) {
                i += 1;
                if (i == startI || (!isClosed && i == pts.length - 1)) {
                    return false;
                }
            }
            return pts[i].y < pts[mod(i+1, pts.length)].y;
        }
        return false;
    };

    // do any of the surrounding 5 points either side of i have a y value that is EXTREMA_DETECTION_HEIGHT units greater than (maxima) / less than (minima) pts[i].y? (remember y is inverted)
    const isNotable = (i: number, style: TurningPointStyle) => {
        return true;
        // if (isClosed) {
        //     for (let j = i - 5; j < i + 5; j++) {
        //         if (style === TurningPointStyle.MAXIMA && pts[mod(j, pts.length)].y < pts[i].y - EXTREMA_DETECTION_HEIGHT) {
        //             return true;
        //         } else if (style === TurningPointStyle.MINIMA && pts[mod(j, pts.length)].y > pts[i].y + EXTREMA_DETECTION_HEIGHT) {
        //             return true;
        //         }
        //     }
        // } else {
        //     for (let j = Math.max(0, i - 5); j < Math.min(pts.length, i + 5); j++) {
        //         if (style === TurningPointStyle.MAXIMA && pts[j].y < pts[i].y - EXTREMA_DETECTION_HEIGHT) {
        //             return true;
        //         } else if (style === TurningPointStyle.MINIMA && pts[j].y > pts[i].y + EXTREMA_DETECTION_HEIGHT) {
        //             return true;
        //         }
        //     }
        // }
        // return false;
    };

    for (let i = CUTOFF; i < pts.length-1-CUTOFF; i++) {
        if (isMaxima(i) && isNotable(i, TurningPointStyle.MAXIMA)) {
            stationaryPts.push({point: new Point(pts[i].x, pts[i].y), style: TurningPointStyle.MAXIMA} as TurningPoint);
        } else if (isMinima(i) && isNotable(i, TurningPointStyle.MINIMA)) {
            stationaryPts.push({point: new Point(pts[i].x, pts[i].y), style: TurningPointStyle.MINIMA} as TurningPoint);
        }
    }

    const distantStationaryPts: TurningPoint[] = [];
    for (let i = 0; i < stationaryPts.length; i++) {
        if (distantStationaryPts.every((v: TurningPoint) => getDist(v.point, stationaryPts[i].point) > GraphSketcher.MERGE_STATIONARY_POINT_RADIUS)) {
            distantStationaryPts.push(stationaryPts[i]);
        }
    }

    let turnPts = [];
    // NOTE: actual (coordinate-based) maxima and visual maxima are not the same, hence the inversion here
    if (mode == 'maxima') {
        turnPts = distantStationaryPts.filter((s: TurningPoint) => s.style === TurningPointStyle.MINIMA).map((s: TurningPoint) => s.point);
    } else {
        turnPts = distantStationaryPts.filter((s: TurningPoint) => s.style === TurningPointStyle.MAXIMA).map((s: TurningPoint) => s.point);
    }

    turnPts.sort(sortByPointOrder.bind(undefined, pts));
    
    return turnPts;
}

// movablePoints is a list of all points that can be moved by the user. all movablePoints are importantPoints.
// this includes curve maxima and minima, and endpoints for unclosed curves.
// note that the actual calculation for these points is in recalculateCurveProperties.
function _findMovablePoints(curve: Curve, sortByPoints: boolean) {
    const endPts = !curve.isClosed ? findEndPts(curve.pts) : [];
    const movablePoints = endPts.concat(curve.maxima, curve.minima);
    if (sortByPoints) movablePoints.sort(sortByPointOrder.bind(undefined, curve.pts));
    return movablePoints;
}

export function findMovablePoints(curve: Curve) {
    return _findMovablePoints(curve, true);
}

// importantPoints is a list of all points that will not move when any other important point is stretched.
// This includes the outermost points, the maxima and minima (for x and y), and the endpoints.
// If two important points are close together, they will be treated as one, with priority going to endpoints, then x-min/x-max, then outermost, then y-min/y-max.
export function findImportantPoints(curve: Curve) {
    const movablePoints = _findMovablePoints(curve, false);
    const transposePoint = (pt: Point) => new Point(pt.y, pt.x);
    const transposedSelectedCurvePts = curve.pts.map(transposePoint);
    
    const yMaxima = findTurnPts(transposedSelectedCurvePts, 'maxima', curve.isClosed).map(transposePoint);
    const yMinima = findTurnPts(transposedSelectedCurvePts, 'minima', curve.isClosed).map(transposePoint);
    const outermostPts = findOutermostPts(curve.pts);

    // push all points from pts into arr that are not within GraphSketcher.IMPORTANT_POINT_DETECT_RADIUS of any point in arr
    const pushWithDistanceCheck = (arr: Point[], pts: Point[]) => {
        pts.forEach((pt) => {if (arr.every((v) => getDist(v, pt) > GraphSketcher.IMPORTANT_POINT_DETECT_RADIUS)) {
            arr.push(pt);
        }});
    };

    let importantPoints : Point[] = [];

    for (const ptsList of [movablePoints, yMinima, yMaxima, outermostPts]) {
        pushWithDistanceCheck(importantPoints, ptsList);
    }

    // remove duplicates
    importantPoints = importantPoints.filter((v, i) => importantPoints.findIndex((w) => pointsEqual(v, w)) === i);
    importantPoints.sort(sortByPointOrder.bind(undefined, curve.pts));

    return importantPoints;
}

function calculateNearbyImportantPoints(curve : Curve, importantPoints : Point[], currImportant: Point) {
    let prevPrevImportant : Point | undefined;
    let prevImportant : Point | undefined;
    let nextImportant : Point | undefined;
    for (let i = 0; i < importantPoints.length; i++) {
        if (!isDefined(importantPoints[i]) || !isDefined(currImportant)) {
            break;
        }
        if (pointsEqual(importantPoints[i], currImportant)) {
            if (curve.isClosed) {
                // closed curves *should* always have at least 4 important points (max/min for each axis)
                prevPrevImportant = (importantPoints.length <= 1) ? undefined : importantPoints[mod(i - 2, importantPoints.length)];
                prevImportant = (importantPoints.length <= 1) ? undefined : importantPoints[mod(i - 1, importantPoints.length)]; 
                nextImportant = (importantPoints.length <= 1) ? undefined : importantPoints[mod(i + 1, importantPoints.length)];
            } else {
                prevImportant = importantPoints[i - 1]; 
                nextImportant = importantPoints[i + 1];
            }
            break;
        }
    }
    return {prevImportant, nextImportant, prevPrevImportant};
}


// given a curve, translate the curve
export function translateCurve(curve: Curve, dx: number, dy: number, canvasProperties: CanvasProperties) {
    curve.pts.forEach((pt) => {
        pt.x += dx;
        pt.y += dy;
    });

    recalculateCurveProperties(curve, canvasProperties);
}


export const sortByPointOrder = (pts: Point[], a: Point, b: Point) => pts.findIndex((v: Point) => pointsEqual(a, v)) - pts.findIndex((v: Point) => pointsEqual(b, v));

export function rotateCurve(curve: Curve, angle: number, center: Point, canvasProperties: CanvasProperties) {
    const pts = curve.pts;
    
    function rotatePoint(point: Point, angle: number, center: Point) {
        const x = point.x - center.x;
        const y = point.y - center.y;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        point.x = x * cos - y * sin + center.x;
        point.y = x * sin + y * cos + center.y;
    }

    pts.map(pt => rotatePoint(pt, angle, center));

    recalculateCurveProperties(curve, canvasProperties);
}


export function stretchTurningPoint(selectedCurve: Curve, movedPoint: Point, mousePosition: Point, canvasProperties: CanvasProperties) {
    
    let importantPoints = findImportantPoints(selectedCurve);
    
    if (selectedCurve.lineType === LineType.LINEAR) {
        const currImportant = movedPoint;
        const otherImportant = importantPoints.find((v) => !pointsEqual(v, currImportant));
        if (isDefined(otherImportant)) {
            stretchLinearCurve(selectedCurve, currImportant, otherImportant, mousePosition);
            recalculateCurveProperties(selectedCurve, canvasProperties);
        }
        return selectedCurve;
    }
    
    const nearbyImportants = calculateNearbyImportantPoints(selectedCurve, importantPoints, movedPoint);
    const prevPrevImportant = nearbyImportants.prevPrevImportant;
    let prevImportant = nearbyImportants.prevImportant;
    let currImportant = movedPoint;
    let nextImportant = nearbyImportants.nextImportant;
    
    let withinXBoundary = false;
    let withinYBoundary = false;

    const XBUFFER = 30;
    const YBUFFER = 15;
    // when dragging, we shouldn't be able to move the turning point past the next/prev turning point in either axis
    if (prevImportant && nextImportant) {
        const leftImportant = (prevImportant.x < nextImportant.x) ? prevImportant : nextImportant;
        const rightImportant = (prevImportant.x < nextImportant.x) ? nextImportant : prevImportant;
        const isMaxima = selectedCurve.maxima.findIndex((maxima) => pointsEqual(maxima, movedPoint)) !== -1;
        withinXBoundary = (rightImportant.x - mousePosition.x) > XBUFFER && (mousePosition.x - leftImportant.x) > XBUFFER;
        withinYBoundary = (isMaxima && ((rightImportant.y - mousePosition.y) > YBUFFER && (leftImportant.y - mousePosition.y) > YBUFFER)) || (!isMaxima && ((mousePosition.y - rightImportant.y) > YBUFFER && (mousePosition.y - leftImportant.y) > YBUFFER));
    } else {
        const definedImportant = prevImportant ?? nextImportant;
        if (!isDefined(definedImportant)) return;
        if (definedImportant.x - currImportant.x > 0) {
            withinXBoundary = (definedImportant.x - mousePosition.x) > XBUFFER;
        } else {
            withinXBoundary = (mousePosition.x - definedImportant.x) > XBUFFER;
        }
        if (definedImportant.y - currImportant.y > 0) {
            withinYBoundary = (definedImportant.y - mousePosition.y) > YBUFFER;
        } else {
            withinYBoundary = (mousePosition.y - definedImportant.y) > YBUFFER;
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
            mousePosition.x = currImportant.x;
        } else if (!withinYBoundary) {
            mousePosition.y = currImportant.y;
        }

        // not in-place!
        const rotateList = (list: Point[], n: number) => list.slice(n).concat(list.slice(0, n));

        // rotate internal curve representation if closed -- see below
        const originalPrevPrevImportantIndex = selectedCurve.pts.findIndex((v: Point) => pointsEqual(v, prevPrevImportant));
        if (selectedCurve.isClosed && isDefined(originalPrevPrevImportantIndex)) {
            // rotate so pPI is the first point, then recalculate curve properties
            selectedCurve.pts = rotateList(selectedCurve.pts, originalPrevPrevImportantIndex);
            recalculateCurveProperties(selectedCurve, canvasProperties);

            importantPoints = findImportantPoints(selectedCurve);
            const rotatedImportants = calculateNearbyImportantPoints(selectedCurve, importantPoints, currImportant);
            prevImportant = rotatedImportants.prevImportant;
            nextImportant = rotatedImportants.nextImportant;
        }

        // we start the following foreach loop in state given by currentSectionState:
        let currentSectionState = (prevImportant) ? 0 : 1;
        // it is incremented at most once per iteration, determining which section of the curve we are in (leftStatic, leftStretched, rightStretched, rightStatic):
        const updateSectionState = (pt : Point) => {
            // note: this can't be simplified into an (a || b || ... ? currentSectionState+1 % 4) because two of the same point can appear twice in a row in closed loops.
            if (pointsEqual(pt, prevImportant)) currentSectionState = 1;
            if (pointsEqual(pt, currImportant)) currentSectionState = 2;
            if (pointsEqual(pt, nextImportant)) currentSectionState = 3;
            if (pointsEqual(pt, prevPrevImportant)) currentSectionState = 0;
        };
        // we *almost* always start in leftStatic.
        // if the line is not closed:
            // if we are stretching any point other than an endpoint, the endpoints are always static, so we can start in leftStatic.
            // if we are stretching the start point, leftStatic will be empty, so we will start in leftStretched -- hence the undefined check on prevImportant above.
            // if we are stretching the end point, rightStatic will be empty, but we don't need to do anything extra to account for this.
        // if the line is closed:
            // there are no endpoints, but we know there are at least 4 important points (min/max on both axes).
            // therefore, assume any important point that is not the selected point or the prev/next important point (i.e. prevPrevImportant) is the first point.
                // i.e. able to start in leftStatic if we rotate so the prevPrevImportant is the first point.

        selectedCurve.pts.forEach(pt => {
            if (!isDefined(prevImportant)) {
                // this must be run before the switch if there is no earlier important point,
                // and must be run after the switch if there is no later important point.
                // cases with both work with either position.
                // otherwise, one additional point gets added to the left/right stretch points each iteration, causing increasing weirdness.
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
            const lorx = currImportant.x - prevImportant.x;
            const lory = currImportant.y - prevImportant.y;
            const lnrx = mousePosition.x - prevImportant.x;
            const lnry = mousePosition.y - prevImportant.y;
            stretchCurve(leftStretchedCurve, lorx, lory, lnrx, lnry, prevImportant.x, prevImportant.y);    
        }
        if (isDefined(nextImportant)) {
            const rorx = nextImportant.x - currImportant.x;
            const rory = currImportant.y - nextImportant.y;
            const rnrx = nextImportant.x - mousePosition.x;
            const rnry = mousePosition.y - nextImportant.y;
            stretchCurve(rightStretchedCurve, rorx, rory, rnrx, rnry, nextImportant.x, nextImportant.y);
        }

        currImportant = mousePosition;

        selectedCurve.pts.push(...leftStaticPoints);
        selectedCurve.pts.push(...leftStretchedCurve.pts);
        selectedCurve.pts.push(...rightStretchedCurve.pts);
        selectedCurve.pts.push(...rightStaticPoints);

        if (selectedCurve.isClosed && isDefined(originalPrevPrevImportantIndex)) {
            // rotate the curve back
            selectedCurve.pts = rotateList(selectedCurve.pts, selectedCurve.pts.length - originalPrevPrevImportantIndex);
        }

        recalculateCurveProperties(selectedCurve, canvasProperties);
    }
    return selectedCurve;
}

export function stretchCurve(c: Curve, orx: number, ory: number, nrx: number, nry: number, baseX: number, baseY: number) {

    const stretch = (pt: Point) => {
        if (Math.abs(orx) >= 1e-3) {
            const nx = (pt.x - baseX) / orx;
            pt.x = nx * nrx + baseX;
        }
        if (Math.abs(ory) >= 1e-3) {
            const ny = (pt.y - baseY) / ory;
            pt.y = ny * nry + baseY;
        }
    };
    
    // stretch each point
    c.pts.forEach(stretch);
}

export function stretchLinearCurve(c: Curve, current: Point, other: Point, target: Point) {
    if (!isDefined(other)) return;

    const flip = getDist(target, other) < getDist(target, current);
    const point = flip ? current : other;

    const xDist = (target.x - point.x) / c.pts.length;
    const yDist = (target.y - point.y) / c.pts.length;
    
    c.pts.forEach((pt, i) => {
        pt.x = point.x + i * xDist;
        pt.y = point.y + i * yDist;
    });
}

function _clone<T>(obj: T) {
    if (isDefined(obj)) {
        const json = JSON.stringify(obj);
        return JSON.parse(json);
    }
}