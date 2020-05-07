import p5 from 'p5';
import GraphView from './GraphView'; 

export function makeGraphView() {
    let sketch;
    let p = new p5((instance) => {
        sketch = new GraphView(instance);
        return sketch;
    }, element);
    return { sketch, p };
}

export * from './GraphView';