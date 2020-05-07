import p5 from 'p5';
import GraphView from './GraphView';

const s = (p, _width, _height) => {
    let width = _width;
    let height = _height;

    p.setup = () => {
        p.createCanvas(width, height);
    }

    p.draw = () => {
        p.background(255);
    }
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