import p5 from 'p5';
import { Point, Curve } from './GraphSketcher';

// FIXME this file is completely pointless at the moment, but we should use it to
//  declare types so the final library can just consist of a single bundled .js file
//  and a .d.ts file

declare module "GraphView" {
    export class GraphView {
        constructor(p: p5, width: number, height: number);
        drawCurves: (curves: Curve[], color: number[]) => void;
        drawCurve: (curve: Curve, color: number[]) => void;
        drawKnots: (knots: any[], color: number[]) => void;
        drawKnot: (knot: any, color: number[]) => void;
        drawDetectedKnot: (knot: any) => void;
        drawVerticalDotLine: (x: any, begin: any, end: any) => void;
        drawHorizontalDotLine: (y: any, begin: any, end: any) => void;
        drawStretchBox: (idx: any, curves: any) => void;
        drawHorizontalAxis: (curveStrokeWeight: any, passed_width: any, passed_height: any) => void;
        drawVerticalAxis: (curveStrokeWeight: any, passed_width: any, passed_height: any) => void;
        drawGrid: (curveStrokeWeight: any, passed_width: any, passed_height: any) => void;
        drawLabel: () => void;
        drawBackground: (passed_width: any, passed_height: any) => void;
        drawCorner: (stretchMode: any, c: any) => void;
    }
}
declare module "GraphUtils" {}