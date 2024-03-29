# Graph Sketcher

A graph sketching application for [Isaac Physics](https://isaacphysics.org).

## Development
This graph sketcher is a dependency and cannot be run standalone.

To test it locally, you will need to run `yarn link` in this project, and then `yarn link "isaac-graph-sketcher"` in the 
project you want to test it in. Next, build this project with `yarn run build`. 

You will need to run `yarn run build` on this project again to update the dependency when changes are made. This should hot-reload
the client if set up as described.

## Usage

> npm install --save isaac-graph-sketcher

This is a little tricky to integrate right now but you can have a look at [our main repo](https://github.com/isaacphysics/isaac-react-app) for a few examples.

This also depends on a [back-end checker](https://github.com/isaacphysics/isaac-graph-checker) written in Java.

## License

Copyright 2024 University of Cambridge

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at [http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
