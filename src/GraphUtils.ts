import {CanvasProperties, Curve, Dimension, GraphSketcherState, Point} from "./GraphSketcher";

// undefined|null checker and type guard all-in-wonder.
// Why is this not in Typescript?
export function isDefined<T>(stuff: T): stuff is NonNullable<T> {
    return stuff !== undefined && stuff !== null
}

const SAMPLE_INTERVAL = 10;
const numOfPts = 100;
export const CURVE_COMBINE_ENDPOINT_DISTANCE = 100;
export const CURVE_COMBINE_GRADIENT_THRESHOLD = 2;

// methods used in manipulating the graphs
export function getDist(pt1: Point, pt2: Point) {
    return Math.sqrt(Math.pow(pt1[0] - pt2[0], 2) + Math.pow(pt1[1] - pt2[1], 2));
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

        let min1 = findMinX(curve1.pts);
        let min2 = findMinX(curve2.pts);
        if (min1 < min2) return -1
        else if (min1 == min2) return 0
        else return 1;
    }

    function normalisePoint(point: Point, truncate: boolean): Point|null {
        if (point) {
            let x = normalise(point[0], Dimension.X)
            let y = normalise(point[1], Dimension.Y)
            if (truncate) {
                x = Math.round(x * 10000) / 10000;
                y = Math.round(y * 10000) / 10000;
            }
            return createPoint(x, y)
        }
        return null
    }

    function normalise(value: number, dimension: Dimension): number {
        if (dimension == Dimension.X) {
            return (value - canvasProperties.centerPx[0]) / canvasProperties.axisLengthPx;
        }
        else if (dimension == Dimension.Y) {
            return (canvasProperties.centerPx[1] - value) / canvasProperties.axisLengthPx;
        }
        return 0
    }

    let clonedCurves = _clone(curves);
    clonedCurves.sort(compare);

    for (let curve of clonedCurves) {
        curve.pts = curve.pts.map((point: Point) => normalisePoint(point, trunc))

        curve.minX = curve.minX? normalise(curve.minX, Dimension.X) : null
        curve.maxX = curve.maxX? normalise(curve.maxX, Dimension.X) : null
        curve.minY = curve.minY? normalise(curve.minY, Dimension.Y) : null
        curve.maxY = curve.maxY? normalise(curve.maxY, Dimension.Y) : null

        curve.interX = curve.interX.map((point: Point) => normalisePoint(point, trunc))
        curve.interY = curve.interY.map((point: Point) => normalisePoint(point, trunc))
        curve.maxima = curve.maxima.map((point: Point) => normalisePoint(point, trunc))
        curve.minima = curve.minima.map((point: Point) => normalisePoint(point, trunc))
    }

    return { curves: clonedCurves, canvasWidth: canvasProperties.widthPx, canvasHeight: canvasProperties.heightPx };
};

/*
Converts all curves held in GraphSketcherState from abstract Cartesian coordinates back to absolute pixel coordinates.
 */
export function decodeData(data: GraphSketcherState, canvasProperties: CanvasProperties): GraphSketcherState {

    function denormalisePoint(point: Point): Point|null {
        if (point) {
            return createPoint(denormalise(point[0], Dimension.X), denormalise(point[1], Dimension.Y))
        }
        return null
    }

    function denormalise(value: number, dimension: Dimension) {
        if (dimension == Dimension.X) {
            return value * canvasProperties.axisLengthPx + canvasProperties.centerPx[0];
        } else if (dimension == Dimension.Y) {
            return canvasProperties.centerPx[1] - value * canvasProperties.axisLengthPx
        }
        return 0
    }

    let clonedCurves = _clone(data.curves);

    for (let curve of clonedCurves) {
        curve.pts = curve.pts.map((point: Point) => denormalisePoint(point))

        curve.minX = curve.minX? denormalise(curve.minX, Dimension.X) : null
        curve.maxX = curve.maxX? denormalise(curve.maxX, Dimension.X) : null
        curve.minY = curve.minY? denormalise(curve.minY, Dimension.Y) : null
        curve.maxY = curve.maxY? denormalise(curve.maxY, Dimension.Y) : null

        curve.interX = curve.interX.map((point: Point) => denormalisePoint(point))
        curve.interY = curve.interY.map((point: Point) => denormalisePoint(point))
        curve.maxima = curve.maxima.map((point: Point) => denormalisePoint(point))
        curve.minima = curve.minima.map((point: Point) => denormalisePoint(point))
    }

    return { curves: clonedCurves, canvasWidth: canvasProperties.widthPx, canvasHeight: canvasProperties.heightPx };
};

// TODO 'e' is probably a mouse event of some sort
export function detect(e: MouseEvent, x: number, y: number) {
    let mousePosition = getMousePt(e);
    return (getDist(mousePosition, createPoint(x, y)) < 5);
};

export function getMousePt(e: any) {
    let x = (e.clientX - 5);
    let y = (e.clientY - 5);
    return createPoint(x, y);
};

export function createPoint(x: number, y: number) {
    let obj = [x, y];
    return obj;
};

export function linearLineStyle(pts: Point[]) {
    pts.sort(function(a, b){return a[0] - b[0]});
    let start = pts[0];
    let end = pts[1];
    let increment = 1/numOfPts;
    let linearPoints = [];
    let x_diff = pts[1][0]-pts[0][0];
    let y_diff = pts[1][1]-pts[0][1];
    for (let currentPoint = 0; currentPoint < numOfPts; currentPoint += 1) {
        let x_co = pts[0][0] + (currentPoint*increment*x_diff);
        let y_co = pts[0][1] + (currentPoint*increment*y_diff);
        linearPoints.push(createPoint(x_co,y_co));
    }
    return linearPoints;
};

export function bezierLineStyle(pts: Point[]) {

    // See https://github.com/josdejong/mathjs/blob/v5.8.0/src/function/probability/product.js
    // Product of all integers between i and n
    let product = function(i: number, n: number): number {
        let half;
        if (n < i) {
            return 1;
        }
        if (n === i) {
            return n;
        }
        half = (n + i) >> 1 // divide (n + i) by 2 and truncate to integer
        return product(i, half) * product(half + 1, n);
    }

    // See https://github.com/josdejong/mathjs/blob/v5.8.0/src/function/probability/combinations.js
    // Compute the number of ways of picking k unordered outcomes from n possibilities
    let combinations = function(n: number, k: number): number {
        let prodrange, nMinusk;
        if (n < 0 || k < 0) {
            throw new TypeError('Positive integer value expected in function combinations');
        }
        if (k > n) {
            throw new TypeError('k must be less than or equal to n');
        }
        nMinusk = n - k;
        if (k < nMinusk) {
            prodrange = product(nMinusk + 1, n);
            return prodrange / product(1, k);
        }
        prodrange = product(k + 1, n);
        return prodrange / product(1, nMinusk);
    }

    let drawnNumberOfPoints = pts.length - 1;
    let comb = [];
    for (let currentIndex = 0; currentIndex <= drawnNumberOfPoints; currentIndex += 1) {
        comb.push(combinations(drawnNumberOfPoints, currentIndex));
    }

    let step = 1 / numOfPts;
    let bezier = [];
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
};

export function sample(pts: Point[]) {
    let sampled = [];
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

export function overItem(curves: Curve[], e: any, MOUSE_DETECT_RADIUS: number, found: string) {
    let mousePosition = getMousePt(e);
    let loop = function(knots: Point[]) {
        for (let j = 0; j < knots.length; j++) {
            let knot = knots[j];
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
        let interX = curves[i]['interX'];
        loop(interX);
    
        let interY = curves[i]['interY'];
        loop(interY);

        let maxima = curves[i]['maxima'];
        loop(maxima);
    
        let minima = curves[i]['minima'];
        loop(minima);
    } 
    return found;
};

export function findEndPts(pts: Point[]): Point[] { 
    if (pts.length == 0) return [];

    let ends = [];

    ends.push(createPoint(pts[0][0], pts[0][1]));
    ends.push(createPoint(pts[pts.length - 1][0], pts[pts.length - 1][1]));

    // 200 acceptable for showing a curve is no longer just one line
    for (let i = 1; i < pts.length; i++) {
        if (pts[i-1][0] - pts[i][0] > 200) {
            ends.push(createPoint(pts[i-1][0], pts[i-1][1]));
            ends.push(createPoint(pts[i][0], pts[i][1]));
            continue;
        }
    }

    if (ends.length == 2) {
        for (let i = pts.length - 2; i > 1; i--) {
            if (pts[i+1][0] - pts[i][0] > 200) {
                ends.push(createPoint(pts[i+1][0], pts[i+1][1]));
                ends.push(createPoint(pts[i][0], pts[i][1]));
                continue;
            }
        }
    }

    return ends;
};

export function findInterceptX(canvasProperties: CanvasProperties, pts: Point[]) {
    if (pts.length == 0) return [];

    let intercepts = [];

    if (pts[0][1] == canvasProperties.centerPx[1]) intercepts.push(pts[0]);
    for (let i = 1; i < pts.length; i++) {
        if (pts[i][1] == canvasProperties.centerPx[1]) {
            intercepts.push(createPoint(pts[i][0], pts[i][1]));
            continue;
        }

        if ((pts[i-1][1] - canvasProperties.centerPx[1]) * (pts[i][1] - canvasProperties.centerPx[1]) < 0 && (pts[i-1][1] - pts[i][1] < Math.abs(200))) {
            let dx = pts[i][0] - pts[i-1][0];
            let dy = pts[i][1] - pts[i-1][1];
            let grad = dy/dx;
            let esti = pts[i-1][0] + (1 / grad) * (canvasProperties.centerPx[1] - pts[i-1][1]);
            intercepts.push(createPoint(esti, canvasProperties.centerPx[1]));
        }
    }

    return intercepts;
};

export function findInterceptY(canvasProperties: CanvasProperties, pts: Point[]) {
    if (pts.length == 0) return [];

    let intercepts = [];

    if (pts[0][0] == canvasProperties.centerPx[0]) intercepts.push(pts[0]);
    for (let i = 1; i < pts.length; i++) {
        if (pts[i][0] == canvasProperties.centerPx[0]) {
            intercepts.push(createPoint(pts[i][0], pts[i][1]));
            continue;
        }

        if ((pts[i-1][0] - canvasProperties.centerPx[0]) * (pts[i][0] - canvasProperties.centerPx[0]) < 0 && (pts[i-1][0] - pts[i][0] < Math.abs(200))) {
            let dx = pts[i][0] - pts[i-1][0];
            let dy = pts[i][1] - pts[i-1][1];
            let grad = dy/dx;
            let esti = pts[i-1][1] + grad * (canvasProperties.centerPx[0] - pts[i-1][0]);
            intercepts.push(createPoint(canvasProperties.centerPx[0], esti));
        }
    }

    return intercepts;
};

export function findTurnPts(pts: Point[], mode: string) {
    if (pts.length == 0) {
        return [];
    }

    let turnPts = [];
    let potentialPts = [];
    let statPts: Point[] = [];
    let pot_max = [];
    let pot_min = [];
    let CUTOFF = 10;

    for (let i = CUTOFF; i < pts.length-CUTOFF; i++) {
        if ((pts[i][1] < pts[i-1][1] && pts[i][1] < pts[i+1][1]) || (pts[i][1] > pts[i-1][1] && pts[i][1] > pts[i+1][1]) || (pts[i][1] == pts[i-1][1])) {
            potentialPts.push(createPoint(pts[i][0], pts[i][1]));
        }
    }

    let stationaryArrays = Object.create(null);

    // loop over turn pts and put them in arrays by same y value
    potentialPts.forEach(function(pt) {
        let stationaryArray = stationaryArrays[pt[1]];
        if (!stationaryArray) {
            stationaryArray = stationaryArrays[pt[1]] = [];
        }
        stationaryArray.push(pt);
    });

    Object.keys(stationaryArrays).forEach(function(key) {
        let middle = stationaryArrays[key][Math.floor(stationaryArrays[key].length / 2)];
        statPts.push(middle);
    });

    let position = null

    for (let i = 0; i < statPts.length; i++) { 
        for (let j = 0; j < pts.length; j++) {
            if (statPts[i][0] == pts[j][0]) {
                position = j;
            }
        }
        if (!isDefined(position)) continue;
        if (statPts[i][1] < pts[position-5][1] && statPts[i][1] < pts[position+5][1]) {
            pot_max.push(statPts[i]);
        } else if (statPts[i][1] > pts[position-5][1] && statPts[i][1] > pts[position+5][1]) {
            pot_min.push(statPts[i]);
        }
    }

    let true_max = duplicateStationaryPts(pot_max, mode);
    let true_min = duplicateStationaryPts(pot_min, mode);

    mode == 'maxima' ? turnPts = true_max : turnPts = true_min;  
    turnPts.sort(function(a, b){return a[0] - b[0]});
    
    return turnPts;
};

export function duplicateStationaryPts(pts: Point[], mode: string) {
    let non_duplicates = []
    for (let i = 0; i < pts.length; i++) {
        let similar_ind = [pts[i]]
        for (let j = 0; j < pts.length; j++) {
            if ((pts[j][0] !== pts[i][0]) && ((pts[j][0] < pts[i][0] + 5) && (pts[j][0] > pts[i][0] - 5))) {
                similar_ind.push(pts[j]);
            }
        }
        if (mode == 'maxima') {
            similar_ind.sort(function(a, b){return a[1] - b[1]})
        } else {
            similar_ind.sort(function(a, b){return b[1] - a[1]})
        }
        if (non_duplicates.indexOf(similar_ind[0]) === -1) {
            non_duplicates.push(similar_ind[0])
        }
    }
    return non_duplicates;
};

// given a curve, translate the curve
export function translateCurve(curve: Curve, dx: number, dy: number, canvasProperties: CanvasProperties) {
    let pts = curve.pts;

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
            let knot = knots[i];

            knot[0] += dx;
            knot[1] += dy;
        }
    }

    let maxima = curve.maxima;
    moveTurnPts(maxima);

    let minima = curve.minima;
    moveTurnPts(minima);


    let moveInter = function(inter: Point[], newInter: Point[]) {
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

    let interX = curve.interX,
        newInterX = findInterceptX(canvasProperties, pts);
    curve.interX = moveInter(interX, newInterX);

    let endPt = curve.endPt,
        newEndPt = findEndPts(pts);
    curve.endPt = newEndPt;
    void endPt;

    let interY = curve.interY,
        newInterY = findInterceptY(canvasProperties, pts);
    curve.interY = moveInter(interY, newInterY);

    return;
};

export function stretchTurningPoint(importantPoints: Point[], e: MouseEvent, selectedCurve: Curve, isMaxima: boolean, selectedPointIndex: number|undefined, prevMousePt: Point, canvasProperties: CanvasProperties) {
    if (!isDefined(selectedPointIndex)) return;

    let mousePosition = getMousePt(e);
    let tempMin = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
    let tempMax = [Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
    let turningPoints = isMaxima ? selectedCurve.maxima : selectedCurve.minima;
    for (let i = 0; i < importantPoints.length; i++) {
        if (!isDefined(importantPoints[i]) || !isDefined(turningPoints[selectedPointIndex])) {
            break;
        }
        if (importantPoints[i][0] == turningPoints[selectedPointIndex][0]) {
            tempMin = importantPoints[i - 1]; 
            tempMax = importantPoints[i + 1];
        }
    }
    let XBUFFER = 30;
    let YBUFFER = 15;
    let withinXBoundary = (mousePosition[0] - tempMax[0]) < -XBUFFER && (mousePosition[0] - tempMin[0]) > XBUFFER;
    let withinYBoundary = (isMaxima && ((mousePosition[1] - tempMax[1]) < -YBUFFER && (mousePosition[1] - tempMin[1]) < -YBUFFER)) || (!isMaxima && ((mousePosition[1] - tempMax[1]) > YBUFFER && (mousePosition[1] - tempMin[1]) > YBUFFER));
    let movementWithinBoundary = (withinXBoundary && withinYBoundary);
    if (movementWithinBoundary) {
        // to this point we get the clicked knot and the turning/end points either side, now we will split the curve into the two
        // origional max/min sides and the 2 new curves to be stretched, then combine them all after.
        let leftStaticPoints = new Array<Point>();
        let rightStaticPoints = new Array<Point>();
        let leftStretchedCurve = new Curve;
        let rightStretchedCurve = new Curve;
        for (let t = selectedCurve.pts.length-1; t > -1; t--) {
            if (selectedCurve.pts[t][0] > tempMax[0]) {
                rightStaticPoints.push(selectedCurve.pts[t]);
                selectedCurve.pts.pop(/* selectedCurve.pts[t] */);
            } else if (selectedCurve.pts[t][0] <= tempMax[0] && selectedCurve.pts[t][0] >= turningPoints[selectedPointIndex][0]) {
                rightStretchedCurve.pts.push(selectedCurve.pts[t]);
                selectedCurve.pts.pop(/* selectedCurve.pts[t] */);
            } else if (selectedCurve.pts[t][0] <= turningPoints[selectedPointIndex][0] && selectedCurve.pts[t][0] >= tempMin[0]) {
                leftStretchedCurve.pts.push(selectedCurve.pts[t]);
                selectedCurve.pts.pop(/* selectedCurve.pts[t] */);
            } else if (selectedCurve.pts[t][0] < tempMin[0]) {
                leftStaticPoints.push(selectedCurve.pts[t]);
                selectedCurve.pts.pop(/* selectedCurve.pts[t] */);
            } else {
                selectedCurve.pts.pop(/* selectedCurve.pts[t] */);
            }
        }

        leftStaticPoints.sort(function(a, b){return a[0] - b[0]});
        rightStaticPoints.sort(function(a, b){return a[0] - b[0]});
        leftStretchedCurve.pts.sort(function(a, b){return a[0] - b[0]});
        rightStretchedCurve.pts.sort(function(a, b){return a[0] - b[0]});

        // we have now split the curve into leftStaticPoints and rightStaticPoints, plus leftStretchedCurve and rightStretchedCurve
        let lorx = turningPoints[selectedPointIndex][0] - tempMin[0];
        let lory = turningPoints[selectedPointIndex][1] - tempMin[1];
        let rorx = tempMax[0] - turningPoints[selectedPointIndex][0];
        let rory = turningPoints[selectedPointIndex][1] - tempMax[1];
        let dx = mousePosition[0] - prevMousePt[0];
        let dy = mousePosition[1] - prevMousePt[1];
        turningPoints[selectedPointIndex][0] += dx;
        turningPoints[selectedPointIndex][1] += dy;

        let lnrx = turningPoints[selectedPointIndex][0] - tempMin[0];
        let lnry = turningPoints[selectedPointIndex][1] - tempMin[1];
        let rnrx = tempMax[0] - turningPoints[selectedPointIndex][0];
        let rnry = turningPoints[selectedPointIndex][1] - tempMax[1];

        stretchCurve(leftStretchedCurve, lorx, lory, lnrx, lnry, tempMin[0], tempMin[1], canvasProperties);    
        stretchCurve(rightStretchedCurve, rorx, rory, rnrx, rnry, tempMax[0], tempMax[1], canvasProperties);
                
        turningPoints[selectedPointIndex] = mousePosition;

        selectedCurve.pts.push.apply(selectedCurve.pts, leftStaticPoints);
        selectedCurve.pts.push.apply(selectedCurve.pts, leftStretchedCurve.pts);
        selectedCurve.pts.push.apply(selectedCurve.pts, rightStretchedCurve.pts);
        selectedCurve.pts.push.apply(selectedCurve.pts, rightStaticPoints);

        selectedCurve.interX = findInterceptX(canvasProperties, selectedCurve.pts);
        selectedCurve.interY = findInterceptY(canvasProperties, selectedCurve.pts);
        selectedCurve.maxima = findTurnPts(selectedCurve.pts, 'maxima');
        selectedCurve.minima = findTurnPts(selectedCurve.pts, 'minima');
        let minX = selectedCurve.pts[0][0];
        let maxX = selectedCurve.pts[0][0];
        let minY = selectedCurve.pts[0][1];
        let maxY = selectedCurve.pts[0][1];
        for (let k = 1; k < selectedCurve.pts.length; k++) {
            minX = Math.min(selectedCurve.pts[k][0], minX);
            maxX = Math.max(selectedCurve.pts[k][0], maxX);
            minY = Math.min(selectedCurve.pts[k][1], minY);
            maxY = Math.max(selectedCurve.pts[k][1], maxY);
        }
        selectedCurve.minX = minX;
        selectedCurve.maxX = maxX;
        selectedCurve.minY = minY;
        selectedCurve.maxY = maxY;
    }
    return selectedCurve;
};

export function stretchCurve(c: Curve, orx: number, ory: number, nrx: number, nry: number, baseX: number, baseY: number, canvasProperties: CanvasProperties) {

    function stretch(pt: Point) {
        let nx = (pt[0] - baseX) / orx;
        let ny = (pt[1] - baseY) / ory;
        pt[0] = nx * nrx + baseX;
        pt[1] = ny * nry + baseY;
    }

    let pts = c.pts;
    for (let j = 0; j < pts.length; j++) {
        stretch(pts[j]);
        c.pts[j] = pts[j];
    }


    function loop1(knots: Point[]) {
        if (knots != undefined) {
            for (let j = 0; j < knots.length; j++) {
                let knot = knots[j];

                stretch(knot);
            }
        }
    }

    c.endPt = findEndPts(pts);

    let maxima = c.maxima;
    loop1(maxima);

    let minima = c.minima;
    loop1(minima);

    let loop2 = function(inter: Point[] | undefined, newInter: Point[]) {
        if (isDefined(inter)) {
            for (let i = 0; i < inter.length; i++) {
                // if (inter[i].symbol != undefined) {
                //     let symbol = inter[i].symbol;

                //     let found = false,
                //         min = 50,
                //         knot;
                //     for (let j = 0; j < newInter.length; j++) {
                //         if (this.getDist(inter[i], newInter[j]) < min) {
                //             min = this.getDist(inter[i], newInter[j]);
                //             knot = newInter[j];
                //             found = true;
                //         }
                //     }

                //     if (found) {
                //         symbol.x = knot[0];
                //         symbol.y = knot[1];
                //         knot.symbol = symbol;
                //     }
                // }
            }
            return newInter;
        }
        return [[0,0]];
    };

    let interX = c.interX,
        newInterX = findInterceptX(canvasProperties, pts);
    c.interX = loop2(interX, newInterX);


    let interY = c.interY,
        newInterY = findInterceptY(canvasProperties, pts);
    c.interY = loop2(interY, newInterY);
};

export function getCombinableEndPts(draggedCurve: Curve, staticCurve: Curve, draggedEndPtIdx: number, staticEndPtIdx: number) {
    // Check if the curves are compatible - they must have the same colour
    if (draggedCurve.colorIdx != staticCurve.colorIdx) {
        return undefined;
    }
    // Check that the end points are close enough to each other
    const draggedEndPt = draggedCurve.endPt?.[draggedEndPtIdx];
    const staticEndPt = staticCurve.endPt?.[staticEndPtIdx];
    if (draggedEndPt == undefined || staticEndPt == undefined || getDist(draggedEndPt, staticEndPt) > CURVE_COMBINE_ENDPOINT_DISTANCE) {
        return undefined;
    }
    // Get the index of the end points inside each curves pts array
    function getEndPointIdxInPts(curve: Curve, endPtIdx: number) {
        if (curve.pts[0][0] === curve.endPt?.[endPtIdx][0] && curve.pts[0][1] === draggedCurve.endPt?.[endPtIdx][1]) {
            return 0;
        } else {
            return curve.pts.length - 1;
        }
    }
    const draggedEndPtIdxInPts = getEndPointIdxInPts(draggedCurve, draggedEndPtIdx);
    const staticEndPtIdxInPts = getEndPointIdxInPts(staticCurve, staticEndPtIdx);
    // Calculate the gradient close to the end points of each curve
    function getGradient(point1: Point, point2: Point) {
        // Order points by x value so we calculate the gradient uniformly for differently oriented curves
        const [pt1, pt2] = point1[0] < point2[0] ? [point1, point2] : [point2, point1];
        return (pt1[1] - pt2[1]) / (pt1[0] - pt2[0]);
    }
    function getGradientNearEndPt(curve: Curve, endPtIdx: number) {
        const endPt = curve.pts[endPtIdx];
        const closestPtToEnd = curve.pts[endPtIdx == 0 ? 1 : endPtIdx - 1];
        return getGradient(endPt, closestPtToEnd);
    }
    const draggedEndPtGrad = getGradientNearEndPt(draggedCurve, draggedEndPtIdxInPts);
    const staticEndPtGrad = getGradientNearEndPt(staticCurve, staticEndPtIdxInPts);
    const gradBetweenEndPts = getGradient(draggedEndPt, staticEndPt);
    // Make sure the average gradient of the two curves is close to the gradient between the end points
    if ((draggedEndPtGrad + staticEndPtGrad) / 2 > gradBetweenEndPts + CURVE_COMBINE_GRADIENT_THRESHOLD || (draggedEndPtGrad + staticEndPtGrad) / 2 < gradBetweenEndPts - CURVE_COMBINE_GRADIENT_THRESHOLD) {
        return undefined;
    }
    // TODO check directionality of pre-endpoint 1, endpoint 1, endpoint 2, post-endpoint 2 points - they should go roughly in the same direction
    return [draggedEndPtIdxInPts, staticEndPtIdxInPts];
}

// Combines two curves together. Doesn't modify the original curves, and returns a new curve.
// The indices should be those of END points (either 0 or pts.length - 1), not points in the middle of the curve.
export function combineCurves(draggedCurve: Curve, staticCurve: Curve, draggedEndPtIdxInPts: number, staticEndPtIdxInPts: number, canvasProperties: CanvasProperties) {
    // Now extend the static curve by the points of the dragged curve
    let combinedCurve = new Curve();
    if (draggedEndPtIdxInPts == 0 && staticEndPtIdxInPts == staticCurve.pts.length - 1) {
        // Start of dragged curve is being glued to the end of the static curve
        combinedCurve.pts = staticCurve.pts.concat(draggedCurve.pts);
    } else if (draggedEndPtIdxInPts == 0 && staticEndPtIdxInPts == 0) {
        // Start of dragged curve is being glued to the start of the static curve
        combinedCurve.pts = staticCurve.pts.slice().reverse().concat(draggedCurve.pts);
    } else if (draggedEndPtIdxInPts == draggedCurve.pts.length - 1 && staticEndPtIdxInPts == staticCurve.pts.length - 1) {
        // End of dragged curve is being glued to the end of the static curve
        combinedCurve.pts = draggedCurve.pts.slice().reverse().concat(staticCurve.pts);
    } else if (draggedEndPtIdxInPts == draggedCurve.pts.length - 1 && staticEndPtIdxInPts == 0) {
        // End of dragged curve is being glued to the start of the static curve
        combinedCurve.pts = draggedCurve.pts.concat(staticCurve.pts);
    } else {
        // This should never happen...
        console.error("Error in combineCurves - end point indices are not 0 or pts.length - 1");
        return undefined;
    }
    combinedCurve.pts = bezierLineStyle(combinedCurve.pts);
    // Calculate the new properties of the combined curve - we need to do this because the bezierLineStyle function
    // may have changed the curve a fair bit
    combinedCurve.colorIdx = draggedCurve.colorIdx;
    combinedCurve.minX = Math.min(...combinedCurve.pts.map(pt => pt[0]));
    combinedCurve.maxX = Math.max(...combinedCurve.pts.map(pt => pt[0]));
    combinedCurve.minY = Math.min(...combinedCurve.pts.map(pt => pt[1]));
    combinedCurve.maxY = Math.max(...combinedCurve.pts.map(pt => pt[1]));
    combinedCurve.interX = findInterceptX(canvasProperties, combinedCurve.pts);
    combinedCurve.interY = findInterceptY(canvasProperties, combinedCurve.pts);
    combinedCurve.endPt = findEndPts(combinedCurve.pts);
    combinedCurve.maxima = findTurnPts(combinedCurve.pts, 'maxima');
    combinedCurve.minima = findTurnPts(combinedCurve.pts, 'minima');
    return combinedCurve;
}

export function _clone(obj: any) {
    if (isDefined(obj)) {
        const json = JSON.stringify(obj);
        return JSON.parse(json);
    }
};