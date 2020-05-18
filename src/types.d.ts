import p5 from 'p5';
import { Point, Curve } from './GraphSketcher';

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